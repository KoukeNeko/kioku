// 詞條策展修正：tanos JLPT 清單合成詞條（id t-*）的人工修正表。
//
// 背景：tanos CSV 對不上 JMdict 的詞會被合成為 t-* 後備詞條。少數列的假名詞頭
// 與該假名最常見的詞義嚴重打架，卡片會誤導（實例：N2「する」釋義 to print，
// 實為 刷る，慣用漢字書寫；且與超高頻的 する〔做〕撞名，連 pitch 都錯）。
//
// 修正表為人工審核後逐筆收錄（來源以 JMdict 對應詞條為準），隨 repo 提交，
// content:build 重建後重跑本腳本即可重現。冪等：值已相同則跳過。
// 用法：node scripts/etl/apply-vocab-curation.mjs

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const CONTENT_DB_PATH = join(SCRIPT_DIR, '..', '..', 'assets', 'db', 'kioku-content.db');

// 每筆：id = 目標詞條、reason = 為何要修（審核紀錄）、set = 要覆寫的欄位值。
// 值以 JMdict 對應詞條為準（reason 內註明來源 id），不即時查表——確保本表獨立可審。
const CURATION_FIXES = [
  {
    id: 't-する-する',
    reason: 'tanos N2 假名詞頭「する」實為 刷る（to print，JMdict 1298670）；與 する〔做〕撞名誤導，pitch 應為 [1]',
    set: {
      expression: '刷る',
      furigana: '[{"ruby":"刷","rt":"す"},{"ruby":"る"}]',
      pitch: 1,
    },
  },
];

const db = new DatabaseSync(CONTENT_DB_PATH);
const results = [];
db.exec('BEGIN');
for (const fix of CURATION_FIXES) {
  const row = db.prepare('SELECT * FROM vocab WHERE id = ?').get(fix.id);
  if (!row) {
    results.push({ id: fix.id, status: 'missing' });
    continue;
  }
  const changedColumns = Object.entries(fix.set).filter(([column, value]) => row[column] !== value);
  if (changedColumns.length === 0) {
    results.push({ id: fix.id, status: 'already-applied' });
    continue;
  }
  const assignments = changedColumns.map(([column]) => `${column} = ?`).join(', ');
  db.prepare(`UPDATE vocab SET ${assignments} WHERE id = ?`).run(...changedColumns.map(([, value]) => value), fix.id);
  results.push({ id: fix.id, status: 'applied', columns: changedColumns.map(([column]) => column) });
}
db.exec('COMMIT');
db.close();
console.log(JSON.stringify({ fixes: CURATION_FIXES.length, results }, null, 2));
