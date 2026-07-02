// Harness：對「本機內容庫」跑與 src/api/contentApi.ts 門面「相同的 SQL + row→物件映射」，
// 斷言回傳形狀符合 Api* 契約（envelope 拆封後形狀、nullable、count vs vocabCount、JSON 欄位可解析）。
//
// 用 node:sqlite（Node 22）ATTACH 內容庫為別名 content，執行與 App 完全相同的查詢字串。
// 執行：node scripts/verify-content-repos.mjs [content-db-path]
//   預設路徑：../../server/data/kioku-content.db
//
// 這是離線化的「乾跑」驗證：不需啟動 App / 模擬器即可證明資料層正確。

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.argv[2] ?? resolve(HERE, '../assets/db/kioku-content.db');
const CONTENT_VERSION = 'v4';
const C = 'content';
const VOCAB_COLS = 'id, expression, reading, furigana, gloss, pos, jlpt, pitch, freq_rank, intro_rank, is_jukugo';
const VOCAB_COLS_V =
  'v.id, v.expression, v.reading, v.furigana, v.gloss, v.pos, v.jlpt, v.pitch, v.freq_rank, v.intro_rank, v.is_jukugo';

let passed = 0;
let failed = 0;
const check = (label, condition, detail = '') => {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};

// --- 映射（對照 contentApi 門面）---
const parseJsonOrNull = (raw) => (typeof raw === 'string' && raw.length > 0 ? JSON.parse(raw) : null);
const parseJsonArray = (raw) => (typeof raw === 'string' && raw.length > 0 ? JSON.parse(raw) : []);
const rowToVocab = (row) => ({
  id: row.id,
  expression: row.expression,
  reading: row.reading,
  furigana: parseJsonOrNull(row.furigana),
  gloss: row.gloss,
  pos: row.pos ?? null,
  jlpt: row.jlpt ?? null,
  pitch: row.pitch ?? null,
  freqRank: row.freq_rank ?? null,
  introRank: row.intro_rank ?? null,
  isJukugo: Boolean(row.is_jukugo),
});
const rowToKanji = (row) => ({
  char: row.char,
  strokes: parseJsonArray(row.strokes),
  strokeCount: row.stroke_count ?? null,
  jlpt: row.jlpt ?? null,
  on: parseJsonArray(row.on_readings),
  kun: parseJsonArray(row.kun_readings),
  meanings: parseJsonArray(row.meanings),
});

// --- 形狀斷言 ---
const isStr = (v) => typeof v === 'string';
const isNum = (v) => typeof v === 'number';
const isNumOrNull = (v) => v === null || typeof v === 'number';
const isStrOrNull = (v) => v === null || typeof v === 'string';
const isFuriganaArr = (v) => Array.isArray(v) && v.every((c) => c && isStr(c.ruby) && (c.rt === undefined || isStr(c.rt)));
const assertVocab = (v, ctx) => {
  check(`${ctx}: id/expression/reading/gloss strings`, isStr(v.id) && isStr(v.expression) && isStr(v.reading) && isStr(v.gloss));
  check(`${ctx}: furigana null|FuriganaChunk[]`, v.furigana === null || isFuriganaArr(v.furigana), JSON.stringify(v.furigana)?.slice(0, 60));
  check(`${ctx}: pos str|null`, isStrOrNull(v.pos));
  check(`${ctx}: jlpt/pitch/freqRank/introRank num|null`, isNumOrNull(v.jlpt) && isNumOrNull(v.pitch) && isNumOrNull(v.freqRank) && isNumOrNull(v.introRank));
  check(`${ctx}: isJukugo boolean`, typeof v.isJukugo === 'boolean');
};

const run = () => {
  if (!existsSync(DB_PATH)) {
    console.error(`❌ 找不到內容庫：${DB_PATH}`);
    process.exit(1);
  }
  console.log(`內容庫：${DB_PATH}\n`);
  const db = new DatabaseSync(':memory:');
  db.exec(`ATTACH DATABASE '${DB_PATH}' AS ${C}`);

  // 1. fetchDecks
  console.log('fetchDecks');
  const deckRows = db.prepare(`SELECT id, name, description, tags, color, sort_order, kind FROM ${C}.decks ORDER BY sort_order`).all();
  check('decks: 回傳 9 包', deckRows.length === 9, `got ${deckRows.length}`);
  const decks = deckRows.map((row) => {
    const c = db.prepare(`SELECT COUNT(*) AS c FROM ${C}.deck_vocab WHERE deck_id = ?`).get(row.id).c;
    return { id: row.id, name: row.name, description: row.description ?? '', tags: parseJsonArray(row.tags), color: row.color, sortOrder: row.sort_order, kind: row.kind, count: c, version: CONTENT_VERSION };
  });
  for (const d of decks) {
    check(`deck ${d.id}: name/color/kind strings`, isStr(d.name) && isStr(d.color) && isStr(d.kind));
    check(`deck ${d.id}: tags string[]`, Array.isArray(d.tags) && d.tags.every(isStr));
    check(`deck ${d.id}: count>0`, isNum(d.count) && d.count > 0, `count=${d.count}`);
    check(`deck ${d.id}: sortOrder number`, isNum(d.sortOrder));
    check(`deck ${d.id}: version=${CONTENT_VERSION}`, d.version === CONTENT_VERSION);
  }

  // 2. fetchDeckVocab('deck-n5', 5)
  console.log('fetchDeckVocab(deck-n5, 5)');
  const dvRows = db.prepare(
    `SELECT ${VOCAB_COLS_V} FROM ${C}.deck_vocab dv JOIN ${C}.vocab v ON dv.vocab_id = v.id WHERE dv.deck_id = ? ORDER BY dv.position IS NULL, dv.position ASC, v.intro_rank IS NULL, v.intro_rank ASC LIMIT ?`,
  ).all('deck-n5', 5);
  check('deckVocab: 5 筆', dvRows.length === 5, `got ${dvRows.length}`);
  dvRows.map(rowToVocab).forEach((v, i) => assertVocab(v, `deckVocab[${i}]`));

  // 3. fetchDeckMembers('deck-n5') — 裸陣列 {id, introRank}
  console.log('fetchDeckMembers(deck-n5)');
  const memberRows = db.prepare(`SELECT v.id, v.intro_rank FROM ${C}.deck_vocab dv JOIN ${C}.vocab v ON dv.vocab_id = v.id WHERE dv.deck_id = ? ORDER BY v.intro_rank IS NULL, v.intro_rank ASC`).all('deck-n5');
  const members = memberRows.map((row) => ({ id: row.id, introRank: row.intro_rank ?? null }));
  check('members: 非空', members.length > 0, `got ${members.length}`);
  check('members: 每筆 {id:str, introRank:num|null}', members.every((m) => isStr(m.id) && isNumOrNull(m.introRank)));

  // 4. fetchVocabByIds(前 3 個成員 id)
  console.log('fetchVocabByIds([3 ids])');
  const ids = members.slice(0, 3).map((m) => m.id);
  const placeholders = ids.map(() => '?').join(',');
  const byIdRows = db.prepare(`SELECT ${VOCAB_COLS} FROM ${C}.vocab WHERE id IN (${placeholders})`).all(...ids);
  check('byIds: 取回 3 筆', byIdRows.length === 3, `got ${byIdRows.length}`);
  byIdRows.map(rowToVocab).forEach((v, i) => assertVocab(v, `byIds[${i}]`));

  // 5. fetchVocabDetail(第一個 id) — 裸物件 + examples[] + kanji[]
  console.log(`fetchVocabDetail(${ids[0]})`);
  const base = db.prepare(`SELECT ${VOCAB_COLS} FROM ${C}.vocab WHERE id = ?`).get(ids[0]);
  check('detail: base 存在', !!base);
  if (base) {
    const exRows = db.prepare(`SELECT e.jp, e.furigana, e.en FROM ${C}.example e JOIN ${C}.vocab_example ve ON e.id = ve.example_id WHERE ve.vocab_id = ?`).all(ids[0]);
    const examples = exRows.map((r) => ({ jp: r.jp, furigana: parseJsonArray(r.furigana), en: r.en }));
    const kanjiRows = db.prepare(`SELECT k.char, k.strokes, k.stroke_count, k.jlpt, k.on_readings, k.kun_readings, k.meanings FROM ${C}.kanji k JOIN ${C}.vocab_kanji vk ON k.char = vk.char WHERE vk.vocab_id = ?`).all(ids[0]);
    const kanji = kanjiRows.map(rowToKanji);
    const detail = { ...rowToVocab(base), examples, kanji };
    assertVocab(detail, 'detail');
    check('detail: examples ApiExample[]', Array.isArray(detail.examples) && detail.examples.every((e) => isStr(e.jp) && isStr(e.en) && isFuriganaArr(e.furigana)));
    check('detail: kanji ApiKanji[]', Array.isArray(detail.kanji) && detail.kanji.every((k) => isStr(k.char) && Array.isArray(k.strokes) && k.strokes.every(isStr) && Array.isArray(k.on) && Array.isArray(k.kun) && Array.isArray(k.meanings) && isNumOrNull(k.strokeCount) && isNumOrNull(k.jlpt)));
  }

  // 6. fetchKanjiWords('日',10) / fetchKanjiExamples('日',5)
  console.log('fetchKanjiWords(日,10) / fetchKanjiExamples(日,5)');
  const kwRows = db.prepare(`SELECT ${VOCAB_COLS_V} FROM ${C}.vocab v JOIN ${C}.vocab_kanji vk ON v.id = vk.vocab_id WHERE vk.char = ? LIMIT ?`).all('日', 10);
  check('kanjiWords: 非空', kwRows.length > 0, `got ${kwRows.length}`);
  kwRows.map(rowToVocab).forEach((v, i) => assertVocab(v, `kanjiWords[${i}]`));
  const keRows = db.prepare(`SELECT id, jp, furigana, en FROM ${C}.example WHERE jp LIKE ? LIMIT ?`).all('%日%', 5);
  check('kanjiExamples: 非空', keRows.length > 0, `got ${keRows.length}`);
  const kExamples = keRows.map((r) => ({ id: r.id, jp: r.jp, furigana: parseJsonArray(r.furigana), en: r.en }));
  check('kanjiExamples: {id:num, jp/en:str, furigana:[]}', kExamples.every((e) => isNum(e.id) && isStr(e.jp) && isStr(e.en) && isFuriganaArr(e.furigana)));

  // 7. fetchSearch('日',10) — {query, vocab[], kanji[], decks[]}
  console.log('fetchSearch(日,10)');
  const like = '%日%';
  const prefix = '日%';
  const svRows = db.prepare(`SELECT id, expression, reading, gloss, jlpt FROM ${C}.vocab WHERE expression LIKE ? OR reading LIKE ? OR gloss LIKE ? ORDER BY CASE WHEN expression = ? OR reading = ? THEN 1 WHEN expression LIKE ? OR reading LIKE ? THEN 2 ELSE 3 END LIMIT ?`).all(like, like, like, '日', '日', prefix, prefix, 10);
  const skRows = db.prepare(`SELECT char, meanings, on_readings, kun_readings FROM ${C}.kanji WHERE char LIKE ? OR meanings LIKE ? OR on_readings LIKE ? OR kun_readings LIKE ? LIMIT ?`).all(like, like, like, like, 10);
  const sdRows = db.prepare(`SELECT d.id, d.name, d.description, d.tags, d.color, COUNT(DISTINCT v.id) AS vocab_count FROM ${C}.decks d LEFT JOIN ${C}.deck_vocab dv ON dv.deck_id = d.id LEFT JOIN ${C}.vocab v ON v.id = dv.vocab_id AND (v.expression LIKE ? OR v.reading LIKE ? OR v.gloss LIKE ?) WHERE d.name LIKE ? OR d.description LIKE ? OR v.id IS NOT NULL GROUP BY d.id, d.name, d.description, d.tags, d.color, d.sort_order ORDER BY d.sort_order LIMIT ?`).all(like, like, like, like, like, 10);
  const search = {
    query: '日',
    vocab: svRows.map((r) => ({ id: r.id, expression: r.expression, reading: r.reading, gloss: r.gloss, jlpt: r.jlpt ?? null })),
    kanji: skRows.map((r) => ({ char: r.char, meanings: parseJsonArray(r.meanings), on: parseJsonArray(r.on_readings), kun: parseJsonArray(r.kun_readings) })),
    decks: sdRows.map((r) => ({ id: r.id, name: r.name, description: r.description ?? '', tags: parseJsonArray(r.tags), color: r.color, vocabCount: r.vocab_count })),
  };
  check('search: query 回傳', search.query === '日');
  check('search: vocab 非空且形狀正確', search.vocab.length > 0 && search.vocab.every((v) => isStr(v.id) && isStr(v.expression) && isStr(v.reading) && isStr(v.gloss) && isNumOrNull(v.jlpt)));
  check('search: kanji 形狀正確', search.kanji.every((k) => isStr(k.char) && Array.isArray(k.meanings) && Array.isArray(k.on) && Array.isArray(k.kun)));
  check('search: decks vocabCount(非 count) number', search.decks.every((d) => isNum(d.vocabCount) && d.vocabCount !== undefined));

  db.close();
  console.log(`\n${failed === 0 ? '✅' : '❌'} content-repos: ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

run();
