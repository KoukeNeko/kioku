/**
 * ETL（post-enrich）：對內容庫建立 4 個「頻率分級牌組」與其成員。
 *
 * 在 build-content-db.mjs（建結構 + JLPT 牌組）與 enrich-pitch-freq.py（填 intro_rank）
 * 之後執行。只放 jlpt IS NULL 的非 JLPT 詞，依 intro_rank 切級；intro_rank 100% 有值。
 * 一個詞只會落在一個牌組（JLPT 與 freq 不重疊，因 freq 只取 jlpt IS NULL）。
 *
 * 冪等：每次執行先刪除既有的 deck-freq1..4 及其 deck_vocab，再以交易重建。
 * 不動到 JLPT 牌組（deck-n1..n5）。
 *
 * decks 與 deck_vocab 的欄位完全比照 build-content-db.mjs 的實際 INSERT：
 *   decks      (id, name, description, tags, color, sort_order, kind)
 *   deck_vocab (deck_id, vocab_id, position)
 * tags 以 JSON 字串存放、position 依 intro_rank 升冪（與 vocab.intro_rank 排序一致）。
 */

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(SCRIPT_DIR, '..', '..');
// 內容庫隨 App 打包於資產目錄；比照 build-content-db.mjs 的 OUTPUT_DIR。
const CONTENT_DB_PATH = join(APP_ROOT, 'assets', 'db', 'kioku-content.db');

// JLPT 牌組接在 sort_order 0..4，freq 牌組續接 5..8。
const FREQ_DECK_SORT_BASE = 5;

// 頻率分級牌組目錄：只放 jlpt IS NULL 的詞，依 intro_rank 區間切級（上界含、下界含）。
// minRank/maxRank 為 null 代表該側無界（>= minRank 或 <= maxRank）。
const FREQ_DECK_META = [
  {
    id: 'deck-freq1',
    name: '頻出語彙',
    description: '高頻非 JLPT 語彙（引入順序 1–10000）',
    tags: ['頻出', '語彙'],
    color: '#FFB300',
    minRank: 1,
    maxRank: 10000,
  },
  {
    id: 'deck-freq2',
    name: '中級語彙',
    description: '中頻非 JLPT 語彙（引入順序 10001–30000）',
    tags: ['中級', '語彙'],
    color: '#FF8A3D',
    minRank: 10001,
    maxRank: 30000,
  },
  {
    id: 'deck-freq3',
    name: '上級語彙',
    description: '低頻非 JLPT 語彙（引入順序 30001–60000）',
    tags: ['上級', '語彙'],
    color: '#E0552B',
    minRank: 30001,
    maxRank: 60000,
  },
  {
    id: 'deck-freq4',
    name: '専門・稀少',
    description: '稀少非 JLPT 語彙（引入順序 60001 以上）',
    tags: ['専門', '稀少', '語彙'],
    color: '#9C3D1E',
    minRank: 60001,
    maxRank: null,
  },
];

/** 刪除既有的 freq 牌組與其成員（冪等重建用）；不觸碰 JLPT 牌組。 */
const clearFrequencyDecks = (db) => {
  const deleteMembers = db.prepare('DELETE FROM deck_vocab WHERE deck_id = ?');
  const deleteDeck = db.prepare('DELETE FROM decks WHERE id = ?');
  for (const deck of FREQ_DECK_META) {
    deleteMembers.run(deck.id);
    deleteDeck.run(deck.id);
  }
};

/**
 * 依 intro_rank 區間撈該牌組成員（升冪），插入 deck_vocab。
 * position 直接用升冪序號（0 起算），與 intro_rank 排序一致。
 * 回傳寫入的成員數。
 */
const seedFrequencyDeck = (db, deck) => {
  const lowerClause = deck.minRank != null ? 'AND intro_rank >= ?' : '';
  const upperClause = deck.maxRank != null ? 'AND intro_rank <= ?' : '';
  const params = [deck.minRank, deck.maxRank].filter((bound) => bound != null);
  const members = db
    .prepare(
      `SELECT id FROM vocab
       WHERE jlpt IS NULL AND intro_rank IS NOT NULL ${lowerClause} ${upperClause}
       ORDER BY intro_rank ASC`,
    )
    .all(...params);

  const insertMember = db.prepare(
    'INSERT OR IGNORE INTO deck_vocab (deck_id, vocab_id, position) VALUES (?, ?, ?)',
  );
  members.forEach((member, position) => insertMember.run(deck.id, member.id, position));
  return members.length;
};

const buildFrequencyDecks = (db) => {
  const insertDeck = db.prepare(
    'INSERT INTO decks (id, name, description, tags, color, sort_order, kind) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  const memberCounts = new Map();
  FREQ_DECK_META.forEach((deck, index) => {
    insertDeck.run(
      deck.id,
      deck.name,
      deck.description,
      JSON.stringify(deck.tags),
      deck.color,
      FREQ_DECK_SORT_BASE + index,
      'frequency',
    );
    memberCounts.set(deck.id, seedFrequencyDeck(db, deck));
  });
  return memberCounts;
};

const main = () => {
  console.log('--- 建立頻率分級牌組 (frequency decks) ---\n');

  const db = new DatabaseSync(CONTENT_DB_PATH);
  // 全程單一交易：先清舊、再重建，確保冪等且不留半成品。
  db.exec('BEGIN');
  try {
    clearFrequencyDecks(db);
    const memberCounts = buildFrequencyDecks(db);
    db.exec('COMMIT');

    console.log(`寫入 ${CONTENT_DB_PATH}\n`);
    for (const deck of FREQ_DECK_META) {
      console.log(`${deck.id}「${deck.name}」成員數: ${memberCounts.get(deck.id)}`);
    }
    console.log('\n✅ 頻率分級牌組建立完成');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
};

try {
  main();
} catch (error) {
  console.error('❌ 頻率牌組 ETL 失敗:', error.message);
  process.exit(1);
}
