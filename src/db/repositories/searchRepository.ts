import { fetchSearch } from '../../api/contentApi';

export interface VocabSearchResult {
  id: string;
  expression: string;
  reading: string;
  gloss: string;
  jlpt: number | null;
}

export interface KanjiSearchResult {
  char: string;
  meanings: string;
  on_readings: string;
  kun_readings: string;
}

export interface DeckSearchResult {
  id: string;
  name: string;
  description: string;
  tags: string;
  color: string;
  vocab_count: number;
}

export interface SearchResults {
  vocab: VocabSearchResult[];
  kanji: KanjiSearchResult[];
  decks: DeckSearchResult[];
}

const EMPTY_RESULTS: SearchResults = { vocab: [], kanji: [], decks: [] };

/** 三類搜尋（單字／漢字／牌組）一次向雲端取回；空字串直接回空結果。 */
export const search = async (query: string, limit: number = 200): Promise<SearchResults> => {
  const trimmed = query.trim();
  if (!trimmed) return EMPTY_RESULTS;

  const data = await fetchSearch(trimmed, limit);
  return {
    vocab: data.vocab.map((hit) => ({
      id: hit.id,
      expression: hit.expression,
      reading: hit.reading,
      gloss: hit.gloss,
      jlpt: hit.jlpt,
    })),
    kanji: data.kanji.map((hit) => ({
      char: hit.char,
      meanings: (hit.meanings ?? []).join(', '),
      on_readings: (hit.on ?? []).join(', '),
      kun_readings: (hit.kun ?? []).join(', '),
    })),
    decks: data.decks.map((hit) => ({
      id: hit.id,
      name: hit.name,
      description: hit.description,
      tags: (hit.tags ?? []).join(', '),
      color: hit.color,
      vocab_count: hit.vocabCount,
    })),
  };
};
