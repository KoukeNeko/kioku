import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, BORDER_RADIUS, Fonts } from '../../constants/theme';
import { AppBar } from '../../components/ui/AppBar';
import { BackButton } from '../../components/ui/BackButton';
import { getDailyMetrics } from '../../db/repositories/cardRepository';
import { getAllDecksWithMetrics, Deck } from '../../db/repositories/deckRepository';
import { ensureSelectedDeckCards } from '../../db/seed';

export default function DeckDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getAllDecksWithMetrics()
        .then((decks) => {
          if (cancelled) return;
          const found = decks.find((d) => d.id === id);
          if (found) setDeck(found);
        })
        .catch((e) => console.error('Failed to load deck stats', e));
      return () => { cancelled = true; };
    }, [id])
  );

  if (!deck) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <AppBar
          leftContent={
            <BackButton />
          }
          centerContent={<Text style={styles.headerTitle}>Loading...</Text>}
        />
      </SafeAreaView>
    );
  }

  const isUnsubscribed = deck.metrics.totalCards === 0;
  const displayDue = Math.min(deck.metrics.newCards, 20) + deck.metrics.learningCards + deck.metrics.reviewCards;
  const isCompleted = !isUnsubscribed && displayDue === 0;

  const handlePress = async () => {
    if (isUnsubscribed) {
      try {
        setLoading(true);
        await ensureSelectedDeckCards([deck.id]);
        const decks = await getAllDecksWithMetrics();
        const found = decks.find((d) => d.id === deck.id);
        if (found) setDeck(found);
      } catch (e) {
        console.error('Failed to add deck', e);
      } finally {
        setLoading(false);
      }
    } else if (!isCompleted) {
      router.push({ pathname: "/review", params: { deckId: deck.id } });
    }
  };

  const getButtonText = () => {
    if (loading) return 'カードを準備中…';
    if (isUnsubscribed) return 'この語彙を学習に追加';
    if (isCompleted) return '今日の目標達成！ 🎉';
    return 'このデッキを復習する';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={
          <BackButton />
        }
        centerContent={<Text style={styles.headerTitle}>{deck.name}</Text>}
        rightContent={
          <View style={styles.iconButton} pointerEvents="none">
            <ChevronLeft size={28} color="transparent" />
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerArea}>
          {deck.tags && deck.tags.length > 0 && (
            <View style={[styles.tagBadge, { backgroundColor: '#1C2939' }]}>
              <Text style={[styles.tagText, { color: '#68A5FF' }]}>{deck.tags[0]}</Text>
            </View>
          )}
          <Text style={styles.title}>{deck.name}</Text>
          <Text style={styles.description}>{deck.description}</Text>
          <Text style={styles.totalCount}>
            総単語数 {deck.count ? deck.count.toLocaleString() : 0}
          </Text>
        </View>

        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>今日予定</Text>
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{Math.min(deck.metrics.newCards, 20)}</Text>
              <Text style={styles.statLabel}>新規</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{deck.metrics.learningCards}</Text>
              <Text style={styles.statLabel}>学習中</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{deck.metrics.reviewCards}</Text>
              <Text style={styles.statLabel}>復習</Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>収録カード総数</Text>
            <Text style={styles.totalNumber}>{deck.metrics.totalCards}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.mainButton, (isCompleted || loading) && { backgroundColor: '#2E3135' }]}
          onPress={handlePress}
          disabled={isCompleted || loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.mainButtonText, (isCompleted || loading) && { color: '#8E8F94' }]}>
            {getButtonText()}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  iconButton: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: Spacing.two,
    gap: Spacing.two,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.dark.text,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  totalCount: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.two,
    fontWeight: 'bold',
  },
  statsCard: {
    backgroundColor: '#121316',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.dark.text,
    marginBottom: Spacing.four,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    fontFamily: Fonts?.mono,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#2E3135',
    paddingTop: Spacing.three,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  totalNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Fonts?.mono,
    color: Colors.dark.text,
  },
  mainButton: {
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
