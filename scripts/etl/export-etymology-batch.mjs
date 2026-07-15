// 匯出下一批待生成「詞源（語源）」的 vocab（附讀音／詞義／詞性上下文），供 session 內 LLM 生成。
// 只選 vocab_etymology 尚無資料者，可續跑。第一階段範圍：JLPT N5–N4（jlpt >= 4），依 N5→N4＋頻率排序。
// 用法：node scripts/etl/export-etymology-batch.mjs --out <file> [--limit 20]
//
// 生成規範（給 session 內 LLM）：
//   - 無可靠語源學說 → 該詞輸出 {"n": <n>, "skip": true}，寧缺勿錯。
//   - evolution.stages 每段 reading 一律純ひらがな（不用羅馬字），最末段 reading 須等於詞條 reading。
//   - 雙語內文僅 note 與 explanation：explanation_zh（台灣繁中）＋ explanation_en 同批產出，
//     stage 的 note 另附 note_en。App 依語言設定切換，缺譯退回繁中。
//   - stage 的 period 用日文術語（上代語、中古中国語、近世（江戸）…），不做雙語。
//   - confidence ∈ 定説|有力説|一説|俗説；origin_type ∈ 音変化|意味変化|漢語|複合語|派生語|外来語|オノマトペ（一律日文）。
//   - 著作權：explanation／note 須為原創改寫（陳述學說事實），嚴禁逐字轉錄辭典或網站原文；
//     source 僅為學說出處的引用標注，非內容授權來源。
//   - source：該學說可查證的出處名稱（如「日本国語大辞典」「語源由来辞典」），無明確出處可為 null。
//   - source_url：出處的 https 連結（App 內可點開）；無則 null。有 source_url 必須同時有 source 名稱。

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTENT_DB_PATH = join(SCRIPT_DIR, '..', '..', 'assets', 'db', 'kioku-content.db');
// 已審定「無可靠學說」的跳過清單（apply-etymology.mjs 維護），續跑時排除、避免重複送審。
const SKIPLIST_PATH = join(SCRIPT_DIR, 'etymology-skiplist.json');

const DEFAULT_LIMIT = 20;
const MIN_JLPT_LEVEL = 4; // 第一階段：N5（5）與 N4（4）

const args = process.argv.slice(2);
const getFlagValue = (flag) => {
  const flagIndex = args.indexOf(flag);
  return flagIndex >= 0 ? args[flagIndex + 1] : undefined;
};
const outPath = getFlagValue('--out');
const limit = Number(getFlagValue('--limit') ?? DEFAULT_LIMIT);
if (!outPath) {
  console.error('用法：node scripts/etl/export-etymology-batch.mjs --out <file> [--limit 20]');
  process.exit(1);
}

const db = new DatabaseSync(CONTENT_DB_PATH, { readOnly: true });

// vocab_etymology 可能尚未建表（首批）；動態偵測，不存在時視為全數待生成。
const etymologyTableExists = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'vocab_etymology'")
  .all()
  .length > 0;
const pendingClause = etymologyTableExists
  ? 'AND v.id NOT IN (SELECT vocab_id FROM vocab_etymology)'
  : '';

const skiplist = new Set(
  existsSync(SKIPLIST_PATH) ? JSON.parse(readFileSync(SKIPLIST_PATH, 'utf-8')) : [],
);

// skiplist 以 JS 過濾（非 SQL IN）：清單小且避免動態拼 SQL；多撈 skiplist 長度以補足 limit。
const rows = db
  .prepare(
    `SELECT v.id, v.expression, v.reading, v.gloss, v.gloss_zh, v.pos FROM vocab v
     WHERE v.jlpt >= ? ${pendingClause}
     ORDER BY v.jlpt DESC, v.freq_rank IS NULL, v.freq_rank ASC, v.intro_rank
     LIMIT ?`,
  )
  .all(MIN_JLPT_LEVEL, limit + skiplist.size)
  .filter((row) => !skiplist.has(row.id))
  .slice(0, limit);
db.close();

const items = rows.map((row, i) => ({
  n: i + 1, // 1-based 序號：結果檔用 n 對回，免手打長 id。
  id: row.id,
  word: row.expression,
  reading: row.reading,
  pos: row.pos ?? '',
  gloss_en: row.gloss,
  gloss_zh: row.gloss_zh ?? '',
}));
writeFileSync(outPath, JSON.stringify(items, null, 1));
console.log(`匯出 ${items.length} 筆 → ${outPath}`);
