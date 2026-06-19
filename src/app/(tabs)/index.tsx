import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import Svg, { Circle } from 'react-native-svg';
import { getDailyMetrics, getStreak, getReviewedTodayCount, getStudyTimeStats } from '../../db/repositories/cardRepository';
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
  const [streak, setStreak] = useState(0);
  const [reviewedToday, setReviewedToday] = useState(0);
  const [studyMinutes, setStudyMinutes] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      // 本機指標即時可得（同步）。
      try {
        const data = getDailyMetrics();
        setMetrics({
          newCards: Math.min(data.newCards, 20),
          learningCards: data.learningCards,
          reviewCards: data.reviewCards
        });
        setStreak(getStreak());
        setReviewedToday(getReviewedTodayCount());
        const timeStats = getStudyTimeStats();
        setStudyMinutes(Math.floor(timeStats.todayMs / 60000));
      } catch (e) {
        console.error('Failed to load metrics', e);
      }

      return () => { cancelled = true; };
    }, [])
  );

  const totalDue = metrics.newCards + metrics.learningCards + metrics.reviewCards;
  // 進度環 = 今天已複習 / (已複習 + 尚待複習)。全部完成時為滿。
  const plannedToday = reviewedToday + totalDue;
  const progress = plannedToday === 0 ? 1 : reviewedToday / plannedToday;

  const now = new Date();
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日　${WEEKDAYS[now.getDay()]}曜日`;
  const hour = now.getHours();
  const greeting = hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: Math.max(insets.top, 16) }]} showsVerticalScrollIndicator={false}>
        
        {/* Header Row */}
        <View style={styles.headerRow}>
          <Text style={styles.dateText}>{dateText}</Text>
          <View style={styles.streakContainer}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        </View>

        <Text style={styles.greetingText}>{greeting}</Text>

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
              <View style={[styles.statRow, { paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: '#2E3135' }]}>
                <View style={[styles.statDot, { backgroundColor: Colors.dark.primaryOrange }]} />
                <Text style={styles.statLabel}>今日の学習</Text>
                <Text style={styles.statValue}>{studyMinutes}分</Text>
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

        {/* Modes Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>學習模式</Text>
        </View>

        {/* Modes List */}
        <View style={styles.modeList}>
          <TouchableOpacity style={styles.modeCard} onPress={() => {}}>
            <Text style={styles.modeIcon}>📖</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>略讀</Text>
              <Text style={styles.modeSubtitle}>快速瀏覽詞彙</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => {}}>
            <Text style={styles.modeIcon}>📇</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>閃卡</Text>
              <Text style={styles.modeSubtitle}>常規記憶訓練</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => {}}>
            <Text style={styles.modeIcon}>📝</Text>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>小考</Text>
              <Text style={styles.modeSubtitle}>驗證學習成果</Text>
            </View>
          </TouchableOpacity>
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
  modeList: {
    gap: Spacing.three,
  },
  modeCard: {
    backgroundColor: '#121316',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: '#2E3135',
    flexDirection: 'row',
    alignItems: 'center',
  },
  modeIcon: {
    fontSize: 28,
    marginRight: Spacing.three,
  },
  modeInfo: {
    flex: 1,
  },
  modeTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  modeSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  }
});
