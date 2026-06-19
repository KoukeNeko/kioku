import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, Rating, processAnswer, formatInterval, previewSchedule } from '../services/fsrs';
import { getDueCards, updateCardState } from '../db/repositories/cardRepository';
import { fetchVocabDetail } from '../api/contentApi';

// 單卡計時上限：避免使用者掛在某張卡（AFK）灌爆平均學習時間。
const MAX_REVIEW_DURATION_MS = 60_000;

export interface FuriganaChunk {
  ruby: string;
  rt?: string;
}

export interface ExampleSentence {
  jp: string;
  furigana: FuriganaChunk[];
  en: string;
}

export interface KanjiInfo {
  char: string;
  strokes: string[];
  strokeCount: number | null;
  jlpt: number | null;
  on: string[];
  kun: string[];
  meanings: string[];
}

// 由 cardRepository 從 content 庫充實：卡面 furigana + 釋義 + pitch + 例句 + 構成漢字。
export interface VocabItem {
  id: string;
  kanji: FuriganaChunk[]; // 卡面 furigana 疊字段落（沿用既有欄位名）
  reading: string;
  english: string;
  pos: string | null;
  pitch: number | null;
  jlpt: number | null;
  example: ExampleSentence | null;
  kanjiList: KanjiInfo[]; // 構成漢字
  fsrsCard: Card;
}

export const useReviewSession = (deckId?: string, enabled: boolean = true) => {
  const [deck, setDeck] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false); // 雲端內容載入失敗（離線/伺服器掛掉）
  const detailLoadedRef = useRef<Set<string>>(new Set());
  const cardShownAtRef = useRef<number>(Date.now()); // 目前卡片開始顯示的時刻（計時用）

  // 載入卡片：本機挑卡 + 雲端批次抓內容（async）。字典模式（enabled=false）不需挑卡。
  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    const loadCards = async () => {
      try {
        const dueCards = await getDueCards(20, 50, deckId); // 至多 50 複習卡 + 20 新卡
        if (!cancelled) {
          setDeck(dueCards);
          setLoadError(false);
        }
      } catch (error) {
        console.error('載入卡片失敗（雲端內容或本機 DB）', error);
        if (!cancelled) {
          setDeck([]);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    // 稍候確保 DB 初始化完成（首次啟動）。
    const timer = setTimeout(loadCards, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [deckId, enabled]);

  const currentItem = deck[currentIndex] || null;
  const isFinished = !isLoading && (deck.length === 0 || currentIndex >= deck.length);

  // 顯示某卡時才向雲端抓例句 + 構成漢字（延後載入；每個 id 只抓一次）。
  useEffect(() => {
    if (!currentItem) return;
    const vocabId = currentItem.id;
    if (detailLoadedRef.current.has(vocabId)) return;
    detailLoadedRef.current.add(vocabId);

    let cancelled = false;
    fetchVocabDetail(vocabId)
      .then((detail) => {
        if (cancelled) return;
        setDeck((prev) =>
          prev.map((item) =>
            item.id === vocabId
              ? { ...item, example: detail.examples[0] ?? null, kanjiList: detail.kanji }
              : item,
          ),
        );
      })
      .catch((error) => {
        detailLoadedRef.current.delete(vocabId); // 失敗允許下次重試
        console.error('載入單字延伸失敗', error);
      });

    return () => {
      cancelled = true;
    };
  }, [currentItem]);

  // 每換一張卡（依 id）重設計時起點，供 handleRate 計算作答耗時。
  useEffect(() => {
    cardShownAtRef.current = Date.now();
  }, [currentItem?.id]);

  const upcomingIntervals = useMemo(() => {
    if (!currentItem) return null;
    
    const now = new Date();
    const schedulingCards = previewSchedule(currentItem.fsrsCard, now);
    
    return {
      again: formatInterval((schedulingCards as any)[Rating.Again].card.due, now),
      hard: formatInterval((schedulingCards as any)[Rating.Hard].card.due, now),
      good: formatInterval((schedulingCards as any)[Rating.Good].card.due, now),
      easy: formatInterval((schedulingCards as any)[Rating.Easy].card.due, now),
    };
  }, [currentItem]);

  const handleRate = (rating: Rating) => {
    if (!currentItem) return;

    const now = new Date();
    const recordLog = processAnswer(currentItem.fsrsCard, rating, now);
    const newFsrsCard = recordLog.card;

    // 作答耗時（翻卡→評分），上限保護後存入 revlog。
    const durationMs = Math.min(Date.now() - cardShownAtRef.current, MAX_REVIEW_DURATION_MS);

    // Persist to SQLite (+ revlog with the rating + duration)
    try {
      updateCardState(currentItem.id, newFsrsCard, rating, durationMs);
    } catch (e) {
      console.error('Failed to update card state in DB:', e);
    }

    // Update local state
    setDeck(prevDeck => {
      const newDeck = [...prevDeck];
      newDeck[currentIndex] = {
        ...newDeck[currentIndex],
        fsrsCard: newFsrsCard
      };
      return newDeck;
    });

    setCurrentIndex(prev => prev + 1);
  };

  const resetSession = async () => {
    setIsLoading(true);
    setLoadError(false);
    setCurrentIndex(0);
    detailLoadedRef.current.clear();
    try {
      const dueCards = await getDueCards(20, 50, deckId);
      setDeck(dueCards);
      setLoadError(false);
    } catch (error) {
      console.error('重新載入卡片失敗', error);
      setDeck([]);
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    currentItem,
    currentIndex,
    totalCards: deck.length,
    isFinished,
    isLoading,
    loadError,
    upcomingIntervals,
    handleRate,
    resetSession,
  };
};
