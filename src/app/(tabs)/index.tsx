import React, { useState, useCallback, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { BookOpen, Layers, FileText, ChevronDown } from "lucide-react-native";
import Svg, { Circle } from 'react-native-svg';
import { getDailyMetrics, getStreak, getReviewedTodayCount, getStudyTimeStats } from '../../db/repositories/cardRepository';
import { getSelectedDecks, setSelectedDecks } from '../../db/repositories/selectedDecksRepository';
import { fetchDecks, ApiDeck } from '../../api/contentApi';

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

  const [modalVisible, setModalVisible] = useState(false);
  const [availableDecks, setAvailableDecks] = useState<ApiDeck[]>([]);
  const [tempSelectedIds, setTempSelectedIds] = useState<string[]>([]);

  // 嘗試預載以供按鈕顯示文字
  useEffect(() => {
    fetchDecks().then(setAvailableDecks).catch(console.error);
  }, []);

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
    } catch (e) {
      console.error('Failed to load metrics', e);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMetrics();
      return () => {};
    }, [loadMetrics])
  );

  const handleOpenModal = () => {
    setTempSelectedIds(getSelectedDecks());
    setModalVisible(true);
  };

  const handleConfirmSelection = () => {
    setSelectedDecks(tempSelectedIds);
    setModalVisible(false);
    loadMetrics();
  };

  const handleToggleDeck = (id: string) => {
    setTempSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectedDecks = getSelectedDecks();
  let selectorText = "全部";
  if (selectedDecks.length === 1) {
    const deck = availableDecks.find(d => d.id === selectedDecks[0]);
    if (deck) {
      selectorText = deck.name.replace('JLPT ', '');
    }
  } else if (selectedDecks.length > 1) {
    const firstDeck = availableDecks.find(d => d.id === selectedDecks[0]);
    if (firstDeck) {
      selectorText = `${firstDeck.name.replace('JLPT ', '')} +${selectedDecks.length - 1}`;
    } else {
      selectorText = `多個範圍`;
    }
  }

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
          <TouchableOpacity style={styles.selectorChip} onPress={handleOpenModal}>
            <Text style={styles.selectorChipText}>{selectorText}</Text>
            <ChevronDown size={16} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
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
          <TouchableOpacity style={styles.modeCard} onPress={() => router.push('/skim')}>
            <View style={styles.modeIcon}>
              <BookOpen size={28} color={Colors.dark.primaryOrange} />
            </View>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>略讀</Text>
              <Text style={styles.modeSubtitle}>快速瀏覽詞彙</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.modeCard} onPress={() => router.push('/review')}>
            <View style={styles.modeIcon}>
              <Layers size={28} color={Colors.dark.primaryOrange} />
            </View>
            <View style={styles.modeInfo}>
              <Text style={styles.modeTitle}>閃卡</Text>
              <Text style={styles.modeSubtitle}>常規記憶訓練</Text>
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
                <Text style={styles.modeTitle}>小考</Text>
                <View style={{ backgroundColor: '#2E3135', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                  <Text style={{ color: Colors.dark.textSecondary, fontSize: 10, fontWeight: 'bold' }}>Coming soon</Text>
                </View>
              </View>
              <Text style={styles.modeSubtitle}>驗證學習成果</Text>
            </View>
          </TouchableOpacity>
        </View>

      </ScrollView>

      {/* Range Selector Modal */}
      <Modal visible={modalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>學習範圍</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={{ padding: Spacing.one }}>
                <Text style={styles.modalCloseText}>取消</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.modalRow} 
                onPress={() => setTempSelectedIds([])}
                activeOpacity={0.7}
              >
                <View style={[styles.checkbox, tempSelectedIds.length === 0 && styles.checkboxActive]}>
                  {tempSelectedIds.length === 0 && <View style={styles.checkboxInner} />}
                </View>
                <Text style={styles.modalRowTitle}>全部</Text>
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
            </ScrollView>
            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmSelection}>
              <Text style={styles.confirmButtonText}>確定</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: Spacing.four,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1C1D22',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    gap: 4,
  },
  selectorChipText: {
    color: Colors.dark.text,
    fontSize: 15,
    fontWeight: 'bold',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16171B',
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    maxHeight: '80%',
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
