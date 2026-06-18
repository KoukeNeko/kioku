import Constants from 'expo-constants';

/**
 * 雲端卡包 API client（對應 /server 的 Go 服務）。
 *
 * 只取「內容」（單字／例句／漢字）；使用者的 FSRS 卡片狀態與複習紀錄留在本機。
 * Base URL 自 Metro 的 host 推導出 Mac 的區網 IP（模擬器與實機皆通）；
 * 正式環境用 EXPO_PUBLIC_API_URL 覆蓋成已部署的伺服器位址。
 */

const SERVER_PORT = 4000;
const FALLBACK_BASE_URL = `http://localhost:${SERVER_PORT}`;
const REQUEST_TIMEOUT_MS = 10000;

const deriveBaseUrl = (): string => {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override;
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  return host ? `http://${host}:${SERVER_PORT}` : FALLBACK_BASE_URL;
};

export const API_BASE_URL = deriveBaseUrl();

export interface FuriganaChunk {
  ruby: string;
  rt?: string;
}

export interface ApiVocab {
  id: string;
  expression: string;
  reading: string;
  furigana: FuriganaChunk[] | null;
  gloss: string;
  pos: string | null;
  jlpt: number | null;
  pitch: number | null;
  freqRank: number | null;
  introRank: number | null;
  isJukugo: boolean;
}

export interface ApiExample {
  jp: string;
  furigana: FuriganaChunk[];
  en: string;
}

export interface ApiKanji {
  char: string;
  strokes: string[];
  strokeCount: number | null;
  jlpt: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
}

export interface ApiVocabDetail extends ApiVocab {
  examples: ApiExample[];
  kanji: ApiKanji[];
}

export interface ApiDeck {
  id: string;
  name: string;
  level: number;
  tags: string[];
  color: string;
  count: number;
  version: string;
}

const fetchJson = async <T>(path: string): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`雲端卡包請求失敗 ${response.status}: ${path}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
};

/** 卡包目錄（5 個 JLPT 級 + 每包詞數）。 */
export const fetchDecks = async (): Promise<ApiDeck[]> => {
  const data = await fetchJson<{ decks: ApiDeck[] }>('/api/decks');
  return data.decks;
};

/** 卡包內容：該級單字，依 intro_rank 排序；可分頁。 */
export const fetchDeckVocab = async (deckId: string, limit?: number, offset?: number): Promise<ApiVocab[]> => {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', String(limit));
  if (offset != null) params.set('offset', String(offset));
  const query = params.toString();
  const data = await fetchJson<{ vocab: ApiVocab[] }>(`/api/decks/${deckId}/vocab${query ? `?${query}` : ''}`);
  return data.vocab;
};

/** 批次取核心單字（一個複習工作階段一次抓回所需的卡內容）。 */
export const fetchVocabByIds = async (ids: string[]): Promise<ApiVocab[]> => {
  if (ids.length === 0) return [];
  const encoded = ids.map(encodeURIComponent).join(',');
  const data = await fetchJson<{ vocab: ApiVocab[] }>(`/api/vocab?ids=${encoded}`);
  return data.vocab;
};

/** 單字延伸：例句 + 構成漢字（卡片顯示時逐字取用）。 */
export const fetchVocabDetail = async (vocabId: string): Promise<ApiVocabDetail> =>
  fetchJson<ApiVocabDetail>(`/api/vocab/${encodeURIComponent(vocabId)}`);

export interface ApiKanjiExample {
  id: number;
  jp: string;
  furigana: FuriganaChunk[];
  en: string;
}

/** 含某漢字的單字（筆順頁相關單字）。 */
export const fetchKanjiWords = async (char: string, limit = 10): Promise<ApiVocab[]> => {
  const data = await fetchJson<{ words: ApiVocab[] }>(
    `/api/kanji/${encodeURIComponent(char)}/words?limit=${limit}`,
  );
  return data.words;
};

/** 含某漢字的例句（筆順頁例句）。 */
export const fetchKanjiExamples = async (char: string, limit = 10): Promise<ApiKanjiExample[]> => {
  const data = await fetchJson<{ examples: ApiKanjiExample[] }>(
    `/api/kanji/${encodeURIComponent(char)}/examples?limit=${limit}`,
  );
  return data.examples;
};

export interface ApiSearchVocab {
  id: string;
  expression: string;
  reading: string;
  gloss: string;
  jlpt: number | null;
}

export interface ApiSearchKanji {
  char: string;
  meanings: string[];
  on: string[];
  kun: string[];
}

export interface ApiSearchDeck {
  id: string;
  name: string;
  description: string;
  tags: string[];
  color: string;
  vocabCount: number;
}

export interface ApiSearchResults {
  query: string;
  vocab: ApiSearchVocab[];
  kanji: ApiSearchKanji[];
  decks: ApiSearchDeck[];
}

/** 搜尋：單字／漢字／牌組三類一次取回。 */
export const fetchSearch = async (query: string, limit = 50): Promise<ApiSearchResults> =>
  fetchJson<ApiSearchResults>(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`);
