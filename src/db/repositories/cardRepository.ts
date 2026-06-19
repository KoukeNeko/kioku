import { db } from '../schema';
import { Card, createNewCard, processAnswer, Rating } from '../../services/fsrs';
import { VocabItem } from '../../hooks/useReviewSession';
import { fetchVocabByIds, fetchVocabDetail, ApiVocab } from '../../api/contentApi';
import { getSelectedDecks } from './selectedDecksRepository';

// 範圍解析：明確單一 deckId → 只那包；否則用使用者選的範圍（可多選；空 = 全部）。
const resolveScope = (deckId?: string): string[] => (deckId ? [deckId] : getSelectedDecks());

// 由範圍產生 IN 子句（空 = 不過濾）。col 例：'c.deck_id'（getDueCards）或 'deck_id'（getDailyMetrics）。
const deckInClause = (scope: string[], col: string): { inClause: string; params: string[] } => {
  if (scope.length === 0) return { inClause: '', params: [] };
  return { inClause: `${col} IN (${scope.map(() => '?').join(', ')})`, params: scope };
};

// 本機 cards 的一列 → FSRS Card。
const cardRowToFsrs = (row: any): Card =>
  ({
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  } as Card);

// 雲端內容 + 本機 FSRS → VocabItem。例句/構成漢字延後抓（顯示該卡時，見 useReviewSession）。
const toVocabItemFromApi = (vocab: ApiVocab, fsrsCard: Card): VocabItem => ({
  id: vocab.id,
  kanji: vocab.furigana ?? [{ ruby: vocab.expression }],
  reading: vocab.reading,
  english: vocab.gloss,
  pos: vocab.pos ?? null,
  pitch: vocab.pitch ?? null,
  jlpt: vocab.jlpt ?? null,
  example: null,
  kanjiList: [],
  fsrsCard,
});

/** 每日新卡上限：當天引入滿這麼多張後，不再給新卡（避免無限批次、進度才會「停得住」）。 */
export const DAILY_NEW_LIMIT = 20;

// 今天「真正開始學」的新卡數：以每張卡「最早一筆複習」為準，落在今天、
// 且首評不是 Easy(=4) 才算（按「簡単/我已經會」只是分流掉，不佔當日新卡額度）。
const RATING_EASY = 4;
const countNewIntroducedToday = (deckId?: string): number => {
  const scope = resolveScope(deckId);
  const { inClause, params } = deckInClause(scope, 'c.deck_id');
  const deckJoin = scope.length ? 'JOIN cards c ON c.id = r.card_id' : '';
  const deckWhere = inClause ? `WHERE ${inClause}` : '';
  const row = db.executeSync(
    `SELECT COUNT(*) AS c FROM (
       SELECT r.rating, r.review_time,
              ROW_NUMBER() OVER (PARTITION BY r.card_id ORDER BY r.review_time ASC) AS rn
       FROM revlog r ${deckJoin} ${deckWhere}
     ) t
     WHERE t.rn = 1
       AND date(t.review_time / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
       AND t.rating <> ${RATING_EASY}`,
    params,
  ).rows?.[0] as { c?: number } | undefined;
  return row?.c ?? 0;
};

export const getDailyMetrics = (deckId?: string) => {
  const now = Date.now();
  const scope = resolveScope(deckId);
  const { inClause, params: deckParams } = deckInClause(scope, 'deck_id');
  const deckClause = inClause ? `AND ${inClause}` : '';

  const availableNew =
    (db.executeSync(`SELECT COUNT(*) AS c FROM cards WHERE state = 0 AND suspended = 0 ${deckClause}`, deckParams).rows[0] as any)?.c || 0;
  // 新規 = 今日尚可引入的新卡（每日上限 − 今日已引入），且不超過實際可用數。
  const newCards = Math.min(availableNew, Math.max(0, DAILY_NEW_LIMIT - countNewIntroducedToday(deckId)));
  const learningCards =
    (db.executeSync(`SELECT COUNT(*) AS c FROM cards WHERE (state = 1 OR state = 3) AND suspended = 0 AND due <= ? ${deckClause}`, [now, ...deckParams]).rows[0] as any)?.c || 0;
  const reviewCards =
    (db.executeSync(`SELECT COUNT(*) AS c FROM cards WHERE state = 2 AND suspended = 0 AND due <= ? ${deckClause}`, [now, ...deckParams]).rows[0] as any)?.c || 0;

  return { newCards, learningCards, reviewCards };
};

/**
 * 今日新卡學習進度（給略讀頁計數）：learned = 今日真正開始學的新卡數
 * （首評 Easy 的「已會」不計入），limit = 每日上限。按範圍（getSelectedDecks）計。
 */
export const getDailyNewProgress = (deckId?: string): { learned: number; limit: number } => ({
  learned: countNewIntroducedToday(deckId),
  limit: DAILY_NEW_LIMIT,
});

// 字典模式：向雲端取單字 + 例句 + 構成漢字。FSRS 用空卡（字典查詢不影響排程）。
export const getVocabById = async (vocabId: string): Promise<VocabItem | null> => {
  try {
    const detail = await fetchVocabDetail(vocabId);
    return {
      id: detail.id,
      kanji: detail.furigana ?? [{ ruby: detail.expression }],
      reading: detail.reading,
      english: detail.gloss,
      pos: detail.pos ?? null,
      pitch: detail.pitch ?? null,
      jlpt: detail.jlpt ?? null,
      example: detail.examples[0] ?? null,
      kanjiList: detail.kanji,
      fsrsCard: createNewCard(),
    };
  } catch (error) {
    console.error('查詢單字失敗', error);
    return null;
  }
};

/**
 * 取本工作階段的卡片：本機挑卡（複習依到期、新卡依 intro_rank）→ 向雲端批次抓內容 → 依序合併。
 * 例句/構成漢字不在此抓，於 useReviewSession 顯示該卡時才取（fetchVocabDetail）。
 */
export const getDueCards = async (
  newLimit: number = 20,
  reviewLimit: number = 50,
  deckId?: string,
): Promise<VocabItem[]> => {
  const now = Date.now();
  const scope = resolveScope(deckId);
  const { inClause, params: deckParams } = deckInClause(scope, 'c.deck_id');
  const deckClause = inClause ? `AND ${inClause}` : '';

  // 1. 複習/學習中卡（state > 0 且到期）— 純本機，依到期排序。
  const reviewRows = (db.executeSync(
    `SELECT c.* FROM cards c WHERE c.state > 0 AND c.suspended = 0 AND c.due <= ? ${deckClause} ORDER BY c.due ASC LIMIT ?`,
    [now, ...deckParams, reviewLimit],
  ).rows ?? []) as any[];

  // 2. 新卡（state = 0）— 依引入順序；扣掉今日已引入數，套用每日新卡上限。
  const remainingNew = Math.max(0, newLimit - countNewIntroducedToday(deckId));
  const newRows =
    remainingNew > 0
      ? ((db.executeSync(
          `SELECT c.* FROM cards c
           WHERE c.state = 0 AND c.suspended = 0 ${deckClause} ORDER BY c.intro_rank IS NULL, c.intro_rank ASC LIMIT ?`,
          [...deckParams, remainingNew],
        ).rows ?? []) as any[])
      : [];

  const orderedRows = [...reviewRows, ...newRows];
  if (orderedRows.length === 0) return [];

  // 3. 內容向雲端批次取得，依本機挑卡順序組裝（缺內容者略過並記錄，以利診斷內容版本不一致）。
  const vocabById = new Map<string, ApiVocab>();
  for (const vocab of await fetchVocabByIds(orderedRows.map((row) => row.vocab_id))) {
    vocabById.set(vocab.id, vocab);
  }

  const missingIds = orderedRows.filter((row) => !vocabById.has(row.vocab_id)).map((row) => row.vocab_id);
  if (missingIds.length > 0) {
    console.warn(`雲端缺少 ${missingIds.length} 張卡的內容（內容版本可能不一致）：`, missingIds.slice(0, 10));
  }

  const items: VocabItem[] = [];
  for (const row of orderedRows) {
    const vocab = vocabById.get(row.vocab_id);
    if (vocab) items.push(toVocabItemFromApi(vocab, cardRowToFsrs(row)));
  }
  return items;
};

/**
 * 略讀佇列：新卡（state=0、未隱藏）依引入順序，向雲端抓內容。
 * 不套用每日新卡上限（略讀是 triage：你可一次掃很多張，已會的用 Easy 篩掉不佔額度）。
 */
export const getSkimQueue = async (limit: number = 20, deckId?: string): Promise<VocabItem[]> => {
  const scope = resolveScope(deckId);
  const { inClause, params: deckParams } = deckInClause(scope, 'c.deck_id');
  const deckClause = inClause ? `AND ${inClause}` : '';
  const rows = (db.executeSync(
    `SELECT c.* FROM cards c
     WHERE c.state = 0 AND c.suspended = 0 ${deckClause}
     ORDER BY c.intro_rank IS NULL, c.intro_rank ASC LIMIT ?`,
    [...deckParams, limit],
  ).rows ?? []) as any[];
  if (rows.length === 0) return [];

  const vocabById = new Map<string, ApiVocab>();
  for (const vocab of await fetchVocabByIds(rows.map((row) => row.vocab_id))) {
    vocabById.set(vocab.id, vocab);
  }
  const items: VocabItem[] = [];
  for (const row of rows) {
    const vocab = vocabById.get(row.vocab_id);
    if (vocab) items.push(toVocabItemFromApi(vocab, cardRowToFsrs(row)));
  }
  return items;
};

/** 略讀「知ってる」：評 Easy 畢業（首評 Easy → 不佔當日新卡額度）。 */
export const skimMarkKnown = (item: VocabItem): void => {
  const log = processAnswer(item.fsrsCard, Rating.Easy);
  updateCardState(item.id, log.card, Rating.Easy, 0);
};

/** 略讀「学習」：評 Good 進入 SRS 學習（首評非 Easy → 佔當日額度，之後在閃卡複習）。 */
export const skimMarkLearning = (item: VocabItem): void => {
  const log = processAnswer(item.fsrsCard, Rating.Good);
  updateCardState(item.id, log.card, Rating.Good, 0);
};

export const updateCardState = (vocabId: string, fsrsCard: Card, rating: number, durationMs: number = 0) => {
  db.executeSync(
    `UPDATE cards SET
      due = ?, stability = ?, difficulty = ?, elapsed_days = ?, scheduled_days = ?,
      reps = ?, lapses = ?, state = ?, last_review = ?
     WHERE vocab_id = ?`,
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
      vocabId,
    ],
  );

  // 記錄複習 log（FSRS 個人化訓練原料 + duration_ms 供學習時間分析）。
  db.executeSync(
    `INSERT INTO revlog (card_id, rating, state, due, stability, difficulty, elapsed_days, scheduled_days, review_time, duration_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      `card-${vocabId}`,
      rating,
      fsrsCard.state,
      fsrsCard.due.getTime(),
      fsrsCard.stability,
      fsrsCard.difficulty,
      fsrsCard.elapsed_days,
      fsrsCard.scheduled_days,
      Date.now(),
      durationMs,
    ],
  );
};

/**
 * 學習時間統計（給分析/統計頁）：今日總時長、整體每張平均、今日複習筆數。
 * duration_ms 由 updateCardState 寫入（翻卡→評分的耗時，已於來源端設上限）。
 */
export const getStudyTimeStats = (): { todayMs: number; avgPerCardMs: number; todayReviews: number } => {
  const todayRow = db.executeSync(
    `SELECT COALESCE(SUM(duration_ms), 0) AS ms, COUNT(*) AS n FROM revlog
     WHERE date(review_time / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
       AND NOT (state = 0 AND rating = 4)`,
  ).rows[0] as any;
  const avgRow = db.executeSync(
    `SELECT AVG(duration_ms) AS ms FROM revlog WHERE duration_ms > 0`,
  ).rows[0] as any;
  return {
    todayMs: todayRow?.ms ?? 0,
    avgPerCardMs: Math.round(avgRow?.ms ?? 0),
    todayReviews: todayRow?.n ?? 0,
  };
};

// 今天複習過的不重複卡片數（用於首頁進度環）。
export const getReviewedTodayCount = (): number => {
  const row = db.executeSync(
    `SELECT COUNT(DISTINCT card_id) AS c FROM revlog
     WHERE date(review_time / 1000, 'unixepoch', 'localtime') = date('now', 'localtime')
       AND NOT (state = 0 AND rating = 4)`,
  ).rows[0] as any;
  return row?.c || 0;
};

const localDayString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// 連續複習天數：從今天（或昨天）往回數有複習紀錄的連續日。
export const getStreak = (): number => {
  const rows = (db.executeSync(
    `SELECT DISTINCT date(review_time / 1000, 'unixepoch', 'localtime') AS d FROM revlog ORDER BY d DESC`,
  ).rows ?? []) as any[];
  const days = new Set(rows.map((r) => r.d as string));
  if (days.size === 0) return 0;

  const today = new Date();
  const cursor = new Date(today);
  // 今天還沒複習但昨天有 → 連續仍成立，從昨天起算。
  if (!days.has(localDayString(today))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(localDayString(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(localDayString(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};
