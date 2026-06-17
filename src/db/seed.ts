import { db } from './schema';
import { createNewCard } from '../services/fsrs';

// N5 Mock Data
const mockVocab = [
  { id: 'n5-1', kanji: JSON.stringify([{ ruby: "図", rt: "としょ" }, { ruby: "館", rt: "かん" }]), english: "library" },
  { id: 'n5-2', kanji: JSON.stringify([{ ruby: "経", rt: "けい" }, { ruby: "済", rt: "ざい" }]), english: "economy" },
  { id: 'n5-3', kanji: JSON.stringify([{ ruby: "約", rt: "やく" }, { ruby: "束", rt: "そく" }]), english: "promise" },
  { id: 'n5-4', kanji: JSON.stringify([{ ruby: "影", rt: "えい" }, { ruby: "響", rt: "きょう" }]), english: "influence" },
  { id: 'n5-5', kanji: JSON.stringify([{ ruby: "騒", rt: "さわ" }, { ruby: "がしい" }]), english: "noisy" },
  { id: 'n5-6', kanji: JSON.stringify([{ ruby: "犬", rt: "いぬ" }]), english: "dog" },
  { id: 'n5-7', kanji: JSON.stringify([{ ruby: "猫", rt: "ねこ" }]), english: "cat" },
  { id: 'n5-8', kanji: JSON.stringify([{ ruby: "鳥", rt: "とり" }]), english: "bird" },
  { id: 'n5-9', kanji: JSON.stringify([{ ruby: "魚", rt: "さかな" }]), english: "fish" },
  { id: 'n5-10', kanji: JSON.stringify([{ ruby: "水", rt: "みず" }]), english: "water" },
];

export const seedDatabaseIfEmpty = () => {
  const result = db.execute('SELECT COUNT(*) as count FROM notes');
  const count = result.rows?._array[0].count;

  if (count === 0) {
    console.log('🌱 Seeding database with N5 vocabulary...');
    
    // Start transaction
    db.execute('BEGIN TRANSACTION');
    
    try {
      for (const vocab of mockVocab) {
        // Insert Note
        db.execute(
          'INSERT INTO notes (id, kanji, english) VALUES (?, ?, ?)',
          [vocab.id, vocab.kanji, vocab.english]
        );
        
        // Insert FSRS Card
        const fsrsCard = createNewCard();
        db.execute(
          `INSERT INTO cards (
            id, note_id, due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `card-${vocab.id}`,
            vocab.id,
            fsrsCard.due.getTime(),
            fsrsCard.stability,
            fsrsCard.difficulty,
            fsrsCard.elapsed_days,
            fsrsCard.scheduled_days,
            fsrsCard.reps,
            fsrsCard.lapses,
            fsrsCard.state,
            fsrsCard.last_review ? fsrsCard.last_review.getTime() : null,
          ]
        );
      }
      
      db.execute('COMMIT');
      console.log('✅ Seed completed successfully!');
    } catch (e) {
      db.execute('ROLLBACK');
      console.error('❌ Failed to seed database:', e);
    }
  }
};
