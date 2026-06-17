import { db } from '../schema';
import { Card } from '../../../services/fsrs';
import { VocabItem } from '../../../hooks/useReviewSession';

export const getDueCards = (limit: number = 20): VocabItem[] => {
  const now = new Date().getTime();
  
  // Fetch cards where due date is in the past, or it's a new card (due = 0 or near now)
  const result = db.execute(
    `SELECT c.*, n.kanji, n.english 
     FROM cards c
     JOIN notes n ON c.note_id = n.id
     WHERE c.due <= ?
     ORDER BY c.due ASC
     LIMIT ?`,
    [now, limit]
  );

  const rows = result.rows?._array || [];

  return rows.map((row: any) => ({
    id: row.note_id,
    kanji: JSON.parse(row.kanji),
    english: row.english,
    fsrsCard: {
      due: new Date(row.due),
      stability: row.stability,
      difficulty: row.difficulty,
      elapsed_days: row.elapsed_days,
      scheduled_days: row.scheduled_days,
      reps: row.reps,
      lapses: row.lapses,
      state: row.state,
      last_review: row.last_review ? new Date(row.last_review) : undefined,
    } as Card
  }));
};

export const updateCardState = (noteId: string, fsrsCard: Card) => {
  db.execute(
    `UPDATE cards SET
      due = ?,
      stability = ?,
      difficulty = ?,
      elapsed_days = ?,
      scheduled_days = ?,
      reps = ?,
      lapses = ?,
      state = ?,
      last_review = ?
     WHERE note_id = ?`,
    [
      fsrsCard.due.getTime(),
      fsrsCard.stability,
      fsrsCard.difficulty,
      fsrsCard.elapsed_days,
      fsrsCard.scheduled_days,
      fsrsCard.reps,
      fsrsCard.lapses,
      fsrsCard.state,
      fsrsCard.last_review ? fsrsCard.last_review.getTime() : null,
      noteId
    ]
  );
};
