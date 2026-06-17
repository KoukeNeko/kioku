import React from "react";
import { View, Text, StyleSheet, ScrollView, SafeAreaView } from "react-native";
import { Colors, Spacing, BORDER_RADIUS } from "../../constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Settings, User, Flame } from "lucide-react-native";
import { AppBar } from "../../components/ui/AppBar";
import { TouchableOpacity } from "react-native";

export default function Stats() {
  const insets = useSafeAreaInsets();
  
  // Mock data for bar chart
  const barChartData = [
    { label: '月', value: 30 },
    { label: '火', value: 65 },
    { label: '水', value: 45 },
    { label: '木', value: 85 },
    { label: '金', value: 40 },
    { label: '土', value: 20 },
    { label: '日', value: 55 },
  ];
  const maxBarValue = Math.max(...barChartData.map(d => d.value));

  // Mock data for contribution grid (7 rows, 12 cols)
  // 0: empty, 1: light, 2: medium, 3: dark
  const generateGrid = () => {
    const grid = [];
    for (let r = 0; r < 7; r++) {
      const row = [];
      for (let c = 0; c < 12; c++) {
        // Randomize some green intensity
        row.push(Math.floor(Math.random() * 4));
      }
      grid.push(row);
    }
    return grid;
  };
  const contributionGrid = generateGrid();
  
  const getGridColor = (level: number) => {
    switch (level) {
      case 1: return '#2E6E45'; // Dark green
      case 2: return '#42A860'; // Medium green
      case 3: return '#66D283'; // Light green
      default: return '#16171B'; // Empty dark
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <AppBar 
        centerContent={
          <Text style={{ color: Colors.dark.text, fontSize: 18, fontWeight: 'bold' }}>統計</Text>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Top Summary Cards */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: Colors.dark.primaryOrange }]}>12</Text>
            <Text style={styles.summaryLabel}>連続日数</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>142</Text>
            <Text style={styles.summaryLabel}>本日の復習</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={[styles.summaryValue, { color: '#66D283' }]}>91%</Text>
            <Text style={styles.summaryLabel}>真の定着率</Text>
          </View>
        </View>

        {/* Future Schedule (Bar Chart) */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>今後7日の予定</Text>
            <Text style={styles.sectionSubtitle}>286 枚</Text>
          </View>
          
          <View style={styles.barChartContainer}>
            {barChartData.map((item, index) => (
              <View key={index} style={styles.barColumn}>
                <View style={[
                  styles.barFill, 
                  { height: `${(item.value / maxBarValue) * 100}%` }
                ]} />
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
            <View style={[styles.stackedSegment, { flex: 15, backgroundColor: Colors.dark.ratingAgain, borderTopLeftRadius: 8, borderBottomLeftRadius: 8 }]} />
            <View style={[styles.stackedSegment, { flex: 10, backgroundColor: Colors.dark.ratingHard }]} />
            <View style={[styles.stackedSegment, { flex: 35, backgroundColor: Colors.dark.ratingGood }]} />
            <View style={[styles.stackedSegment, { flex: 40, backgroundColor: Colors.dark.ratingEasy, borderTopRightRadius: 8, borderBottomRightRadius: 8 }]} />
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
  scrollContent: {
    padding: Spacing.four,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.five,
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
    marginBottom: Spacing.five,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
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
  barFill: {
    width: '70%',
    backgroundColor: '#DF6C53', // Salmon/Orange color from screenshot
    borderRadius: 4,
    marginBottom: Spacing.two,
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
