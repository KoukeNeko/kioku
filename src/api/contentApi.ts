import type { Scalar } from '@op-engineering/op-sqlite';
import { db } from '../db/schema';
import { CONTENT_ALIAS } from '../db/contentDb';

/**
 * 內容存取層（單字／例句／漢字／牌組）。
 *
 * 內容全部離線，讀自打包進 App 的唯讀內容庫（見 src/db/contentDb.ts；以別名 `content` 掛載於主連線）。
 * 使用者的 FSRS 卡片狀態與複習紀錄留在主庫（cards / revlog），與內容分離。
 *
 * 保留原「雲端 client」的 export 名稱／簽章／回傳形狀不變（含 async），故各 repository 與畫面零改動；
 * 每個查詢的 SQL 與 row→物件映射對照原後端 server/store.go。
 */

// 內容庫改版時 bump（對齊原後端 ContentVersion）。
const CONTENT_VERSION = 'v4';
// 單次 IN 查詢的最大 id 數（避免超過 SQLite 變數上限；超出則分批）。
const MAX_IN_PARAMS = 500;

const C = CONTENT_ALIAS;
const VOCAB_COLS = 'id, expression, reading, furigana, gloss, pos, jlpt, pitch, freq_rank, intro_rank, is_jukugo';
const VOCAB_COLS_V =
  'v.id, v.expression, v.reading, v.furigana, v.gloss, v.pos, v.jlpt, v.pitch, v.freq_rank, v.intro_rank, v.is_jukugo';

export interface FuriganaChunk {
  ruby: string;
  rt?: string;
}

export interface ApiVocab {
  id: string;
  expression: string;
  reading: string;
  furigana: FuriganaChunk[] | null;
  gloss: string;
  pos: string | null;
  jlpt: number | null;
  pitch: number | null;
  freqRank: number | null;
  introRank: number | null;
  isJukugo: boolean;
}

export interface ApiExample {
  jp: string;
  furigana: FuriganaChunk[];
  en: string;
}

export interface ApiKanji {
  char: string;
  strokes: string[];
  strokeCount: number | null;
  jlpt: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
}

export interface ApiVocabDetail extends ApiVocab {
  examples: ApiExample[];
  kanji: ApiKanji[];
}

export interface ApiDeck {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  sortOrder: number;
  kind: string;
  count: number;
  version: string;
}

export interface ApiDeckMember {
  id: string;
  introRank: number | null;
}

export interface ApiKanjiExample {
  id: number;
  jp: string;
  furigana: FuriganaChunk[];
  en: string;
}

export interface ApiSearchVocab {
  id: string;
  expression: string;
  reading: string;
  gloss: string;
  jlpt: number | null;
}

export interface ApiSearchKanji {
  char: string;
  meanings: string[];
  on: string[];
  kun: string[];
}

export interface ApiSearchDeck {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  vocabCount: number;
}

export interface ApiSearchResults {
  query: string;
  vocab: ApiSearchVocab[];
  kanji: ApiSearchKanji[];
  decks: ApiSearchDeck[];
}

// --- row → 物件映射（對照 store.go 的 scan* + rawOrArray/nullInt/nullStr）---

// JSON 欄位為 null/空 → null（對照 Vocab.Furigana：NULL 序列化為 null）。
const parseJsonOrNull = <T>(raw: Scalar): T | null =>
  typeof raw === 'string' && raw.length > 0 ? (JSON.parse(raw) as T) : null;

// JSON 欄位為 null/空 → 空陣列（對照 rawOrArray：NULL → []）。
const parseJsonArray = <T>(raw: Scalar): T[] =>
  typeof raw === 'string' && raw.length > 0 ? (JSON.parse(raw) as T[]) : [];

const rowToVocab = (row: any): ApiVocab => ({
  id: row.id,
  expression: row.expression,
  reading: row.reading,
  furigana: parseJsonOrNull<FuriganaChunk[]>(row.furigana),
  gloss: row.gloss,
  pos: row.pos ?? null,
  jlpt: row.jlpt ?? null,
  pitch: row.pitch ?? null,
  freqRank: row.freq_rank ?? null,
  introRank: row.intro_rank ?? null,
  isJukugo: Boolean(row.is_jukugo),
});

const rowToKanji = (row: any): ApiKanji => ({
  char: row.char,
  strokes: parseJsonArray<string>(row.strokes),
  strokeCount: row.stroke_count ?? null,
  jlpt: row.jlpt ?? null,
  on: parseJsonArray<string>(row.on_readings),
  kun: parseJsonArray<string>(row.kun_readings),
  meanings: parseJsonArray<string>(row.meanings),
});

const rowToDeck = (row: any, count: number): ApiDeck => ({
  id: row.id,
  name: row.name,
  description: row.description ?? '',
  tags: parseJsonArray<string>(row.tags),
  color: row.color,
  sortOrder: row.sort_order,
  kind: row.kind,
  count,
  version: CONTENT_VERSION,
});

const deckMemberCount = (deckId: string): number => {
  const row = db
    .executeSync(`SELECT COUNT(*) AS c FROM ${C}.deck_vocab WHERE deck_id = ?`, [deckId])
    .rows?.[0] as { c?: number } | undefined;
  return row?.c ?? 0;
};

const deckExists = (deckId: string): boolean => deckMemberCount(deckId) > 0
  ? true
  : ((db.executeSync(`SELECT 1 FROM ${C}.decks WHERE id = ? LIMIT 1`, [deckId]).rows?.length ?? 0) > 0);

/** 卡包目錄（依 sort_order；附每包詞數）。 */
export const fetchDecks = async (): Promise<ApiDeck[]> => {
  const rows =
    db.executeSync(`SELECT id, name, description, tags, color, sort_order, kind FROM ${C}.decks ORDER BY sort_order`)
      .rows ?? [];
  return rows.map((row: any) => rowToDeck(row, deckMemberCount(row.id)));
};

/** 卡包內容：成員 join vocab，依 position 後 intro_rank 排序；可分頁。 */
export const fetchDeckVocab = async (deckId: string, limit?: number, offset?: number): Promise<ApiVocab[]> => {
  if (!deckExists(deckId)) {
    throw new Error(`deck not found: ${deckId}`);
  }
  let sql =
    `SELECT ${VOCAB_COLS_V} FROM ${C}.deck_vocab dv JOIN ${C}.vocab v ON dv.vocab_id = v.id` +
    ` WHERE dv.deck_id = ? ORDER BY dv.position IS NULL, dv.position ASC, v.intro_rank IS NULL, v.intro_rank ASC`;
  const args: Scalar[] = [deckId];
  // offset 需獨立於 limit 生效；SQLite 的 OFFSET 必須搭配 LIMIT，無上限時用 LIMIT -1。
  if (limit != null && limit > 0) {
    sql += ' LIMIT ?';
    args.push(limit);
  } else if (offset != null && offset > 0) {
    sql += ' LIMIT -1';
  }
  if (offset != null && offset > 0) {
    sql += ' OFFSET ?';
    args.push(offset);
  }
  const rows = db.executeSync(sql, args).rows ?? [];
  return rows.map(rowToVocab);
};

/** 卡包成員精簡列（seed 專用）：id + introRank，依 intro_rank 升冪。回傳裸陣列。 */
export const fetchDeckMembers = async (deckId: string): Promise<ApiDeckMember[]> => {
  const rows =
    db.executeSync(
      `SELECT v.id, v.intro_rank FROM ${C}.deck_vocab dv JOIN ${C}.vocab v ON dv.vocab_id = v.id` +
        ` WHERE dv.deck_id = ? ORDER BY v.intro_rank IS NULL, v.intro_rank ASC`,
      [deckId],
    ).rows ?? [];
  return rows.map((row: any) => ({ id: row.id, introRank: row.intro_rank ?? null }));
};

/** 批次取核心單字（順序不保證，呼叫端自行索引）。 */
export const fetchVocabByIds = async (ids: string[]): Promise<ApiVocab[]> => {
  if (ids.length === 0) return [];
  const out: ApiVocab[] = [];
  for (let start = 0; start < ids.length; start += MAX_IN_PARAMS) {
    const chunk = ids.slice(start, start + MAX_IN_PARAMS);
    const placeholders = chunk.map(() => '?').join(',');
    const rows =
      db.executeSync(`SELECT ${VOCAB_COLS} FROM ${C}.vocab WHERE id IN (${placeholders})`, chunk as Scalar[]).rows ?? [];
    for (const row of rows) out.push(rowToVocab(row));
  }
  return out;
};

/** 單字延伸：核心 + 例句 + 構成漢字。找不到即拋錯（對照後端 404）。 */
export const fetchVocabDetail = async (vocabId: string): Promise<ApiVocabDetail> => {
  const base = db.executeSync(`SELECT ${VOCAB_COLS} FROM ${C}.vocab WHERE id = ?`, [vocabId]).rows?.[0];
  if (!base) {
    throw new Error(`vocab not found: ${vocabId}`);
  }
  const exampleRows =
    db.executeSync(
      `SELECT e.jp, e.furigana, e.en FROM ${C}.example e` +
        ` JOIN ${C}.vocab_example ve ON e.id = ve.example_id WHERE ve.vocab_id = ?`,
      [vocabId],
    ).rows ?? [];
  const examples: ApiExample[] = exampleRows.map((row: any) => ({
    jp: row.jp,
    furigana: parseJsonArray<FuriganaChunk>(row.furigana),
    en: row.en,
  }));
  const kanjiRows =
    db.executeSync(
      `SELECT k.char, k.strokes, k.stroke_count, k.jlpt, k.on_readings, k.kun_readings, k.meanings` +
        ` FROM ${C}.kanji k JOIN ${C}.vocab_kanji vk ON k.char = vk.char WHERE vk.vocab_id = ?`,
      [vocabId],
    ).rows ?? [];
  const kanji: ApiKanji[] = kanjiRows.map(rowToKanji);
  return { ...rowToVocab(base), examples, kanji };
};

/** 含某漢字的單字（筆順頁相關單字）。 */
export const fetchKanjiWords = async (char: string, limit = 10): Promise<ApiVocab[]> => {
  const rows =
    db.executeSync(
      `SELECT ${VOCAB_COLS_V} FROM ${C}.vocab v JOIN ${C}.vocab_kanji vk ON v.id = vk.vocab_id WHERE vk.char = ? LIMIT ?`,
      [char, limit],
    ).rows ?? [];
  return rows.map(rowToVocab);
};

/** 含某漢字的例句（筆順頁例句）。 */
export const fetchKanjiExamples = async (char: string, limit = 10): Promise<ApiKanjiExample[]> => {
  const rows =
    db.executeSync(`SELECT id, jp, furigana, en FROM ${C}.example WHERE jp LIKE ? LIMIT ?`, [`%${char}%`, limit])
      .rows ?? [];
  return rows.map((row: any) => ({
    id: row.id,
    jp: row.jp,
    furigana: parseJsonArray<FuriganaChunk>(row.furigana),
    en: row.en,
  }));
};

/** 搜尋：單字／漢字／牌組三類一次取回。 */
export const fetchSearch = async (query: string, limit = 50): Promise<ApiSearchResults> => {
  const like = `%${query}%`;
  const prefix = `${query}%`;

  const vocabRows =
    db.executeSync(
      `SELECT id, expression, reading, gloss, jlpt FROM ${C}.vocab` +
        ` WHERE expression LIKE ? OR reading LIKE ? OR gloss LIKE ?` +
        ` ORDER BY CASE WHEN expression = ? OR reading = ? THEN 1` +
        `   WHEN expression LIKE ? OR reading LIKE ? THEN 2 ELSE 3 END LIMIT ?`,
      [like, like, like, query, query, prefix, prefix, limit],
    ).rows ?? [];
  const vocab: ApiSearchVocab[] = vocabRows.map((row: any) => ({
    id: row.id,
    expression: row.expression,
    reading: row.reading,
    gloss: row.gloss,
    jlpt: row.jlpt ?? null,
  }));

  const kanjiRows =
    db.executeSync(
      `SELECT char, meanings, on_readings, kun_readings FROM ${C}.kanji` +
        ` WHERE char LIKE ? OR meanings LIKE ? OR on_readings LIKE ? OR kun_readings LIKE ? LIMIT ?`,
      [like, like, like, like, limit],
    ).rows ?? [];
  const kanji: ApiSearchKanji[] = kanjiRows.map((row: any) => ({
    char: row.char,
    meanings: parseJsonArray<string>(row.meanings),
    on: parseJsonArray<string>(row.on_readings),
    kun: parseJsonArray<string>(row.kun_readings),
  }));

  const deckRows =
    db.executeSync(
      `SELECT d.id, d.name, d.description, d.tags, d.color, COUNT(DISTINCT v.id) AS vocab_count` +
        ` FROM ${C}.decks d` +
        ` LEFT JOIN ${C}.deck_vocab dv ON dv.deck_id = d.id` +
        ` LEFT JOIN ${C}.vocab v ON v.id = dv.vocab_id AND (v.expression LIKE ? OR v.reading LIKE ? OR v.gloss LIKE ?)` +
        ` WHERE d.name LIKE ? OR d.description LIKE ? OR v.id IS NOT NULL` +
        ` GROUP BY d.id, d.name, d.description, d.tags, d.color, d.sort_order ORDER BY d.sort_order LIMIT ?`,
      [like, like, like, like, like, limit],
    ).rows ?? [];
  const decks: ApiSearchDeck[] = deckRows.map((row: any) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    tags: parseJsonArray<string>(row.tags),
    color: row.color,
    vocabCount: row.vocab_count,
  }));

  return { query, vocab, kanji, decks };
};
