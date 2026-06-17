import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { AppBar } from "../../components/ui/AppBar";
import { Settings, ChevronRight } from "lucide-react-native";

export default function Profile() {
  const [furiganaEnabled, setFuriganaEnabled] = useState(true);
  const [pitchAccent, setPitchAccent] = useState<'上線' | '数字'>('上線');
  const [displayFont, setDisplayFont] = useState<'明朝' | 'ゴシック'>('明朝');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar 
        leftContent={<Text style={styles.headerTitle}>マイページ</Text>}
        rightContent={
          <TouchableOpacity style={styles.iconButton}>
            <Settings size={24} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.profileInfo}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>春</Text>
              </View>
              <View>
                <Text style={styles.nameText}>はるき</Text>
                <Text style={styles.subText}>JLPT N3 を目標・30分／日</Text>
              </View>
            </View>
            <ChevronRight size={20} color={Colors.dark.textSecondary} />
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.dark.primaryOrange }]}>12</Text>
              <Text style={styles.statLabel}>連続日数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.dark.text }]}>8,420</Text>
              <Text style={styles.statLabel}>総復習数</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: Colors.dark.text }]}>47</Text>
              <Text style={styles.statLabel}>学習日数</Text>
            </View>
          </View>
        </View>

        {/* Engine Section Header */}
        <View style={styles.sectionHeader}>
          <View style={styles.engineDot} />
          <Text style={styles.sectionHeaderText}>学習エンジン ・ FSRS-6</Text>
        </View>

        {/* Engine Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>目標定着率</Text>
            <View style={styles.sliderContainer}>
               <View style={styles.sliderTrack}>
                 <View style={styles.sliderFill} />
                 <View style={styles.sliderThumb} />
               </View>
               <Text style={styles.sliderValueText}>90%</Text>
            </View>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>1日の新規カード上限</Text>
            <Text style={styles.rowValue}>24</Text>
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>最大間隔</Text>
            <Text style={styles.rowValue}>1年</Text>
          </View>

          <View style={[styles.cardRow, { paddingBottom: 0 }]}>
            <View>
              <Text style={styles.rowLabel}>パラメータ最適化</Text>
              <Text style={styles.rowSubText}>12,840件のログで再学習</Text>
            </View>
            <TouchableOpacity style={styles.executeButton}>
              <Text style={styles.executeButtonText}>実行</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Display Section Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>表示</Text>
        </View>

        {/* Display Card */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>ふりがな（既定）</Text>
            <Switch 
              value={furiganaEnabled}
              onValueChange={setFuriganaEnabled}
              trackColor={{ false: '#2E3135', true: Colors.dark.primaryOrange }}
              thumbColor={furiganaEnabled ? '#16171B' : '#8E9196'}
              ios_backgroundColor="#2E3135"
            />
          </View>

          <View style={styles.cardRow}>
            <Text style={styles.rowLabel}>ピッチ表記</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity 
                style={[styles.segmentButton, pitchAccent === '上線' && { backgroundColor: '#5CB3FF' }]}
                onPress={() => setPitchAccent('上線')}
              >
                <Text style={[styles.segmentText, { color: pitchAccent === '上線' ? '#000' : Colors.dark.textSecondary, fontWeight: pitchAccent === '上線' ? 'bold' : 'normal' }]}>上線</Text>
              </TouchableOpacity>
              <Text style={styles.segmentDivider}>＼</Text>
              <TouchableOpacity 
                style={[styles.segmentButton, pitchAccent === '数字' && { backgroundColor: '#5CB3FF' }]}
                onPress={() => setPitchAccent('数字')}
              >
                <Text style={[styles.segmentText, { color: pitchAccent === '数字' ? '#000' : Colors.dark.textSecondary, fontWeight: pitchAccent === '数字' ? 'bold' : 'normal' }]}>数字</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.cardRow, { paddingBottom: 0 }]}>
            <Text style={styles.rowLabel}>表示フォント</Text>
            <View style={styles.segmentControl}>
              <TouchableOpacity 
                style={[styles.segmentButton, displayFont === '明朝' && { backgroundColor: '#202636' }]}
                onPress={() => setDisplayFont('明朝')}
              >
                <Text style={[styles.segmentText, { color: displayFont === '明朝' ? '#FFF' : Colors.dark.textSecondary }]}>明朝</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.segmentButton, displayFont === 'ゴシック' && { backgroundColor: '#202636' }]}
                onPress={() => setDisplayFont('ゴシック')}
              >
                <Text style={[styles.segmentText, { color: displayFont === 'ゴシック' ? '#FFF' : Colors.dark.textSecondary }]}>ゴシック</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Audio Section Header */}
        <View style={[styles.sectionHeader, { marginBottom: Spacing.six }]}>
          <Text style={styles.sectionHeaderText}>音声・データ</Text>
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
    padding: Spacing.three,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Fonts?.sans,
  },
  iconButton: {
    padding: Spacing.one,
  },
  profileCard: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.three, // reduced
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.three, // reduced
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three, // reduced
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1C222F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.dark.primaryOrange,
    fontSize: 28,
    fontWeight: 'bold',
  },
  nameText: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
    fontFamily: Fonts?.sans,
  },
  statLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#2E3135',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.two,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.one,
  },
  engineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.primaryOrange,
  },
  sectionHeaderText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  card: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.three, // reduced
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.three, // reduced
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.three, // reduced
  },
  rowLabel: {
    color: Colors.dark.text,
    fontSize: 16,
  },
  rowValue: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  rowSubText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderTrack: {
    width: 100,
    height: 4,
    backgroundColor: '#2E3135',
    borderRadius: 2,
    justifyContent: 'center',
  },
  sliderFill: {
    width: '90%',
    height: 4,
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: 2,
    position: 'absolute',
    left: 0,
  },
  sliderThumb: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFF',
    position: 'absolute',
    left: '85%',
  },
  sliderValueText: {
    color: Colors.dark.primaryOrange,
    fontSize: 16,
    fontWeight: 'bold',
  },
  executeButton: {
    backgroundColor: Colors.dark.primaryOrange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.md,
  },
  executeButtonText: {
    color: '#16171B', // Dark text on orange button
    fontSize: 14,
    fontWeight: 'bold',
  },
  segmentControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1014',
    borderRadius: 8,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1C1D22',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 14,
  },
  segmentDivider: {
    color: '#2E3135',
    marginHorizontal: 4,
    fontSize: 12,
  }
});
