// 逐句「あす」策展 override：把清單中指定例句的「明日」讀音設為 あす。
//
// 定位：revert-mingnichi-readings.mjs 把所有 明日 拉回 kuromoji 基準（一律 あした）；
// 本清單再針對「人工判定該讀 あす」的個別句子做例外覆寫。清單 committed 於此檔，
// 可重現、DB 重建後重跑即可還原（不像先前 asu-0001.json 遺失後就無法復原）。
//
// 冪等：已是 あす 的句子不動。預設 dry-run（不寫庫）；加 --apply 才寫入。
// 執行順序：revert-mingnichi-readings.mjs 之後。用法：node scripts/etl/apply-asu-overrides.mjs [--apply]
//
// 要新增 override：把日文原句（與 example.jp 完全一致）加進 ASU_SENTENCES。
const ASU_SENTENCES = [
  '明日遊びにいらっしゃい。',
];

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(SCRIPT_DIR, '.cache');
const CONTENT_DB_PATH = join(SCRIPT_DIR, '..', '..', 'assets', 'db', 'kioku-content.db');

const TARGET_WORD = '明日';
const TARGET_READING = 'あす';
const APPLY = process.argv.slice(2).includes('--apply');

const SEP = '\t';
const stripBom = (text) => (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
const key = (word, reading) => `${word}${SEP}${reading}`;

/** JmdictFurigana 對 (明日, あす) 的段落；缺則退成整詞 {ruby,rt}。 */
const loadAsuSegments = () => {
  for (const entry of JSON.parse(stripBom(readFileSync(join(CACHE_DIR, 'JmdictFurigana.json'), 'utf-8')))) {
    if (entry.text === TARGET_WORD && entry.reading === TARGET_READING) return entry.furigana;
  }
  return [{ ruby: TARGET_WORD, rt: TARGET_READING }];
};

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

const readingOfRange = (segments, startIdx, endIdx) =>
  segments.slice(startIdx, endIdx).map((seg) => seg.rt ?? seg.ruby).join('');

/** 把句中每個「明日」出現位置改成 あす（僅在對齊段落邊界、且現讀音 ≠ あす 時置換）。 */
const overrideToAsu = (segments, jp, asuSegments) => {
  const changes = [];
  let searchFrom = 0;
  while (true) {
    const pos = jp.indexOf(TARGET_WORD, searchFrom);
    if (pos < 0) break;
    searchFrom = pos + 1;

    const boundaries = segmentBoundaries(segments);
    const startIdx = boundaries.indexOf(pos);
    const endIdx = boundaries.indexOf(pos + TARGET_WORD.length);
    if (startIdx < 0 || endIdx < 0) continue;

    const current = readingOfRange(segments, startIdx, endIdx);
    if (current === TARGET_READING) continue;

    segments = [...segments.slice(0, startIdx), ...asuSegments, ...segments.slice(endIdx)];
    changes.push({ from: current, to: TARGET_READING });
  }
  return { segments, changes };
};

const run = () => {
  console.log(`模式：${APPLY ? 'APPLY 寫庫' : 'DRY-RUN 只報告'}　override 清單：${ASU_SENTENCES.length} 句`);
  const asuSegments = loadAsuSegments();
  const db = new DatabaseSync(CONTENT_DB_PATH);
  const select = db.prepare('SELECT id, jp, furigana FROM example WHERE jp = ?');
  const update = db.prepare('UPDATE example SET furigana = ? WHERE id = ?');

  const plans = [];
  for (const jp of ASU_SENTENCES) {
    const rows = select.all(jp);
    if (rows.length === 0) {
      console.log(`  ⚠️ 找不到例句（jp 需與 DB 完全一致）：${jp}`);
      continue;
    }
    for (const row of rows) {
      let segments;
      try {
        segments = JSON.parse(row.furigana);
      } catch {
        continue;
      }
      const { segments: next, changes } = overrideToAsu(segments, row.jp, asuSegments);
      if (changes.length === 0) {
        console.log(`  = #${row.id} 已是 あす，不動：${row.jp}`);
        continue;
      }
      plans.push({ id: row.id, jp: row.jp, next });
      console.log(`  → #${row.id} ${changes.map((c) => `${c.from}→${c.to}`).join(', ')}：${row.jp}`);
    }
  }

  if (!APPLY) {
    console.log(`\n（DRY-RUN，${plans.length} 句待寫入。加 --apply 執行。）`);
    db.close();
    return;
  }

  db.exec('BEGIN');
  for (const plan of plans) update.run(JSON.stringify(plan.next), plan.id);
  db.exec('COMMIT');
  db.close();
  console.log(`\n✅ 已套用 ${plans.length} 句 あす override。`);
};

run();
