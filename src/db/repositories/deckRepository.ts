import { db } from '../schema';
import { fetchDecks } from '../../api/contentApi';

export interface Deck {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  color: string | null;
  /** 伺服器牌組目錄的總詞數（與本機是否已建卡無關）。未訂閱的頻率包用它顯示規模，而非本機 0。 */
  count: number;
  metrics: {
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    dueCards: number;
  };
}

/**
 * 牌組目錄向雲端取得（名稱/描述/標籤/顏色/排序），每包的學習指標則由本機 cards 即時統計後合併。
 */
export const getAllDecksWithMetrics = async (): Promise<Deck[]> => {
  const now = Date.now();
  const apiDecks = await fetchDecks(); // 伺服器已依 sort_order 排序

  // 本機卡片依牌組彙整指標（state 0=新、1/3=學習中、2=複習；學習/複習取到期者）。
  const metricRows = (db.executeSync(
    `SELECT deck_id,
            COUNT(*) AS totalCards,
            SUM(CASE WHEN state = 0 THEN 1 ELSE 0 END) AS newCards,
            SUM(CASE WHEN (state = 1 OR state = 3) AND due <= ? THEN 1 ELSE 0 END) AS learningCards,
            SUM(CASE WHEN state = 2 AND due <= ? THEN 1 ELSE 0 END) AS reviewCards
     FROM cards GROUP BY deck_id`,
    [now, now],
  ).rows ?? []) as any[];

  const metricsByDeck = new Map<string, any>();
  for (const row of metricRows) {
    metricsByDeck.set(row.deck_id, row);
  }

  return apiDecks.map((deck) => {
    const metric = metricsByDeck.get(deck.id);
    const newCards = metric?.newCards || 0;
    const learningCards = metric?.learningCards || 0;
    const reviewCards = metric?.reviewCards || 0;
    return {
      id: deck.id,
      name: deck.name,
      description: deck.description,
      tags: deck.tags,
      color: deck.color,
      count: deck.count,
      metrics: {
        totalCards: metric?.totalCards || 0,
        newCards,
        learningCards,
        reviewCards,
        dueCards: newCards + learningCards + reviewCards,
      },
    };
  });
};
