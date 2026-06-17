import { useState, useMemo, useEffect } from 'react';
import { Card, Rating, processAnswer, formatInterval, f } from '../services/fsrs';
import { getDueCards, updateCardState } from '../db/repositories/cardRepository';

export interface VocabItem {
  id: string;
  kanji: { ruby: string; rt?: string }[];
  english: string;
  fsrsCard: Card;
}

export const useReviewSession = () => {
  const [deck, setDeck] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Load cards from DB on mount
  useEffect(() => {
    const loadCards = () => {
      try {
        const dueCards = getDueCards(20); // fetch up to 20 due cards
        setDeck(dueCards);
      } catch (error) {
        console.error('Failed to load due cards from SQLite', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    // Slight timeout just to ensure DB is fully initialized if it's the very first run
    setTimeout(loadCards, 100);
  }, []);

  const currentItem = deck[currentIndex] || null;
  const isFinished = !isLoading && (deck.length === 0 || currentIndex >= deck.length);

  const upcomingIntervals = useMemo(() => {
    if (!currentItem) return null;
    
    const now = new Date();
    const schedulingCards = f.repeat(currentItem.fsrsCard, now);
    
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

    // Persist to SQLite
    try {
      updateCardState(currentItem.id, newFsrsCard);
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

  const resetSession = () => {
    setIsLoading(true);
    setCurrentIndex(0);
    // Refetch the next batch of due cards
    try {
      const dueCards = getDueCards(20);
      setDeck(dueCards);
    } catch (error) {
      console.error(error);
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
    upcomingIntervals,
    handleRate,
    resetSession,
  };
};
