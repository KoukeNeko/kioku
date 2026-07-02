/**
 * Harness: 驗證 assets/db/kioku-content.db 的完整性與關聯正確性。
 * 任一硬性檢查失敗即 exit 1。重點：外鍵參照完整、furigana 不變性、JLPT 五級齊全。
 */

import { DatabaseSync } from 'node:sqlite';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(SCRIPT_DIR, '..', 'assets', 'db', 'kioku-content.db');

const MIN_VOCAB = 20000;
const MIN_KANJI = 2000;
const MIN_EXAMPLE = 10000;
const MIN_JLPT = 7000;
const MIN_PITCH_PCT = 90; // UniDic 單詞素 + pyopenjtalk 複合詞補位（實測 ~95%+）
const MIN_FREQ_PCT = 95; // wordfreq 近乎全覆蓋（僅極罕用詞無值）

let failureCount = 0;
const check = (label, passed, detail = '') => {
  console.log(`${passed ? '✅ PASS' : '❌ FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
  if (!passed) failureCount += 1;
};
const count = (db, sql) => db.prepare(sql).get().n;

const main = () => {
  console.log('--- 驗證正規化內容庫 ---\n');
  const db = new DatabaseSync(DB_PATH, { readOnly: true });

  const vocab = count(db, 'SELECT COUNT(*) n FROM vocab');
  const kanji = count(db, 'SELECT COUNT(*) n FROM kanji');
  const example = count(db, 'SELECT COUNT(*) n FROM example');
  check(`vocab ≥ ${MIN_VOCAB}`, vocab >= MIN_VOCAB, `${vocab}`);
  check(`kanji ≥ ${MIN_KANJI}`, kanji >= MIN_KANJI, `${kanji}`);
  check(`example ≥ ${MIN_EXAMPLE}`, example >= MIN_EXAMPLE, `${example}`);

  const jlptLevels = db.prepare('SELECT DISTINCT jlpt FROM vocab WHERE jlpt IS NOT NULL ORDER BY jlpt').all().map((r) => r.jlpt);
  const jlptCount = count(db, 'SELECT COUNT(*) n FROM vocab WHERE jlpt IS NOT NULL');
  check('JLPT 五級齊全 (N1–N5)', [1, 2, 3, 4, 5].every((l) => jlptLevels.includes(l)), `levels ${jlptLevels.join(',')}`);
  check(`JLPT 標記詞 ≥ ${MIN_JLPT}`, jlptCount >= MIN_JLPT, `${jlptCount}`);

  // 音高（UniDic）+ 詞頻（wordfreq）+ 引入順序（intro_rank）— 由 enrich-pitch-freq.py 後處理填入。
  const pitchCount = count(db, 'SELECT COUNT(*) n FROM vocab WHERE pitch IS NOT NULL');
  const freqCount = count(db, 'SELECT COUNT(*) n FROM vocab WHERE freq_rank IS NOT NULL');
  const pctOf = (n) => (n / vocab) * 100;
  check(`pitch（UniDic）覆蓋 ≥ ${MIN_PITCH_PCT}%`, pctOf(pitchCount) >= MIN_PITCH_PCT, `${pctOf(pitchCount).toFixed(1)}% (${pitchCount})`);
  check(`freq_rank（wordfreq）覆蓋 ≥ ${MIN_FREQ_PCT}%`, pctOf(freqCount) >= MIN_FREQ_PCT, `${pctOf(freqCount).toFixed(1)}% (${freqCount})`);
  const dupRank = count(db, 'SELECT COUNT(*) n FROM (SELECT freq_rank FROM vocab WHERE freq_rank IS NOT NULL GROUP BY freq_rank HAVING COUNT(*) > 1)');
  check('freq_rank 全域唯一（無重複排名）', dupRank === 0, `重複 ${dupRank}`);
  const introCount = count(db, 'SELECT COUNT(*) n FROM vocab WHERE intro_rank IS NOT NULL');
  const dupIntro = count(db, 'SELECT COUNT(*) n FROM (SELECT intro_rank FROM vocab WHERE intro_rank IS NOT NULL GROUP BY intro_rank HAVING COUNT(*) > 1)');
  check('intro_rank 全覆蓋（每詞皆有引入順序）', introCount === vocab, `${introCount}/${vocab}`);
  check('intro_rank 全域唯一（無重複排名）', dupIntro === 0, `重複 ${dupIntro}`);

  // 資料驅動牌組：decks 目錄 + deck_vocab 成員（取代寫死）。
  const deckCount = count(db, 'SELECT COUNT(*) n FROM decks');
  const deckVocabCount = count(db, 'SELECT COUNT(*) n FROM deck_vocab');
  const orphanDeckVocab = count(db, 'SELECT COUNT(*) n FROM deck_vocab WHERE vocab_id NOT IN (SELECT id FROM vocab)');
  check('decks 五個 JLPT 牌組', deckCount === 5, `${deckCount}`);
  check('deck_vocab 成員數 = JLPT 標記詞', deckVocabCount === jlptCount, `${deckVocabCount} / ${jlptCount}`);
  check('deck_vocab.vocab_id 無孤兒', orphanDeckVocab === 0, `${orphanDeckVocab}`);

  // 外鍵參照完整（node:sqlite 不強制 FK，故手動查孤兒）。
  const orphanVk = count(db, 'SELECT COUNT(*) n FROM vocab_kanji WHERE vocab_id NOT IN (SELECT id FROM vocab)');
  const orphanVkChar = count(db, 'SELECT COUNT(*) n FROM vocab_kanji WHERE char NOT IN (SELECT char FROM kanji)');
  const orphanVe = count(db, 'SELECT COUNT(*) n FROM vocab_example WHERE vocab_id NOT IN (SELECT id FROM vocab)');
  const orphanVeEx = count(db, 'SELECT COUNT(*) n FROM vocab_example WHERE example_id NOT IN (SELECT id FROM example)');
  check('vocab_kanji.vocab_id 無孤兒', orphanVk === 0, `${orphanVk}`);
  check('vocab_kanji.char 無孤兒', orphanVkChar === 0, `${orphanVkChar}`);
  check('vocab_example.vocab_id 無孤兒', orphanVe === 0, `${orphanVe}`);
  check('vocab_example.example_id 無孤兒', orphanVeEx === 0, `${orphanVeEx}`);

  // furigana 不變性：ruby 串接 = 表記 / 原句（抽樣全表）。
  const reconstruct = (json) => {
    try {
      return JSON.parse(json).map((s) => s.ruby).join('');
    } catch {
      return null;
    }
  };
  const vocabFuri = db.prepare('SELECT expression, furigana FROM vocab WHERE furigana IS NOT NULL').all();
  const vocabFuriBad = vocabFuri.filter((r) => reconstruct(r.furigana) !== r.expression);
  check('不變性：vocab furigana ruby 串接 = 表記', vocabFuriBad.length === 0, `違反 ${vocabFuriBad.length}/${vocabFuri.length}`);

  const exFuri = db.prepare('SELECT jp, furigana FROM example').all();
  const exFuriBad = exFuri.filter((r) => reconstruct(r.furigana) !== r.jp);
  check('不變性：example furigana ruby 串接 = 原句', exFuriBad.length === 0, `違反 ${exFuriBad.length}/${exFuri.length}`);

  // 熟語旗標 sanity：is_jukugo=1 者必為「全是漢字的單字」（每字元皆漢字）。
  const jukugoBad = db
    .prepare('SELECT expression FROM vocab WHERE is_jukugo = 1')
    .all()
    .filter((r) => !(r.expression.length >= 1 && [...r.expression].every((c) => c >= '一' && c <= '鿿')));
  check('is_jukugo 旗標正確（全為漢字）', jukugoBad.length === 0, `異常 ${jukugoBad.length}`);

  // 抽樣關聯：示範一個詞 join 出漢字與例句。
  const sample = db.prepare("SELECT id, expression, reading, gloss, pitch, freq_rank, jlpt FROM vocab WHERE expression = '日本語' LIMIT 1").get();
  if (sample) {
    const ks = db.prepare('SELECT char FROM vocab_kanji WHERE vocab_id = ?').all(sample.id).map((r) => r.char).join('');
    const ex = db.prepare('SELECT e.jp FROM example e JOIN vocab_example ve ON e.id = ve.example_id WHERE ve.vocab_id = ? LIMIT 1').get(sample.id);
    console.log(`\nℹ️  關聯抽樣 日本語: pitch=${sample.pitch} freq_rank=${sample.freq_rank} jlpt=N${sample.jlpt} 漢字=[${ks}] 例句=「${ex?.jp ?? '—'}」`);
  }

  db.close();
  console.log('');
  if (failureCount === 0) {
    console.log('✅ 全部硬性檢查通過');
  } else {
    console.log(`❌ ${failureCount} 項檢查失敗`);
    process.exit(1);
  }
};

try {
  main();
} catch (error) {
  console.error('❌ 驗證腳本錯誤:', error.message);
  process.exit(1);
}
