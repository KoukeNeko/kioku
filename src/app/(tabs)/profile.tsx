import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { AppBar } from "../../components/ui/AppBar";
import { SettingsCard, SettingsRow, SettingsDivider } from "../../components/ui/SettingsCard";
import { Settings, ChevronRight, Check, Trophy, BarChart2, HelpCircle, MessageSquare } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';

export default function Profile() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={<Text style={styles.headerTitle}>マイページ</Text>}
        rightContent={
          <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/settings')}>
            <Settings size={26} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Profile Card */}
        <TouchableOpacity style={styles.profileCard}>
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
        </TouchableOpacity>

        {/* This Week's Goal Card */}
        <View style={styles.goalCard}>
          <View style={styles.goalHeader}>
            <Text style={styles.goalTitle}>今週の目標</Text>
            <View style={styles.goalProgress}>
              <Text style={styles.goalProgressText}>5 / 7</Text>
              <Text style={styles.goalProgressLabel}> 日</Text>
            </View>
          </View>

          <View style={styles.daysRow}>
            {[
              { day: '月', status: 'done' },
              { day: '火', status: 'done' },
              { day: '水', status: 'done' },
              { day: '木', status: 'done' },
              { day: '金', status: 'done' },
              { day: '土', status: 'today' },
              { day: '日', status: 'future' },
            ].map((item, index) => (
              <View key={index} style={styles.dayCol}>
                <View style={[
                  styles.dayCircle,
                  item.status === 'done' && styles.dayCircleDone,
                  item.status === 'today' && styles.dayCircleToday,
                  item.status === 'future' && styles.dayCircleFuture,
                ]}>
                  {item.status === 'done' && <Check size={18} color="#000" strokeWidth={3} />}
                </View>
                <Text style={[
                  styles.dayText,
                  item.status === 'today' && { color: Colors.dark.primaryOrange },
                ]}>
                  {item.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Upgrade Card */}
        <TouchableOpacity>
          <LinearGradient
            colors={['rgba(255, 90, 54, 0.15)', '#16171B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.upgradeCard}
          >
            <View style={styles.upgradeCardInner}>
              <View style={styles.upgradeInfo}>
                <Text style={styles.upgradeTitle}>Kioku Pro</Text>
                <Text style={styles.upgradeSub}>無制限のデッキ・ピッチ音声・統計</Text>
              </View>
              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>アップグレード</Text>
              </View>
            </View>
          </LinearGradient>
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
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Fonts?.sans,
  },
  iconButton: {
    padding: Spacing.one,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: 120, // Huge padding to clear the Tab Bar
  },
  profileCard: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.three,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
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
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
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
  goalCard: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.three,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  goalTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  goalProgress: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  goalProgressText: {
    color: '#66D283',
    fontSize: 16,
    fontWeight: 'bold',
  },
  goalProgressLabel: {
    color: '#66D283',
    fontSize: 13,
  },
  daysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCol: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleDone: {
    backgroundColor: '#66D283',
  },
  dayCircleToday: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.dark.primaryOrange,
  },
  dayCircleFuture: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  dayText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginBottom: Spacing.three,
    marginLeft: Spacing.one,
  },
  upgradeCard: {
    borderRadius: BORDER_RADIUS.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  upgradeCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  upgradeInfo: {
    flex: 1,
    paddingRight: Spacing.three,
  },
  upgradeTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: Spacing.one,
  },
  upgradeSub: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  upgradeButton: {
    backgroundColor: Colors.dark.primaryOrange,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: BORDER_RADIUS.sm,
  },
  upgradeButtonText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 14,
  }
});
