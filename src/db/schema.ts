import { open } from '@op-engineering/op-sqlite';

export const db = open({
  name: 'kioku.sqlite',
});

/**
 * 初始化「可寫主庫」的資料表（cards / revlog / kv）。詞彙內容（vocab/kanji/example/牌組）
 * 由打包進 App 的唯讀內容庫供應，以別名 content ATTACH 於本連線（見 src/db/contentDb.ts）；
 * 主庫只存使用者的 FSRS 狀態與複習紀錄，與內容分離。
 *
 * cards 參照 content.vocab 的 id，並存 intro_rank（新卡引入順序，seed 時自 content.deck_vocab 取得）。
 * 舊版 cards 以 note_id 參照 notes，偵測到即丟棄重建（dev 階段拋棄舊複習進度可接受），
 * 並移除 notes 表與舊的本機 decks 表。
 */
export const initDB = () => {
  try {
    // --- 由舊 schema 遷移：cards.note_id + notes → cards.vocab_id ---
    // DROP 一律加 main. 限定詞：SQLite 對未限定的表名會一路搜到 ATTACH 的庫，
    // dev reload 時 content 已掛載、main 又沒有同名表，曾把 content.decks 誤刪（v4 副本損毀事故）。
    const cardCols = (db.executeSync('PRAGMA table_info(cards)').rows ?? []) as any[];
    if (cardCols.some((col) => col.name === 'note_id')) {
      db.executeSync('DROP TABLE IF EXISTS main.cards');
      console.log('🔁 遷移：丟棄舊 cards（note_id → vocab_id）');
    }
    db.executeSync('DROP TABLE IF EXISTS main.notes');
    // 牌組目錄改為資料驅動（content.decks / content.deck_vocab）；移除主庫舊的 decks 表。
    db.executeSync('DROP TABLE IF EXISTS main.decks');

    db.executeSync(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        vocab_id TEXT NOT NULL,
        deck_id TEXT NOT NULL,
        intro_rank INTEGER,
        bookmarked INTEGER NOT NULL DEFAULT 0,
        suspended INTEGER NOT NULL DEFAULT 0,
        due INTEGER NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state INTEGER NOT NULL,
        last_review INTEGER
      );
    `);

    // 舊版 cards 無 intro_rank（新卡排序欄）則補上，避免重灌使用者複習進度。
    const cardColsNow = (db.executeSync('PRAGMA table_info(cards)').rows ?? []) as any[];
    if (!cardColsNow.some((col) => col.name === 'intro_rank')) {
      db.executeSync('ALTER TABLE cards ADD COLUMN intro_rank INTEGER');
    }
    // 智慧收藏旗標：書籤 / 隱藏（隱藏者由 getDueCards 排除）。
    if (!cardColsNow.some((col) => col.name === 'bookmarked')) {
      db.executeSync('ALTER TABLE cards ADD COLUMN bookmarked INTEGER NOT NULL DEFAULT 0');
    }
    if (!cardColsNow.some((col) => col.name === 'suspended')) {
      db.executeSync('ALTER TABLE cards ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0');
    }

    // 複習紀錄（FSRS 個人化訓練原料；研究 §C.3 建議從第一天完整記錄）。
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS revlog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        card_id TEXT NOT NULL,
        rating INTEGER NOT NULL,
        state INTEGER NOT NULL,
        due INTEGER,
        stability REAL,
        difficulty REAL,
        elapsed_days INTEGER,
        last_elapsed_days INTEGER,
        scheduled_days INTEGER,
        review_time INTEGER NOT NULL,
        duration_ms INTEGER
      );
    `);

    // 舊版 revlog 無 duration_ms（每次複習耗時）則補上。
    const revlogCols = (db.executeSync('PRAGMA table_info(revlog)').rows ?? []) as any[];
    if (!revlogCols.some((col) => col.name === 'duration_ms')) {
      db.executeSync('ALTER TABLE revlog ADD COLUMN duration_ms INTEGER');
    }

    // 小型 key/value（存放本機訓練出的 FSRS 參數 w 等）。
    db.executeSync(`
      CREATE TABLE IF NOT EXISTS kv (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    db.executeSync('CREATE INDEX IF NOT EXISTS idx_cards_due ON cards (due);');
    db.executeSync('CREATE INDEX IF NOT EXISTS idx_cards_deck ON cards (deck_id);');
    db.executeSync('CREATE INDEX IF NOT EXISTS idx_revlog_card ON revlog (card_id);');

    console.log('✅ 主庫 (cards/revlog) 初始化完成');
  } catch (error) {
    console.error('❌ 主庫初始化失敗', error);
  }
};
