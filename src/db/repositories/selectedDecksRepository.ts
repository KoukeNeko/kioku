import { db } from '../schema';

/**
 * 首頁「目前學習範圍」（可多選牌組）。存於本機 kv。
 * 空陣列 = 全部牌組。各模式（略讀/閃卡/每日指標）在無明確 deckId 時自動套用此範圍。
 */
const SELECTED_DECKS_KEY = 'selected_decks';

export const getSelectedDecks = (): string[] => {
  const row = db.executeSync('SELECT value FROM kv WHERE key = ?', [SELECTED_DECKS_KEY]).rows?.[0] as
    | { value?: string }
    | undefined;
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

export const setSelectedDecks = (deckIds: string[]): void => {
  db.executeSync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [
    SELECTED_DECKS_KEY,
    JSON.stringify(deckIds),
  ]);
};
