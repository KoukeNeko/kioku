import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import Svg, { Circle } from 'react-native-svg';
import { getDailyMetrics } from '../../db/repositories/cardRepository';
import { getAllDecksWithMetrics, Deck } from '../../db/repositories/deckRepository';
import { useState, useCallback } from 'react';

const CircularProgress = ({ progress, size, strokeWidth, color, trackColor, children }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress * circumference);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="none"
          originX={size / 2}
          originY={size / 2}
          rotation="-90"
        />
      </Svg>
      {children}
    </View>
  );
};

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [metrics, setMetrics] = useState({ newCards: 0, learningCards: 0, reviewCards: 0 });
  const [decks, setDecks] = useState<Deck[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        const data = getDailyMetrics();
        setMetrics({
          newCards: Math.min(data.newCards, 20),
          learningCards: data.learningCards,
          reviewCards: data.reviewCards
        });

        const decksData = getAllDecksWithMetrics();
        setDecks(decksData);
      } catch (e) {
        console.error('Failed to load metrics or decks', e);
      }
    }, [])
  );

  const totalDue = metrics.newCards + metrics.learningCards + metrics.reviewCards;
  // Let's assume a daily target of say 40 cards total (20 new + 20 reviews ideally), 
  // or just base progress on whether totalDue is 0.
  // We'll hardcode a fake daily quota denominator for the visualization for now, 
  // or use totalDue as remaining.
  // Actually, if we just want a progress bar of today's session:
  // If totalDue is 0, progress is 1. Else progress is something like 0.2 just for visual
  const progress = totalDue === 0 ? 1 : 0.3; // Placeholder progress logic

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 16) }]} showsVerticalScrollIndicator={false}>
        
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.dateText}>6月17日　火曜日</Text>
          <View style={styles.streakContainer}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={styles.streakText}>12</Text>
          </View>
        </View>

        <Text style={styles.greetingText}>おはよう</Text>

        {/* Main Goal Card */}
        <View style={styles.mainCard}>
          <View style={styles.mainCardTopRow}>
            {/* Circular Progress */}
            <View style={styles.chartContainer}>
              <CircularProgress 
                progress={progress} 
                size={110} 
                strokeWidth={10} 
                color={totalDue === 0 ? '#66D283' : Colors.dark.primaryOrange} 
                trackColor="#2E3135"
              >
                <View style={{ alignItems: 'center', marginTop: 4 }}>
                  <Text style={styles.chartBigText}>{totalDue}</Text>
                  <Text style={styles.chartSmallText}>枚予定</Text>
                </View>
              </CircularProgress>
            </View>

            {/* Stats List */}
            <View style={styles.statsList}>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#FF5A36' }]} />
                <Text style={styles.statLabel}>新規</Text>
                <Text style={styles.statValue}>{metrics.newCards}</Text>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#F0A944' }]} />
                <Text style={styles.statLabel}>学習中</Text>
                <Text style={styles.statValue}>{metrics.learningCards}</Text>
              </View>
              <View style={styles.statRow}>
                <View style={[styles.statDot, { backgroundColor: '#66D283' }]} />
                <Text style={styles.statLabel}>復習</Text>
                <Text style={styles.statValue}>{metrics.reviewCards}</Text>
              </View>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity 
            style={[styles.mainButton, totalDue === 0 && { backgroundColor: '#2E3135' }]}
            onPress={() => {
              if (totalDue > 0) {
                router.push("/review");
              }
            }}
            activeOpacity={totalDue === 0 ? 1 : 0.7}
          >
            <Text style={[styles.mainButtonText, totalDue === 0 && { color: '#8E8F94' }]}>
              {totalDue === 0 ? '今日の目標達成！ 🎉' : '復習を始める　→'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Decks Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>デッキ</Text>
          <TouchableOpacity>
            <Text style={styles.viewAllText}>すべて表示</Text>
          </TouchableOpacity>
        </View>

        {/* Decks List */}
        <View style={styles.deckList}>
          {decks.map(deck => {
            const dueCount = deck.metrics.dueCards; // This includes ALL new cards, maybe we should cap it or just display it. Let's cap visual new cards to 20 for the deck due too? Wait, dueCards in deck metric is total due. 
            // We can just use the same logic: newCards capped to 20 per deck for display.
            const displayDue = Math.min(deck.metrics.newCards, 20) + deck.metrics.learningCards + deck.metrics.reviewCards;
            const progressRatio = deck.metrics.totalCards > 0 ? (deck.metrics.totalCards - displayDue) / deck.metrics.totalCards : 1;
            const progressPercent = Math.max(0, Math.min(100, progressRatio * 100));
            const isCompleted = displayDue === 0;

            return (
              <TouchableOpacity 
                key={deck.id} 
                style={styles.deckCard} 
                onPress={() => router.push(`/deck/${deck.id}`)}
              >
                <View style={styles.deckContentRow}>
                  <View style={styles.deckLeft}>
                    <View style={styles.deckTitleRow}>
                      <Text style={styles.deckTitle}>{deck.name}</Text>
                      {deck.tags && deck.tags.length > 0 && (
                        <View style={[styles.tagBadge, { backgroundColor: '#1C2939' }]}>
                          <Text style={[styles.tagText, { color: '#68A5FF' }]}>{deck.tags[0]}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.deckSubtitle}>{deck.description}</Text>
                  </View>
                  <View style={styles.deckRight}>
                    <Text style={[styles.dueCount, { color: isCompleted ? '#66D283' : Colors.dark.primaryOrange }]}>
                      {displayDue}
                    </Text>
                    <Text style={styles.dueLabel}>予定</Text>
                  </View>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: isCompleted ? '#66D283' : Colors.dark.primaryOrange }]} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  scrollContent: {
    padding: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  dateText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontFamily: Fonts?.sans,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2024',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  streakText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  greetingText: {
    color: Colors.dark.text,
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.three, // reduced
    fontFamily: Fonts?.sans,
  },
  mainCard: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.four, // reduced from Spacing.five
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.five, // reduced from Spacing.six
  },
  mainCardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four, // reduced from Spacing.five
  },
  chartContainer: {
    width: 110,
    height: 110,
  },
  chartBigText: {
    color: Colors.dark.text,
    fontSize: 32,
    fontWeight: 'bold',
  },
  chartSmallText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: -4,
  },
  statsList: {
    flex: 1,
    marginLeft: Spacing.four, // reduced from five
    gap: Spacing.two, // reduced from three
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginRight: Spacing.three,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  statValue: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  mainButton: {
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14, // reduced from 18
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: Spacing.four,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  viewAllText: {
    color: Colors.dark.primaryOrange,
    fontSize: 14,
  },
  deckList: {
    gap: Spacing.three, // reduced from four
  },
  deckCard: {
    backgroundColor: '#121316',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  deckContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  deckLeft: {
    flex: 1,
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Spacing.two,
  },
  deckTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  deckSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  deckRight: {
    alignItems: 'center',
    marginLeft: Spacing.three,
  },
  dueCount: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: -2,
  },
  dueLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#2E3135',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  }
});
