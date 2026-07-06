import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, InteractionManager } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { BookOpen, Layers, FileText, ChevronDown } from "lucide-react-native";
import Svg, { Circle } from 'react-native-svg';
import { getDailyMetrics, getStreak, getReviewedTodayCount, getStudyTimeStats } from '../../db/repositories/cardRepository';
import { getSelectedDecks, setSelectedDecks } from '../../db/repositories/selectedDecksRepository';
import { ensureSelectedDeckCards } from '../../db/seed';
import { fetchDecks, ApiDeck } from '../../api/contentApi';
import { AppBar } from "../../components/ui/AppBar";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';

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
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  // Bottom Sheet Ref
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['65%', '90%'], []);
  const [availableDecks, setAvailableDecks] = useState<ApiDeck[]>([]);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);
  const [activeSelectedIds, setActiveSelectedIds] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);

  const loadMetrics = useCallback(() => {
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
      setMetricsLoaded(true);
    } catch (e) {
      console.error('Failed to load metrics', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // 延到分頁過場結束後再查 DB（executeSync 會佔用 JS 執行緒，聚焦瞬間跑會卡過場動畫）。
      // 牌組目錄預載也放這裡（而非 mount 時）：開屏期間 Stack 已渲染，mount 搶跑會早於內容庫掛載而報錯。
      const task = InteractionManager.runAfterInteractions(() => {
        setActiveSelectedIds(getSelectedDecks());
        loadMetrics();
        fetchDecks().then(setAvailableDecks).catch(console.error);
      });
      return () => task.cancel();
    }, [loadMetrics])
  );

  const handleOpenModal = () => {
    setTempSelectedIds(getSelectedDecks());
    bottomSheetModalRef.current?.present();
  };

  const handleConfirmSelection = async () => {
    setSelectedDecks(tempSelectedIds);
    setActiveSelectedIds(tempSelectedIds);
    // 對新選牌組增量建卡（傳入選擇 → 範圍感知；空選擇 = 全部，由 seed 落到預設 JLPT 範圍）。
    // 建卡需連雲端：以 seeding 旗標擋住重複點擊，失敗僅記錄（下次仍可重試）。
    setSeeding(true);
    try {
      await ensureSelectedDeckCards(tempSelectedIds);
    } catch (e) {
      console.error('為新選牌組建卡失敗', e);
    } finally {
      setSeeding(false);
      bottomSheetModalRef.current?.dismiss();
      loadMetrics();
    }
  };

  const handleToggleDeck = (id: string) => {
    setTempSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const hasSelection = activeSelectedIds.length > 0;
  let selectorText = "すべて";

  if (hasSelection) {
    const names = activeSelectedIds.map(id => {
      const d = availableDecks.find(x => x.id === id);
      return d ? d.name : id;
    });
    selectorText = names.join(', ');
  }

  const totalDue = metrics.newCards + metrics.learningCards + metrics.reviewCards;
  // 今日可引入的新卡歸零（達每日上限或已無新卡）→ 速讀今日完了，首頁停用該入口。
  const skimDone = metricsLoaded && metrics.newCards === 0;
  // 進度環 = 今天已複習 / (已複習 + 尚待複習)。全部完成時為滿。
  const plannedToday = reviewedToday + totalDue;
  const progress = plannedToday === 0 ? 1 : reviewedToday / plannedToday;

  const now = new Date();
  const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
  const dateText = `${now.getMonth() + 1}月${now.getDate()}日　${WEEKDAYS[now.getDay()]}曜日`;
  const hour = now.getHours();
  const greeting = hour < 11 ? 'おはよう' : hour < 18 ? 'こんにちは' : 'こんばんは';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={
          <TouchableOpacity
            style={[styles.selectorChip, hasSelection && styles.selectorChipActive]}
            onPress={handleOpenModal}
          >
            <Text
              style={[styles.selectorChipText, hasSelection && styles.selectorChipTextActive]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {selectorText}
            </Text>
            <ChevronDown size={16} color={hasSelection ? Colors.dark.primaryOrange : Colors.dark.textSecondary} style={{ flexShrink: 0 }} />
          </TouchableOpacity>
        }
        rightContent={
          <View style={styles.streakContainer}>
            <Text style={{ fontSize: 14 }}>🔥</Text>
            <Text style={styles.streakText}>{streak}</Text>
          </View>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

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

        </View>

        {/* Modes Header */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>学習モード</Text>
        </View>

        {/* Modes List */}
        <View style={styles.modeList}>
          {skimDone ? (
            <View style={[styles.modeCard, { opacity: 0.6 }]}>
              <View style={styles.modeIcon}>
                <BookOpen size={28} color={Colors.dark.textSecondary} />
              </View>
              <View style={styles.modeInfo}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <Text style={styles.modeTitle}>スキミング</Text>
                  <View style={{ backgroundColor: '#2E3135', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: Colors.dark.textSecondary, fontSize: 10, fontWeight: 'bold' }}>今日完了</Text>
                  </View>
                </View>
                <Text style={styles.modeSubtitle}>今日の新規はすべて振り分け済み</Text>
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.modeCard} onPress={() => router.push('/skim')}>
              <View style={styles.modeIcon}>
                <BookOpen size={28} color={Colors.dark.primaryOrange} />
              </View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeTitle}>スキミング</Text>
                <Text style={styles.modeSubtitle}>単語をすばやく閲覧</Text>
              </View>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.modeCard} onPress={() => router.push('/review')}>
            <View style={styles.modeIcon}>
              <Layers size={28} color={Colors.dark.primaryOrange} />
            </View>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>フラッシュカード</Text>
              <Text style={styles.modeSubtitle}>通常の記憶トレーニング</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modeCard, { opacity: 0.6 }]}
            onPress={() => Alert.alert('近日公開', 'この機能は現在開発中です。お楽しみに！')}
          >
            <View style={styles.modeIcon}>
              <FileText size={28} color={Colors.dark.textSecondary} />
            </View>
            <View style={styles.modeInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={styles.modeTitle}>小テスト</Text>
                <View style={{ backgroundColor: '#2E3135', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: Colors.dark.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Coming soon</Text>
                </View>
              </View>
              <Text style={styles.modeSubtitle}>学習成果の確認</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Range Selector Bottom Sheet */}
      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={snapPoints}
        backdropComponent={(props) => (
          <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
        )}
        backgroundStyle={{ backgroundColor: '#16171B' }}
        handleIndicatorStyle={{ backgroundColor: '#555861' }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: Spacing.four, paddingTop: Spacing.two }}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>学習範囲</Text>
            <TouchableOpacity onPress={() => bottomSheetModalRef.current?.dismiss()} style={{ padding: Spacing.one }}>
              <Text style={styles.modalCloseText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Scrollable List */}
        <BottomSheetScrollView 
          style={{ flex: 1 }} 
          contentContainerStyle={{ paddingHorizontal: Spacing.four, paddingBottom: Spacing.four }}
          showsVerticalScrollIndicator={true}
        >
          <TouchableOpacity
            style={styles.modalRow}
            onPress={() => setTempSelectedIds([])}
            activeOpacity={0.7}
          >
            <View style={[styles.checkbox, tempSelectedIds.length === 0 && styles.checkboxActive]}>
              {tempSelectedIds.length === 0 && <View style={styles.checkboxInner} />}
            </View>
            <Text style={styles.modalRowTitle}>すべて</Text>
          </TouchableOpacity>

          {availableDecks.map(deck => {
            const isSelected = tempSelectedIds.includes(deck.id);
            return (
              <TouchableOpacity
                key={deck.id}
                style={styles.modalRow}
                onPress={() => handleToggleDeck(deck.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                  {isSelected && <View style={styles.checkboxInner} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalRowTitle}>{deck.name}</Text>
                  <Text style={styles.modalRowSub}>{deck.count} 枚</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </BottomSheetScrollView>

        {/* Footer */}
        <View style={{ paddingHorizontal: Spacing.four, paddingBottom: Math.max(insets.bottom, 24), paddingTop: Spacing.two }}>
          <TouchableOpacity
            style={[styles.confirmButton, seeding && { opacity: 0.6 }, { marginTop: 0 }]}
            onPress={handleConfirmSelection}
            disabled={seeding}
            activeOpacity={seeding ? 1 : 0.7}
          >
            <Text style={styles.confirmButtonText}>{seeding ? '準備中…' : '確定'}</Text>
          </TouchableOpacity>
        </View>
      </BottomSheetModal>
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
    paddingBottom: 140, // 內容要滑過浮層 Nav bar（漸層），底部需留高於 bar 的空間
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
    borderWidth: 1,
    borderColor: 'transparent',
    flexShrink: 1,
  },
  selectorChipActive: {
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  selectorChipText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: 'bold',
    flexShrink: 1,
  },
  selectorChipTextActive: {
    color: Colors.dark.primaryOrange,
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
    marginRight: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
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
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  modalTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  modalList: {
    marginBottom: Spacing.four,
  },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#2E3135',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#555861',
    marginRight: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    borderColor: Colors.dark.primaryOrange,
  },
  checkboxInner: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: Colors.dark.primaryOrange,
  },
  modalRowTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    marginBottom: 2,
  },
  modalRowSub: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  confirmButton: {
    backgroundColor: Colors.dark.primaryOrange,
    paddingVertical: 16,
    borderRadius: BORDER_RADIUS.lg,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  confirmButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
