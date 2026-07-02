/**
 * ETL: 組裝正規化的「內容庫」預載 SQLite（唯讀參照資料）。
 *
 * 以「單字」為樞紐，把所有開放授權資源用 (表記 + 讀音) 這個 join key 關聯起來：
 *   vocab          ← jmdict-simplified eng-common（~2.2 萬常用詞）+ tanos JLPT 分級
 *   vocab.furigana ← JmdictFurigana
 *   vocab.pitch    ← UniDic 單詞素重音（enrich-pitch-freq.py 後處理填入；不再用 Kanjium）
 *   vocab.freq_rank← wordfreq 純詞頻全域排名（enrich-pitch-freq.py 後處理填入）
 *   vocab.intro_rank← 新卡引入順序（enrich-pitch-freq.py：freq + 機能詞/單漢字/重複異讀降權）
 *   kanji          ← KANJIDIC2 + KanjiVG（涵蓋 vocab 用到的所有漢字）
 *   example        ← Tanaka Corpus（kuromoji 斷詞產生例句 furigana）
 *   vocab_kanji    ← 詞↔構成漢字（M:N）
 *   vocab_example  ← 詞↔例句（M:N）
 *
 * cards / revlog 不在此庫（屬可變使用者狀態，留在 App 可寫 DB）。
 * 產出：assets/db/kioku-content.db —— 由 op-sqlite 唯讀開啟（見 cutover 計畫）。
 */

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(SCRIPT_DIR, '.cache');
const APP_ROOT = join(SCRIPT_DIR, '..', '..');
// 內容庫直接產出到 App 資產目錄，隨 App 打包（離線）；不再經由伺服器。
const OUTPUT_DIR = join(APP_ROOT, 'assets', 'db');
const OUTPUT_PATH = join(OUTPUT_DIR, 'kioku-content.db');
const KUROMOJI_DICT_PATH = join(APP_ROOT, 'node_modules', 'kuromoji', 'dict');

const JLPT_LEVELS = [5, 4, 3, 2, 1];

// JLPT 牌組目錄（寫入 decks 表，資料驅動 → 取代 App/Server 各處 hardcode）。
const JLPT_DECK_META = [
  { id: 'deck-n5', level: 5, name: 'JLPT N5', description: 'JLPT N5 語彙', tags: ['N5', '語彙'], color: '#66D283' },
  { id: 'deck-n4', level: 4, name: 'JLPT N4', description: 'JLPT N4 語彙', tags: ['N4', '語彙'], color: '#4DA6FF' },
  { id: 'deck-n3', level: 3, name: 'JLPT N3', description: 'JLPT N3 語彙', tags: ['N3', '語彙'], color: '#FF5A36' },
  { id: 'deck-n2', level: 2, name: 'JLPT N2', description: 'JLPT N2 語彙', tags: ['N2', '語彙'], color: '#5CB3FF' },
  { id: 'deck-n1', level: 1, name: 'JLPT N1', description: 'JLPT N1 語彙', tags: ['N1', '語彙'], color: '#9D72FF' },
];
const MAX_EXAMPLES_PER_VOCAB = 5;
const MIN_EXAMPLE_LEN = 8;
const MAX_EXAMPLE_LEN = 45;
const EXAMPLES_PER_HEADWORD = 8;
const UTF8_BOM = '﻿';
const SEP = '\t';
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x60;
const KANJI_START = '一';
const KANJI_END = '鿿';

const stripBom = (text) => (text.startsWith(UTF8_BOM) ? text.slice(1) : text);
const key = (a, b) => `${a}${SEP}${b}`;
const isKanji = (char) => char >= KANJI_START && char <= KANJI_END;
const hasKanji = (text) => [...text].some(isKanji);
const kanjiChars = (text) => [...new Set([...text].filter(isKanji))];
const katakanaToHiragana = (text) =>
  [...text]
    .map((ch) => {
      const code = ch.codePointAt(0);
      return code >= KATAKANA_START && code <= KATAKANA_END ? String.fromCodePoint(code - HIRAGANA_OFFSET) : ch;
    })
    .join('');

const readFromCache = (name) => readFileSync(join(CACHE_DIR, name), 'utf-8');

// tanos 欄位正規化：取第一寫法、去括號註記與波浪號，以對齊 jmdict 的形式。
const VARIANT_RE = /[;、]/;
const normFirst = (field) =>
  (field.split(VARIANT_RE)[0] ?? '')
    .replace(/\s*[（(].*?[)）]\s*/g, '')
    .replace(/[～〜]/g, '')
    .trim();

const parseCsvLine = (line) => {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i += 1; } else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) { fields.push(current); current = ''; } else { current += ch; }
  }
  fields.push(current);
  return fields;
};

/**
 * tanos n{level}.csv → { levelByKey: Map<expr<TAB>reading, level>, records: [{expr,reading,meaning,level}] }。
 * 表記/讀音皆正規化；level 數字越大越簡單（N5=5），重複時較簡單者勝。
 */
const loadJlptLevels = () => {
  const levelByKey = new Map();
  const records = [];
  for (const level of [1, 2, 3, 4, 5]) {
    const lines = stripBom(readFromCache(`n${level}.csv`)).split(/\r?\n/).filter(Boolean);
    const [header, ...rows] = lines.map(parseCsvLine);
    const exprIdx = header.indexOf('expression');
    const readIdx = header.indexOf('reading');
    const meanIdx = header.indexOf('meaning');
    for (const row of rows) {
      const expr = normFirst(row[exprIdx] ?? '');
      const reading = normFirst(row[readIdx] ?? '');
      const meaning = (row[meanIdx] ?? '').trim();
      if (expr && reading) {
        levelByKey.set(key(expr, reading), level);
        records.push({ expr, reading, meaning, level });
      }
    }
  }
  return { levelByKey, records };
};

const loadFuriganaIndex = () => {
  const index = new Map();
  for (const entry of JSON.parse(stripBom(readFromCache('JmdictFurigana.json')))) {
    index.set(key(entry.text, entry.reading), entry.furigana);
  }
  return index;
};

/** KanjiVG XML → Map<漢字, string[]（逐筆 path d）>。 */
const loadStrokesByKanji = () => {
  const xml = readFromCache('kanjivg.xml');
  const strokes = new Map();
  const blockRe = /<kanji id="kvg:kanji_([0-9a-f]{5})">([\s\S]*?)<\/kanji>/g;
  const pathRe = /\bd="([^"]+)"/g;
  for (const block of xml.matchAll(blockRe)) {
    const char = String.fromCodePoint(parseInt(block[1], 16));
    const ds = [...block[2].matchAll(pathRe)].map((m) => m[1]);
    if (ds.length > 0) strokes.set(char, ds);
  }
  return strokes;
};

const findKanjidicFile = () =>
  readdirSync(CACHE_DIR).find((n) => n.startsWith('kanjidic2-en') && n.endsWith('.json'));

/** KANJIDIC2 JSON → Map<漢字, metadata>。 */
const loadKanjiMeta = () => {
  const dict = JSON.parse(stripBom(readFromCache(findKanjidicFile())));
  const meta = new Map();
  const readings = (groups, type) =>
    groups.flatMap((g) => g.readings ?? []).filter((r) => r.type === type).map((r) => r.value);
  for (const c of dict.characters) {
    const groups = c.readingMeaning?.groups ?? [];
    meta.set(c.literal, {
      strokeCount: c.misc?.strokeCounts?.[0] ?? null,
      grade: c.misc?.grade ?? null,
      jlpt: c.misc?.jlptLevel ?? null,
      frequency: c.misc?.frequency ?? null,
      on: readings(groups, 'ja_on'),
      kun: readings(groups, 'ja_kun'),
      meanings: groups.flatMap((g) => g.meanings ?? []).filter((m) => m.lang === 'en').map((m) => m.value),
    });
  }
  return meta;
};

/**
 * jmdict-eng-common → vocab 列（挑常用表記/讀音、首義 gloss、品詞）。
 * JLPT 分級：比對「所有(表記×讀音)組合」對上 tanos，取最簡單級別；命中的 tanos key 記入 matchedKeys。
 */
const loadVocab = (levelByKey, matchedKeys) => {
  const dict = JSON.parse(stripBom(readFromCache('jmdict-eng-full.json')));
  const posTags = dict.tags ?? {};
  const vocab = [];

  for (const word of dict.words) {
    const primaryKanji = word.kanji?.find((k) => k.common) ?? word.kanji?.[0] ?? null;
    const kanaForms = (word.kana ?? []).map((k) => k.text);
    const primaryKana =
      word.kana?.find(
        (k) => k.common && (!primaryKanji || k.appliesToKanji?.includes('*') || k.appliesToKanji?.includes(primaryKanji.text)),
      ) ?? word.kana?.find((k) => k.common) ?? word.kana?.[0] ?? null;
    if (!primaryKana) continue;

    const expression = primaryKanji ? primaryKanji.text : primaryKana.text;
    const reading = primaryKana.text;
    const firstSense = word.sense?.[0];
    if (!firstSense) continue;

    const gloss = (firstSense.gloss ?? []).filter((g) => g.lang === 'eng').map((g) => g.text).join('; ');
    if (!gloss) continue;
    const pos = (firstSense.partOfSpeech ?? []).map((code) => posTags[code] ?? code).join(', ');

    const writtenForms = (word.kanji ?? []).map((k) => k.text);
    const forms = writtenForms.length > 0 ? writtenForms : kanaForms;
    let jlpt = null;
    for (const form of forms) {
      for (const kana of kanaForms) {
        const level = levelByKey.get(key(form, kana));
        if (level != null) {
          matchedKeys.add(key(form, kana));
          jlpt = jlpt == null ? level : Math.max(jlpt, level);
        }
      }
    }

    vocab.push({ id: word.id, expression, reading, gloss, pos, jlpt });
  }
  return vocab;
};

/** Tanaka examples.utf → Map<headword, [{jp,en,len}]>（僅 vocab 詞，保留最短數句）。 */
const buildExampleIndex = (vocabExpressions) => {
  const index = new Map();
  const lines = stripBom(readFromCache('examples.utf')).split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].startsWith('A: ')) continue;
    const bLine = lines[i + 1];
    if (!bLine?.startsWith('B: ')) continue;
    const [jpRaw, enRaw] = lines[i].slice(3).split('\t');
    if (!jpRaw || !enRaw) continue;
    const jp = jpRaw.trim();
    const en = enRaw.split('#')[0].trim();
    if (jp.length < MIN_EXAMPLE_LEN || jp.length > MAX_EXAMPLE_LEN) continue;
    const heads = new Set(bLine.slice(3).trim().split(/\s+/).map((t) => t.split(/[([{~]/)[0]).filter(Boolean));
    for (const head of heads) {
      if (!vocabExpressions.has(head)) continue;
      const bucket = index.get(head) ?? [];
      bucket.push({ jp, en, len: jp.length });
      bucket.sort((a, b) => a.len - b.len);
      if (bucket.length > EXAMPLES_PER_HEADWORD) bucket.length = EXAMPLES_PER_HEADWORD;
      index.set(head, bucket);
    }
  }
  return index;
};

const buildTokenizer = () =>
  new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, tk) => (err ? reject(err) : resolve(tk)));
  });

/** 一句日文 → furigana 段落（kuromoji 斷詞 + JmdictFurigana 對位，整 token 後備）。 */
const sentenceFurigana = (sentence, tokenizer, furiganaIndex) => {
  const segments = [];
  for (const token of tokenizer.tokenize(sentence)) {
    const surface = token.surface_form;
    if (!hasKanji(surface)) { segments.push({ ruby: surface }); continue; }
    const reading = token.reading ? katakanaToHiragana(token.reading) : '';
    const aligned = reading ? furiganaIndex.get(key(surface, reading)) : undefined;
    if (aligned) segments.push(...aligned);
    else segments.push(reading ? { ruby: surface, rt: reading } : { ruby: surface });
  }
  return segments;
};

const SCHEMA = `
CREATE TABLE vocab (
  id TEXT PRIMARY KEY,
  expression TEXT NOT NULL,
  reading TEXT NOT NULL,
  furigana TEXT,
  gloss TEXT NOT NULL,
  pos TEXT,
  jlpt INTEGER,
  pitch INTEGER,
  freq_rank INTEGER,
  intro_rank INTEGER,
  is_jukugo INTEGER NOT NULL DEFAULT 0,
  is_common INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE kanji (
  char TEXT PRIMARY KEY,
  strokes TEXT NOT NULL,
  stroke_count INTEGER,
  grade INTEGER,
  jlpt INTEGER,
  frequency INTEGER,
  on_readings TEXT,
  kun_readings TEXT,
  meanings TEXT
);
CREATE TABLE example (
  id INTEGER PRIMARY KEY,
  jp TEXT NOT NULL,
  furigana TEXT NOT NULL,
  en TEXT NOT NULL
);
CREATE TABLE vocab_kanji (
  vocab_id TEXT NOT NULL,
  char TEXT NOT NULL,
  PRIMARY KEY (vocab_id, char)
);
CREATE TABLE vocab_example (
  vocab_id TEXT NOT NULL,
  example_id INTEGER NOT NULL,
  PRIMARY KEY (vocab_id, example_id)
);
CREATE TABLE decks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  tags TEXT,
  color TEXT,
  sort_order INTEGER,
  kind TEXT
);
CREATE TABLE deck_vocab (
  deck_id TEXT NOT NULL,
  vocab_id TEXT NOT NULL,
  position INTEGER,
  PRIMARY KEY (deck_id, vocab_id)
);
CREATE INDEX idx_vocab_jlpt ON vocab(jlpt);
CREATE INDEX idx_vocab_expr ON vocab(expression);
CREATE INDEX idx_vk_char ON vocab_kanji(char);
CREATE INDEX idx_ve_vocab ON vocab_example(vocab_id);
CREATE INDEX idx_deck_vocab_deck ON deck_vocab(deck_id);
`;

const main = async () => {
  console.log('--- 組裝正規化內容庫 (content DB) ---\n');

  const { levelByKey, records: jlptRecords } = loadJlptLevels();
  const furiganaIndex = loadFuriganaIndex();
  const strokesByKanji = loadStrokesByKanji();
  const kanjiMeta = loadKanjiMeta();

  const matchedJlptKeys = new Set();
  const vocab = loadVocab(levelByKey, matchedJlptKeys);
  console.log(`jmdict-common 詞數: ${vocab.length}`);

  // 補上「不在 common 子集」的 JLPT 詞（以 tanos 為來源），確保 JLPT 牌組完整。
  const seenTanos = new Set();
  let tanosAdded = 0;
  for (const rec of jlptRecords) {
    const k = key(rec.expr, rec.reading);
    if (matchedJlptKeys.has(k) || seenTanos.has(k)) continue;
    seenTanos.add(k);
    vocab.push({ id: `t-${rec.expr}-${rec.reading}`, expression: rec.expr, reading: rec.reading, gloss: rec.meaning, pos: null, jlpt: rec.level });
    tanosAdded += 1;
  }
  console.log(`補入 tanos JLPT 詞（common 未涵蓋）: ${tanosAdded}`);

  const vocabExpressions = new Set(vocab.map((v) => v.expression));
  const exampleIndex = buildExampleIndex(vocabExpressions);

  console.log('載入 kuromoji 字典中…');
  const tokenizer = await buildTokenizer();

  rmSync(OUTPUT_PATH, { force: true });
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const db = new DatabaseSync(OUTPUT_PATH);
  db.exec(SCRIPT_PRAGMA());
  db.exec(SCHEMA);

  const stats = { vocab: 0, jlpt: 0, furigana: 0, jukugo: 0, kanji: 0, example: 0, vkLinks: 0, veLinks: 0, decks: 0, deckVocab: 0 };

  // --- kanji table：vocab 用到的所有漢字 ∩ 有筆順者 ---
  const neededKanji = new Set(vocab.flatMap((v) => kanjiChars(v.expression)));
  const insKanji = db.prepare(
    `INSERT OR IGNORE INTO kanji (char, strokes, stroke_count, grade, jlpt, frequency, on_readings, kun_readings, meanings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  db.exec('BEGIN');
  for (const char of neededKanji) {
    const strokes = strokesByKanji.get(char);
    if (!strokes) continue; // 無筆順者跳過（罕用字）
    const meta = kanjiMeta.get(char) ?? {};
    insKanji.run(
      char, JSON.stringify(strokes), meta.strokeCount ?? null, meta.grade ?? null, meta.jlpt ?? null,
      meta.frequency ?? null, JSON.stringify(meta.on ?? []), JSON.stringify(meta.kun ?? []), JSON.stringify(meta.meanings ?? []),
    );
    stats.kanji += 1;
  }
  db.exec('COMMIT');
  const kanjiInDb = new Set(db.prepare('SELECT char FROM kanji').all().map((r) => r.char));

  // --- example table（去重）+ vocab + 連結 ---
  const insVocab = db.prepare(
    `INSERT INTO vocab (id, expression, reading, furigana, gloss, pos, jlpt, pitch, freq_rank, intro_rank, is_jukugo, is_common)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, 1)`,
  );
  const insExample = db.prepare('INSERT INTO example (jp, furigana, en) VALUES (?, ?, ?)');
  const insVk = db.prepare('INSERT OR IGNORE INTO vocab_kanji (vocab_id, char) VALUES (?, ?)');
  const insVe = db.prepare('INSERT OR IGNORE INTO vocab_example (vocab_id, example_id) VALUES (?, ?)');
  const exampleIdByJp = new Map();

  db.exec('BEGIN');
  const seenVocab = new Set();
  for (const v of vocab) {
    if (seenVocab.has(v.id)) continue;
    seenVocab.add(v.id);

    const furigana = furiganaIndex.get(key(v.expression, v.reading)) ?? null;
    const jlpt = v.jlpt ?? null;
    const chars = kanjiChars(v.expression);
    // 熟語 = 全是漢字的單字（每個字元都是漢字，不含假名/送假名）。
    const isJukugo = v.expression.length > 0 && [...v.expression].every(isKanji) ? 1 : 0;

    insVocab.run(
      v.id, v.expression, v.reading, furigana ? JSON.stringify(furigana) : null, v.gloss, v.pos || null,
      jlpt, isJukugo,
    );
    stats.vocab += 1;
    if (jlpt != null) stats.jlpt += 1;
    if (furigana) stats.furigana += 1;
    if (isJukugo) stats.jukugo += 1;

    for (const char of chars) {
      if (kanjiInDb.has(char)) { insVk.run(v.id, char); stats.vkLinks += 1; }
    }

    // B-line 已把活用形對回辭書形 headword，故 exampleIndex.get(v.expression) 的句子必含此詞；
    // 不再用 jp.includes 過濾表層文字（那會誤殺活用/假名漢字不一致的正確例句）。
    const candidates = (exampleIndex.get(v.expression) ?? []).slice(0, MAX_EXAMPLES_PER_VOCAB);
    for (const cand of candidates) {
      let exId = exampleIdByJp.get(cand.jp);
      if (exId === undefined) {
        const furi = sentenceFurigana(cand.jp, tokenizer, furiganaIndex);
        exId = insExample.run(cand.jp, JSON.stringify(furi), cand.en).lastInsertRowid;
        exampleIdByJp.set(cand.jp, exId);
        stats.example += 1;
      }
      insVe.run(v.id, exId);
      stats.veLinks += 1;
    }
  }
  db.exec('COMMIT');

  // --- decks + deck_vocab：資料驅動的牌組目錄與成員（取代寫死）。JLPT 牌組依 jlpt 灌成員，position 留 NULL（由 vocab.intro_rank 排序）。 ---
  db.exec('BEGIN');
  const insDeck = db.prepare(
    'INSERT INTO decks (id, name, description, tags, color, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const insDeckVocab = db.prepare('INSERT OR IGNORE INTO deck_vocab (deck_id, vocab_id, position) VALUES (?, ?, NULL)');
  JLPT_DECK_META.forEach((deck, order) => {
    insDeck.run(deck.id, deck.name, deck.description, JSON.stringify(deck.tags), deck.color, order, 'jlpt');
    const members = db.prepare('SELECT id FROM vocab WHERE jlpt = ?').all(deck.level);
    for (const member of members) insDeckVocab.run(deck.id, member.id);
    stats.deckVocab += members.length;
  });
  stats.decks = JLPT_DECK_META.length;
  db.exec('COMMIT');

  db.close();

  const pct = (n) => `${((n / stats.vocab) * 100).toFixed(1)}%`;
  console.log(`\n寫入 ${OUTPUT_PATH}`);
  console.log(`vocab: ${stats.vocab}（JLPT 標記 ${stats.jlpt} / ${pct(stats.jlpt)}、熟語 ${stats.jukugo}）`);
  console.log(`  furigana: ${stats.furigana}（${pct(stats.furigana)}）　pitch/freq_rank/intro_rank 由 enrich-pitch-freq.py 填入`);
  console.log(`kanji: ${stats.kanji}　example: ${stats.example}`);
  console.log(`連結 vocab_kanji: ${stats.vkLinks}　vocab_example: ${stats.veLinks}`);
  console.log(`牌組 decks: ${stats.decks}　deck_vocab: ${stats.deckVocab}`);
  console.log('\n✅ 內容庫組裝完成');
};

// SQLite 建置期最佳化（更快寫入、較小檔案）。
function SCRIPT_PRAGMA() {
  return 'PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;';
}

main().catch((error) => {
  console.error('❌ ETL 失敗:', error.message);
  process.exit(1);
});
