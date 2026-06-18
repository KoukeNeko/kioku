import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppBar } from "../../components/ui/AppBar";
import { getStats, Stats as StatsData } from "../../db/repositories/statsRepository";

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useFocusEffect(
    useCallback(() => {
      try {
        setStats(getStats());
      } catch (e) {
        console.error('Failed to load stats', e);
      }
    }, [])
  );

  const barChartData = stats?.next7 ?? [];
  const maxBarValue = Math.max(1, ...barChartData.map(d => d.count));
  const contributionGrid = stats?.grid ?? Array.from({ length: 7 }, () => new Array(12).fill(0));
  const mat = stats?.maturity ?? { newC: 0, learnC: 0, youngC: 0, matureC: 0 };
  const retentionText = stats?.retention != null ? `${Math.round(stats.retention * 100)}%` : '—';

  const getGridColor = (level: number) => {
    switch (level) {
      case 1: return '#2E6E45'; // Dark green
      case 2: return '#42A860'; // Medium green
      case 3: return '#66D283'; // Light green
      default: return '#16171B'; // Empty dark
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar 
        leftContent={
          <Text style={styles.headerTitle}>統計</Text>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.dark.primaryOrange }]}>{stats?.streak ?? 0}</Text>
            <Text style={styles.summaryLabel}>連続日数</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{stats?.reviewsToday ?? 0}</Text>
            <Text style={styles.summaryLabel}>本日の復習</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#66D283' }]}>{retentionText}</Text>
            <Text style={styles.summaryLabel}>定着率</Text>
          </View>
        </View>

        {/* Future Schedule (Bar Chart) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今後7日の予定</Text>
            <Text style={styles.sectionSubtitle}>{stats?.next7Total ?? 0} 枚</Text>
          </View>
          
          <View style={styles.barChartContainer}>
            {barChartData.map((item, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={styles.barWrapper}>
                  <View style={[
                    styles.barFill,
                    { height: `${(item.count / maxBarValue) * 100}%` }
                  ]} />
                </View>
                <Text style={styles.barLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Review History (Contribution Grid) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>復習の記録</Text>
            <Text style={styles.sectionSubtitle}>12週間</Text>
          </View>
          
          <View style={styles.gridContainer}>
            {contributionGrid.map((row, rowIndex) => (
              <View key={rowIndex} style={styles.gridRow}>
                {row.map((cell, colIndex) => (
                  <View 
                    key={colIndex} 
                    style={[styles.gridCell, { backgroundColor: getGridColor(cell) }]} 
                  />
                ))}
              </View>
            ))}
          </View>

          <View style={styles.gridLegend}>
            <Text style={styles.legendText}>少</Text>
            <View style={[styles.legendBox, { backgroundColor: '#16171B' }]} />
            <View style={[styles.legendBox, { backgroundColor: '#2E6E45' }]} />
            <View style={[styles.legendBox, { backgroundColor: '#42A860' }]} />
            <View style={[styles.legendBox, { backgroundColor: '#66D283' }]} />
            <Text style={styles.legendText}>多</Text>
          </View>
        </View>

        {/* Card Maturity (Stacked Bar) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>カードの成熟度</Text>
          
          <View style={styles.stackedBarContainer}>
            <View style={[styles.stackedSegment, { flex: mat.newC, backgroundColor: Colors.dark.ratingAgain, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
            <View style={[styles.stackedSegment, { flex: mat.learnC, backgroundColor: Colors.dark.ratingHard }]} />
            <View style={[styles.stackedSegment, { flex: mat.youngC, backgroundColor: Colors.dark.ratingGood }]} />
            <View style={[styles.stackedSegment, { flex: mat.matureC, backgroundColor: Colors.dark.ratingEasy, borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.two }}>
            <Text style={styles.legendText}>新規 {mat.newC}</Text>
            <Text style={styles.legendText}>学習 {mat.learnC}</Text>
            <Text style={styles.legendText}>若い {mat.youngC}</Text>
            <Text style={styles.legendText}>熟成 {mat.matureC}</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Fonts?.sans,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 120,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#121316',
    borderWidth: 1,
    borderColor: '#2E3135',
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: Spacing.three, // Reduced padding
    paddingHorizontal: Spacing.two,
    alignItems: 'flex-start',
  },
  summaryValue: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  summaryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
  },
  sectionCard: {
    backgroundColor: '#121316',
    borderWidth: 1,
    borderColor: '#2E3135',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.three, // Reduced padding
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  sectionTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  // Bar Chart
  barChartContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  barColumn: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  barFill: {
    width: '70%',
    backgroundColor: '#DF6C53', // Salmon/Orange color from screenshot
    borderRadius: 4,
  },
  barLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  // Contribution Grid
  gridContainer: {
    gap: 4,
    marginBottom: Spacing.three,
  },
  gridRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 4,
  },
  gridCell: {
    flex: 1,
    aspectRatio: 1, // Make them perfectly square
    borderRadius: 4,
  },
  gridLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  legendText: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
  },
  legendBox: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  // Stacked Bar
  stackedBarContainer: {
    flexDirection: 'row',
    height: 16,
    width: '100%',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  stackedSegment: {
    height: '100%',
  }
});
