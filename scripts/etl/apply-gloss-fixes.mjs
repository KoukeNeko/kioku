// 單詞繁中詞義手動修正（gloss_zh）。用於「app 顯示英文／舊譯不佳」的個別詞條精修。
// 以 {expression, reading} 為鍵，冪等：重跑只覆寫表列詞條。同步寫 gloss_zh 與 gloss_zh_v2（暫存欄一致）。
// 用法：node scripts/etl/apply-gloss-fixes.mjs
// 新增修正 → 在 GLOSS_FIXES 追加一列即可。

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTENT_DB_PATH = join(SCRIPT_DIR, '..', '..', 'assets', 'db', 'kioku-content.db');

// 台灣繁體用法；翻日文詞本身、涵蓋主要義項、以全形「；」分隔、必要時以（）標語域/語感。
const GLOSS_FIXES = [
  {
    expression: '葛藤',
    reading: 'かっとう',
    gloss_zh: '（人際）糾葛、衝突、對立、不和；（內心）矛盾、掙扎、天人交戰、左右為難',
  },
  {
    expression: '葛藤',
    reading: 'つづらふじ',
    gloss_zh: '青藤；漢防己（一種藥用藤本植物，Sinomenium acutum）',
  },
  {
    expression: '筆',
    reading: 'ふで',
    gloss_zh: '毛筆；畫筆；（書寫用的）筆',
  },
  {
    expression: '滑る',
    reading: 'すべる',
    gloss_zh: '滑；滑動；滑行（滑雪、溜冰）；（口）落榜；（笑話）冷場',
  },
];

const db = new DatabaseSync(CONTENT_DB_PATH);

// gloss_zh_v2 暫存欄可能不存在（未跑過重譯流程時）；動態偵測避免 UPDATE 失敗。
const hasV2 = db.prepare('PRAGMA table_info(vocab)').all().some((c) => c.name === 'gloss_zh_v2');

const updateSql = hasV2
  ? 'UPDATE vocab SET gloss_zh = ?, gloss_zh_v2 = ? WHERE expression = ? AND reading = ?'
  : 'UPDATE vocab SET gloss_zh = ? WHERE expression = ? AND reading = ?';
const stmt = db.prepare(updateSql);

let applied = 0;
const missed = [];
for (const fix of GLOSS_FIXES) {
  const info = hasV2
    ? stmt.run(fix.gloss_zh, fix.gloss_zh, fix.expression, fix.reading)
    : stmt.run(fix.gloss_zh, fix.expression, fix.reading);
  if (info.changes > 0) {
    applied += info.changes;
    console.log(`  ✓ ${fix.expression}（${fix.reading}）→ ${fix.gloss_zh}`);
  } else {
    missed.push(`${fix.expression}（${fix.reading}）`);
  }
}

db.close();

if (missed.length > 0) {
  console.warn(`⚠️ 找不到對應詞條（未更新）：${missed.join('、')}`);
}
console.log(JSON.stringify({ fixes: GLOSS_FIXES.length, applied }));
