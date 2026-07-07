import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { X, Check, BookOpen } from 'lucide-react-native';
import { Colors, Spacing, BORDER_RADIUS, Fonts } from '../constants/theme';
import { AppBar } from '../components/ui/AppBar';
import { FuriganaText } from '../components/ui/FuriganaText';
import { getSkimQueue, skimMarkKnown, skimMarkLearning, getDailyNewProgress } from '../db/repositories/cardRepository';
import { VocabItem } from '../hooks/useReviewSession';

export default function SkimScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [queue, setQueue] = useState<VocabItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const [progress, setProgress] = useState({ learned: 0, limit: 20 });

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoading(true);
      getSkimQueue(20).then(items => {
        if (!cancelled) {
          setQueue(items);
          setProgress(getDailyNewProgress());
          setCurrentIndex(0);
          setLoading(false);
        }
      }).catch(err => {
        console.error('Failed to load skim queue', err);
        if (!cancelled) {
          setQueue([]);
          setLoading(false);
        }
      });
      return () => { cancelled = true; };
    }, [])
  );

  const handleNext = () => {
    const nextProgress = getDailyNewProgress();
    setProgress(nextProgress);

    if (nextProgress.learned >= nextProgress.limit) {
      return;
    }

    if (currentIndex + 1 >= queue.length) {
      setLoading(true);
      getSkimQueue(20).then(items => {
        setQueue(items);
        setCurrentIndex(0);
        setLoading(false);
      }).catch(err => {
        setQueue([]);
        setLoading(false);
      });
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handleMarkKnown = () => {
    const currentItem = queue[currentIndex];
    if (currentItem) {
      skimMarkKnown(currentItem);
    }
    handleNext();
  };

  const handleMarkLearning = () => {
    const currentItem = queue[currentIndex];
    if (currentItem) {
      skimMarkLearning(currentItem);
    }
    handleNext();
  };

  const currentItem = queue[currentIndex];
  const isFinishedGoal = !loading && progress.learned >= progress.limit;
  const isFinishedEmpty = !loading && queue.length === 0 && !isFinishedGoal;

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.centerAll]} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.dark.primaryOrange} />
      </SafeAreaView>
    );
  }

  if (isFinishedGoal) {
    return (
      <SafeAreaView style={[styles.container, styles.centerAll]} edges={['top']}>
        <Text style={styles.titleText}>今日の新規目標達成！🎉</Text>
        <Text style={styles.messageText}>今回の略読が終わりました</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>ホームへ戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isFinishedEmpty) {
    return (
      <SafeAreaView style={[styles.container, styles.centerAll]} edges={['top']}>
        <Text style={styles.messageText}>新しい単語はありません</Text>
        <TouchableOpacity style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>戻る</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={
          <TouchableOpacity onPress={() => router.back()} style={{ padding: Spacing.one }}>
            <X size={24} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        }
        rightContent={
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.progressText} numberOfLines={1} adjustsFontSizeToFit>{progress.learned} / {progress.limit}</Text>
          </View>
        }
      />

      <View style={styles.mainArea}>
        <View style={styles.card}>
          <View style={styles.cardTop}>
            {currentItem.jlpt && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>N{currentItem.jlpt}</Text>
              </View>
            )}
            <Text style={styles.posText}>{currentItem.pos}</Text>
          </View>
          
          <View style={styles.wordArea}>
            <FuriganaText chunks={currentItem.kanji} fontSize={48} />
          </View>


          
          <View style={styles.divider} />
          
          <Text style={styles.meaningText}>{currentItem.english}</Text>
        </View>
      </View>

      <View style={styles.bottomArea}>
        <TouchableOpacity style={styles.knownButton} onPress={handleMarkKnown}>
          <Check size={24} color="#000" />
          <Text style={styles.knownButtonText}>知ってる</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.learnButton} onPress={handleMarkLearning}>
          <BookOpen size={24} color="#000" />
          <Text style={styles.learnButtonText}>学習する</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  centerAll: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  progressText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    fontFamily: Fonts?.mono,
  },
  mainArea: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.six,
    borderWidth: 1,
    borderColor: '#2E3135',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.four,
    position: 'absolute',
    top: Spacing.four,
  },
  badge: {
    backgroundColor: 'rgba(77, 166, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    color: '#4DA6FF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  posText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  wordArea: {
    marginBottom: Spacing.two,
    marginTop: Spacing.four,
  },
  readingText: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
    marginBottom: Spacing.five,
  },
  divider: {
    height: 1,
    backgroundColor: '#2E3135',
    width: '80%',
    marginBottom: Spacing.five,
  },
  meaningText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontFamily: Fonts?.lineSeed,
    textAlign: 'center',
    lineHeight: 34,
  },
  bottomArea: {
    flexDirection: 'row',
    padding: Spacing.four,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
  },
  knownButton: {
    flex: 1,
    backgroundColor: '#66D283',
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  knownButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  learnButton: {
    flex: 1,
    backgroundColor: Colors.dark.primaryOrange,
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.two,
  },
  learnButtonText: {
    color: '#000',
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleText: {
    color: Colors.dark.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.four,
  },
  messageText: {
    color: Colors.dark.textSecondary,
    fontSize: 18,
    marginBottom: Spacing.six,
  },
  doneButton: {
    backgroundColor: '#1C1D22',
    paddingHorizontal: Spacing.six,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  doneButtonText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  }
});
