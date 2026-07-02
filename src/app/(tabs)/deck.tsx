import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { AppBar } from "../../components/ui/AppBar";
import { FuriganaText } from "../../components/ui/FuriganaText";
import { BackButton } from "../../components/ui/BackButton";
import { MoreHorizontal, Plus } from "lucide-react-native";

export default function Deck() {
  const router = useRouter();

  const mockWords = [
    { kanji: [{ ruby: "図", rt: "としょ" }, { ruby: "館", rt: "かん" }], english: "library", status: "4d", statusColor: "#66D283" },
    { kanji: [{ ruby: "経", rt: "けい" }, { ruby: "済", rt: "ざい" }], english: "economy", status: "11h", statusColor: "#F0A944" },
    { kanji: [{ ruby: "約", rt: "やく" }, { ruby: "束", rt: "そく" }], english: "promise", status: "新規", statusColor: "#FF5A36" },
    { kanji: [{ ruby: "影", rt: "えい" }, { ruby: "響", rt: "きょう" }], english: "influence", status: "21d", statusColor: "#66D283" },
    { kanji: [{ ruby: "騒", rt: "さわ" }, { ruby: "がしい" }], english: "noisy", status: "2mo", statusColor: "#66D283" },
    { kanji: [{ ruby: "似", rt: "に" }, { ruby: "合", rt: "あ" }, { ruby: "う" }], english: "to suit", status: "8m", statusColor: "#F0A944" },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={
          <BackButton />
        }
        centerContent={
          <Text style={styles.headerTitle}>N3 語彙</Text>
        }
        rightContent={
          <TouchableOpacity style={styles.iconButton}>
            <MoreHorizontal size={24} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        }
      />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Top Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#FF5A36' }]}>12</Text>
              <Text style={styles.statLabel}>新規</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#F0A944' }]}>7</Text>
              <Text style={styles.statLabel}>学習中</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: '#66D283' }]}>23</Text>
              <Text style={styles.statLabel}>復習</Text>
            </View>
          </View>
          
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.studyButton} onPress={() => router.push("/review")}>
              <Text style={styles.studyButtonText}>学習する　→</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton}>
              <Plus color={Colors.dark.textSecondary} size={24} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Middle Header */}
        <View style={styles.listHeader}>
          <Text style={styles.listTotal}>324 語</Text>
          <View style={styles.retentionContainer}>
            <View style={styles.retentionDot} />
            <Text style={styles.retentionText}>定着率 89%</Text>
          </View>
        </View>

        {/* Word List */}
        <View style={styles.wordList}>
          {mockWords.map((word, i) => (
            <View key={i} style={styles.wordCard}>
              <View style={styles.wordLeft}>
                <View style={styles.kanjiEnglishRow}>
                  <View style={{ alignItems: 'flex-start' }}>
                    <FuriganaText chunks={word.kanji} fontSize={28} />
                  </View>
                  <Text style={styles.wordEnglish}>{word.english}</Text>
                </View>
              </View>
              <View style={styles.wordRight}>
                <View style={[styles.statusBadge, { backgroundColor: word.statusColor + '20' }]}>
                  <Text style={[styles.statusText, { color: word.statusColor }]}>{word.status}</Text>
                </View>
              </View>
            </View>
          ))}
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
  scrollContent: { paddingTop: 24,
    padding: Spacing.three,
  },
  iconButton: {
    padding: Spacing.two,
    marginLeft: -Spacing.two, // Offset the padding visually
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Fonts?.sans,
  },
  statsCard: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.four,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.four,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#2E3135',
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  studyButton: {
    flex: 1,
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: BORDER_RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studyButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  addButton: {
    width: 52,
    height: 52,
    backgroundColor: '#1C1D22',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: '#2E3135',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
    paddingHorizontal: Spacing.one,
  },
  listTotal: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  retentionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  retentionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#66D283',
  },
  retentionText: {
    color: '#66D283',
    fontSize: 14,
  },
  wordList: {
    gap: Spacing.two,
  },
  wordCard: {
    backgroundColor: '#121316',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wordLeft: {
    flex: 1,
    marginTop: -3, // Slightly shift up to balance Furigana, without overcompensating
  },
  kanjiEnglishRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
  },
  wordEnglish: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
    marginBottom: 4, // Align visually with Kanji baseline
  },
  wordRight: {
    marginLeft: Spacing.three,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  }
});
