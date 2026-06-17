import { open } from '@op-engineering/op-sqlite';

export const db = open({
  name: 'kioku.sqlite',
});

export const initDB = () => {
  try {
    // Create 'notes' table
    db.execute(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        kanji TEXT NOT NULL,
        english TEXT NOT NULL
      );
    `);

    // Create 'cards' table for FSRS
    db.execute(`
      CREATE TABLE IF NOT EXISTS cards (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        due INTEGER NOT NULL,
        stability REAL NOT NULL,
        difficulty REAL NOT NULL,
        elapsed_days INTEGER NOT NULL,
        scheduled_days INTEGER NOT NULL,
        reps INTEGER NOT NULL,
        lapses INTEGER NOT NULL,
        state INTEGER NOT NULL,
        last_review INTEGER,
        FOREIGN KEY (note_id) REFERENCES notes (id) ON DELETE CASCADE
      );
    `);

    // Index for quick fetching of due cards
    db.execute(`
      CREATE INDEX IF NOT EXISTS idx_cards_due ON cards (due);
    `);

    console.log('✅ SQLite Database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize SQLite database', error);
  }
};
