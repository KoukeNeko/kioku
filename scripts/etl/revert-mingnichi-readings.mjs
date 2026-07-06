// 把例句裡「明日」的 furigana 讀音回退成基底建置（kuromoji）會產生的值。
//
// 背景：fix-example-furigana.mjs 曾把 明日 一律壓成 あした，apply-asu-readings.mjs 又把部分句
// 依語境改成 あす。此腳本只針對「明日」一詞、逐句用 kuromoji 重算原始讀音並就地換回，
// 句中其他詞（明後日→あさって、B 行標註…）與所有繁中翻譯（zh 欄位）一律不動。
//
// 「原始讀音」定義：與 build-content-db.mjs 的 sentenceFurigana 完全一致 —— kuromoji 斷詞取
// token.reading（轉平假名），再用 JmdictFurigana 對位；對不上就退成整詞 {ruby,rt}。
//
// 冪等：已是原始讀音的句子不動。預設 dry-run（不寫庫）；加 --apply 才寫入交易。
// 用法：node scripts/etl/revert-mingnichi-readings.mjs [--apply]

import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const require = createRequire(import.meta.url);
const kuromoji = require('kuromoji');

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(SCRIPT_DIR, '.cache');
const APP_ROOT = join(SCRIPT_DIR, '..', '..');
const CONTENT_DB_PATH = join(APP_ROOT, 'assets', 'db', 'kioku-content.db');
const KUROMOJI_DICT_PATH = join(APP_ROOT, 'node_modules', 'kuromoji', 'dict');

const TARGET_WORD = '明日';
const APPLY = process.argv.slice(2).includes('--apply');

// —— 以下常數與小函式逐位元對齊 build-content-db.mjs，確保「原始讀音」定義一致 ——
const UTF8_BOM = '﻿';
const SEP = '\t';
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x60;

const stripBom = (text) => (text.startsWith(UTF8_BOM) ? text.slice(1) : text);
const key = (word, reading) => `${word}${SEP}${reading}`;
const katakanaToHiragana = (text) =>
  [...text]
    .map((ch) => {
      const code = ch.codePointAt(0);
      return code >= KATAKANA_START && code <= KATAKANA_END ? String.fromCodePoint(code - HIRAGANA_OFFSET) : ch;
    })
    .join('');

const loadFuriganaIndex = () => {
  const index = new Map();
  for (const entry of JSON.parse(stripBom(readFileSync(join(CACHE_DIR, 'JmdictFurigana.json'), 'utf-8')))) {
    index.set(key(entry.text, entry.reading), entry.furigana);
  }
  return index;
};

const buildTokenizer = () =>
  new Promise((resolve, reject) => {
    kuromoji.builder({ dicPath: KUROMOJI_DICT_PATH }).build((err, tk) => (err ? reject(err) : resolve(tk)));
  });

/** kuromoji 對句中每個「明日」token 的原始讀音：Map<字元起始位置(0-based), 平假名讀音>。 */
const originalReadingsByPos = (sentence, tokenizer) => {
  const byPos = new Map();
  for (const token of tokenizer.tokenize(sentence)) {
    if (token.surface_form !== TARGET_WORD || !token.reading) continue;
    byPos.set(token.word_position - 1, katakanaToHiragana(token.reading));
  }
  return byPos;
};

/** segments 各段的起始字元位置（boundaries[i]=第 i 段起點；末位=總長）。 */
const segmentBoundaries = (segments) => {
  const boundaries = [];
  let cursor = 0;
  for (const seg of segments) {
    boundaries.push(cursor);
    cursor += seg.ruby.length;
  }
  boundaries.push(cursor);
  return boundaries;
};

/** [startIdx,endIdx) 這段目前拼出的讀音（rt 缺省=原文即讀音）。 */
const readingOfRange = (segments, startIdx, endIdx) =>
  segments.slice(startIdx, endIdx).map((seg) => seg.rt ?? seg.ruby).join('');

/**
 * 把句中每個「明日」出現位置換回其 kuromoji 原始讀音。
 * 僅當該位置恰好對齊現有段落邊界、且現讀音 ≠ 原始讀音時才置換（置換不改變字元總長，位置持續有效）。
 * 回傳 { segments, changes:[{from,to}] }；changes 為空代表無需變動。
 */
const revertWord = (segments, jp, byPos, furiganaIndex) => {
  const changes = [];
  let searchFrom = 0;
  while (true) {
    const pos = jp.indexOf(TARGET_WORD, searchFrom);
    if (pos < 0) break;
    searchFrom = pos + 1;

    const original = byPos.get(pos);
    if (!original) continue; // kuromoji 在此未切出獨立的「明日」token（併入更大詞），無法界定原始讀音

    const boundaries = segmentBoundaries(segments);
    const startIdx = boundaries.indexOf(pos);
    const endIdx = boundaries.indexOf(pos + TARGET_WORD.length);
    if (startIdx < 0 || endIdx < 0) continue; // 現有 furigana 未對齊邊界，跳過（不做跨段落切割）

    const current = readingOfRange(segments, startIdx, endIdx);
    if (current === original) continue; // 已是原始讀音

    const replacement = furiganaIndex.get(key(TARGET_WORD, original)) ?? [{ ruby: TARGET_WORD, rt: original }];
    segments = [...segments.slice(0, startIdx), ...replacement, ...segments.slice(endIdx)];
    changes.push({ from: current, to: original });
  }
  return { segments, changes };
};

const run = async () => {
  console.log(`載入 kuromoji 與 JmdictFurigana…（模式：${APPLY ? 'APPLY 寫庫' : 'DRY-RUN 只報告'}）`);
  const [tokenizer, furiganaIndex] = await Promise.all([buildTokenizer(), Promise.resolve(loadFuriganaIndex())]);

  const db = new DatabaseSync(CONTENT_DB_PATH);
  const rows = db.prepare(`SELECT id, jp, furigana FROM example WHERE jp LIKE ?`).all(`%${TARGET_WORD}%`);
  const update = db.prepare('UPDATE example SET furigana = ? WHERE id = ?');

  const plans = [];
  const tally = new Map(); // "from→to" → count
  let skippedNoToken = 0;
  for (const row of rows) {
    let segments;
    try {
      segments = JSON.parse(row.furigana);
    } catch {
      continue;
    }
    if (!Array.isArray(segments)) continue;

    const byPos = originalReadingsByPos(row.jp, tokenizer);
    if (byPos.size === 0) skippedNoToken += 1;

    const { segments: next, changes } = revertWord(segments, row.jp, byPos, furiganaIndex);
    if (changes.length === 0) continue;
    plans.push({ id: row.id, jp: row.jp, changes, next });
    for (const change of changes) {
      const label = `${change.from}→${change.to}`;
      tally.set(label, (tally.get(label) ?? 0) + 1);
    }
  }

  console.log(`\n含「明日」例句：${rows.length}　需回退：${plans.length} 句　（kuromoji 未切出獨立明日 token：${skippedNoToken} 句）`);
  console.log('讀音變動分佈：');
  for (const [label, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label.padEnd(12)} ${count}`);
  }
  console.log('\n前 15 筆預覽：');
  for (const plan of plans.slice(0, 15)) {
    console.log(`  #${plan.id}  ${plan.changes.map((c) => `${c.from}→${c.to}`).join(', ')}  ${plan.jp.slice(0, 32)}`);
  }

  if (!APPLY) {
    console.log('\n（DRY-RUN，未寫入。確認無誤後加 --apply 執行。）');
    db.close();
    return;
  }

  db.exec('BEGIN');
  for (const plan of plans) update.run(JSON.stringify(plan.next), plan.id);
  db.exec('COMMIT');
  db.close();
  console.log(`\n✅ 已回退 ${plans.length} 句的「明日」讀音。`);
};

run().catch((error) => {
  console.error('❌ 執行失敗：', error);
  process.exit(1);
});
