import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../constants/theme";
import { ChevronLeft } from "lucide-react-native";
import { AppBar } from "../components/ui/AppBar";
import { BackButton } from "../components/ui/BackButton";
import { SettingsCard, SettingsRow, SettingsDivider, SettingsSwitchRow } from "../components/ui/SettingsCard";
import { useSettings, StrokeSpeed } from "../context/SettingsContext";
import { getReviewLogCount, optimizeParameters } from "../services/fsrsOptimizer";
import { MIN_REVIEWS_TO_OPTIMIZE } from "../services/fsrsTraining";

const DummySlider = ({ width = 100, fillPercent = 80, color = Colors.dark.primaryOrange }) => {
  return (
    <View style={{ width, height: 4, backgroundColor: '#2E3135', borderRadius: 2, justifyContent: 'center', marginHorizontal: 12 }}>
      <View style={{ width: `${fillPercent}%`, height: '100%', backgroundColor: color, borderRadius: 2 }} />
      <View style={{
        position: 'absolute',
        left: `${fillPercent}%`,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#FFF',
        marginLeft: -8,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 2,
        elevation: 2
      }} />
    </View>
  );
};

export default function SettingsScreen() {
  const router = useRouter();

  const [furiganaEnabled, setFuriganaEnabled] = useState(true);
  const [autoPlayEnabled, setAutoPlayEnabled] = useState(true);
  const [soundEffectEnabled, setSoundEffectEnabled] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);

  const [cardOrder, setCardOrder] = useState<'追加順' | 'ランダム'>('追加順');
  const [pitchAccent, setPitchAccent] = useState<'上線' | '数字'>('上線');
  const [displayFont, setDisplayFont] = useState<'明朝' | 'ゴシック'>('明朝');
  const [themeMode, setThemeMode] = useState<'システム' | 'ライト' | 'ダーク'>('ダーク');

  const { strokeSpeed, setStrokeSpeed } = useSettings();

  // FSRS 參數最適化（用本機複習歷史訓練）。
  const [reviewCount, setReviewCount] = useState(0);
  const [optimizing, setOptimizing] = useState(false);

  useEffect(() => {
    try {
      setReviewCount(getReviewLogCount());
    } catch (error) {
      console.error('讀取複習筆數失敗', error);
    }
  }, []);

  const handleOptimize = async () => {
    if (optimizing) return;
    setOptimizing(true);
    try {
      const outcome = await optimizeParameters();
      setReviewCount(outcome.reviewCount);
      Alert.alert('パラメータ最適化', outcome.message);
    } catch (error) {
      console.error('最適化エラー', error);
      Alert.alert('パラメータ最適化', '予期せぬエラーが発生しました');
    } finally {
      setOptimizing(false);
    }
  };

  const getSpeedLabel = (speed: StrokeSpeed) => {
    switch(speed) {
      case StrokeSpeed.Slow: return '遅い';
      case StrokeSpeed.Normal: return '標準';
      case StrokeSpeed.Fast: return '速い';
    }
  };

  const getSpeedValueFromLabel = (label: string): StrokeSpeed => {
    switch(label) {
      case '遅い': return StrokeSpeed.Slow;
      case '標準': return StrokeSpeed.Normal;
      case '速い': return StrokeSpeed.Fast;
      default: return StrokeSpeed.Normal;
    }
  };

  const renderSegment = (options: string[], active: string, onChange: (val: any) => void, activeBg = '#202636') => (
    <View style={styles.segmentControl}>
      {options.map((opt, index) => {
        const isActive = active === opt;
        // Special case for pitch accent colors
        const bg = isActive ? (opt === '上線' || opt === '数字' ? '#5CB3FF' : activeBg) : 'transparent';
        const color = isActive ? (opt === '上線' || opt === '数字' ? '#000' : '#FFF') : Colors.dark.textSecondary;

        return (
          <React.Fragment key={opt}>
            <TouchableOpacity
              style={[styles.segmentButton, { backgroundColor: bg }]}
              onPress={() => onChange(opt)}
            >
              <Text style={[styles.segmentText, { color, fontWeight: isActive ? 'bold' : 'normal' }]}>{opt}</Text>
            </TouchableOpacity>
            {/* Show divider for pitch accent only */}
            {index === 0 && options.includes('上線') && (
              <Text style={styles.segmentDivider}>＼</Text>
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={
          <BackButton />
        }
        centerContent={
          <Text style={styles.headerTitle}>設定</Text>
        }
        rightContent={
          <View style={styles.iconButton} pointerEvents="none">
            <ChevronLeft size={28} color="transparent" />
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Section 1: Engine */}
        <View style={styles.sectionHeader}>
          <View style={styles.redDot} />
          <Text style={styles.sectionTitle}>学習エンジン ・ FSRS-6</Text>
        </View>

        <SettingsCard>
          <SettingsRow label="目標定着率">
            <DummySlider width={80} fillPercent={90} />
            <Text style={[styles.sliderValueText, { width: 40, textAlign: 'right' }]}>90%</Text>
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow label="1日の新規カード上限" valueText="24" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="1日の復習上限" valueText="無制限" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="学習ステップ" valueText="1m ・ 10m" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="新カードの順序">
            {renderSegment(['追加順', 'ランダム'], cardOrder, setCardOrder)}
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow
            label="パラメータ最適化"
            subLabel={
              reviewCount >= MIN_REVIEWS_TO_OPTIMIZE
                ? `${reviewCount.toLocaleString()}件のログで再学習`
                : `あと${(MIN_REVIEWS_TO_OPTIMIZE - reviewCount).toLocaleString()}件で利用可能（${reviewCount.toLocaleString()}/${MIN_REVIEWS_TO_OPTIMIZE.toLocaleString()}）`
            }
            paddingVertical={12}
          >
            <TouchableOpacity
              style={[
                styles.actionButton,
                (optimizing || reviewCount < MIN_REVIEWS_TO_OPTIMIZE) && { opacity: 0.4 },
              ]}
              onPress={handleOptimize}
              disabled={optimizing || reviewCount < MIN_REVIEWS_TO_OPTIMIZE}
            >
              <Text style={styles.actionButtonText}>{optimizing ? '実行中…' : '実行'}</Text>
            </TouchableOpacity>
          </SettingsRow>
        </SettingsCard>

        {/* Section 2: Display */}
        <Text style={styles.sectionHeaderLabel}>表示</Text>
        <SettingsCard>
          <SettingsSwitchRow label="ふりがな（既定）" value={furiganaEnabled} onValueChange={setFuriganaEnabled} />
          <SettingsDivider />
          <SettingsRow label="ピッチ表記">
            {renderSegment(['上線', '数字'], pitchAccent, setPitchAccent)}
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow label="表示フォント">
            {renderSegment(['明朝', 'ゴシック'], displayFont, setDisplayFont)}
          </SettingsRow>
          <SettingsDivider />
          <SettingsRow label="筆順アニメ速度">
            {renderSegment(['遅い', '標準', '速い'], getSpeedLabel(strokeSpeed), (val) => setStrokeSpeed(getSpeedValueFromLabel(val)))}
          </SettingsRow>
          <SettingsDivider />
          <View style={[styles.row, { flexDirection: 'column', alignItems: 'flex-start', gap: 12 }]}>
            <Text style={styles.rowLabel}>テーマ</Text>
            {renderSegment(['システム', 'ライト', 'ダーク'], themeMode, setThemeMode)}
          </View>
          <SettingsDivider />
          <SettingsRow label="文字サイズ" valueText="標準">
            <DummySlider width={60} fillPercent={50} color={Colors.dark.primaryOrange} />
          </SettingsRow>
        </SettingsCard>

        {/* Section 3: Audio */}
        <Text style={styles.sectionHeaderLabel}>音声</Text>
        <SettingsCard>
          <SettingsSwitchRow label="回答時に自動再生" value={autoPlayEnabled} onValueChange={setAutoPlayEnabled} />
          <SettingsDivider />
          <SettingsRow label="読み上げ音声" valueText="日本語・女性" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="読み上げ速度" valueText="0.9x">
            <DummySlider width={60} fillPercent={75} color={Colors.dark.primaryOrange} />
          </SettingsRow>
          <SettingsDivider />
          <SettingsSwitchRow label="効果音" value={soundEffectEnabled} onValueChange={setSoundEffectEnabled} />
        </SettingsCard>

        {/* Section 4: Notifications */}
        <Text style={styles.sectionHeaderLabel}>通知</Text>
        <SettingsCard>
          <SettingsSwitchRow label="毎日のリマインダー" value={reminderEnabled} onValueChange={setReminderEnabled} />
          <SettingsDivider />
          <SettingsRow label="時刻" valueText="20:00" showChevron onPress={() => { }} />
        </SettingsCard>

        {/* Section 5: Data & Sync */}
        <Text style={styles.sectionHeaderLabel}>データと同期</Text>
        <SettingsCard>
          <SettingsRow label="同期" valueText="2分前" valueColor="#66D283">
            <View style={styles.greenDot} />
          </SettingsRow>
          <SettingsDivider />
          <SettingsSwitchRow label="自動同期" value={autoSyncEnabled} onValueChange={setAutoSyncEnabled} />
          <SettingsDivider />
          <SettingsRow label="Anki .apkg を取り込む" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="エクスポート" showChevron onPress={() => { }} />
          <SettingsDivider />
          <SettingsRow label="キャッシュを削除" valueText="124 MB" onPress={() => { }} />
        </SettingsCard>

        {/* Section 6: About / Legal */}
        <Text style={styles.sectionHeaderLabel}>情報</Text>
        <SettingsCard>
          <SettingsRow 
            label="ライセンス (Licenses)" 
            showChevron 
            onPress={() => router.push('/licenses')} 
          />
          <SettingsDivider />
          <SettingsRow 
            label="オープンソース (Open Source)" 
            showChevron 
            onPress={() => router.push('/open-source')} 
          />
          <SettingsDivider />
          <SettingsRow 
            label="コントリビューター (Contributors)" 
            showChevron 
            onPress={() => router.push('/contributors')} 
          />
        </SettingsCard>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Kioku v1.0.0 (1024)</Text>
          <Text style={styles.footerText}>Made with ❤️ for Japanese Learners</Text>
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
  iconButton: {
    padding: Spacing.one,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.dark.text,
  },
  sliderValueText: {
    fontSize: 14,
    color: Colors.dark.textSecondary,
  },
  scrollContent: { paddingTop: 24,
    padding: Spacing.three,
    paddingBottom: Spacing.five,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.primaryOrange,
    marginRight: Spacing.two,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  sectionHeaderLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLabel: {
    color: Colors.dark.text,
    fontSize: 15,
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: '#0F1014',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#1C1D22',
  },
  segmentButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentText: {
    fontSize: 13,
  },
  segmentDivider: {
    color: Colors.dark.textSecondary,
    paddingHorizontal: 4,
    alignSelf: 'center',
  },
  actionButton: {
    backgroundColor: Colors.dark.primaryOrange,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  greenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#66D283',
    marginRight: 6,
  },
  proBadge: {
    borderWidth: 1,
    borderColor: Colors.dark.primaryOrange,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  proBadgeText: {
    color: Colors.dark.primaryOrange,
    fontSize: 11,
    fontWeight: 'bold',
  },
  logoutText: {
    color: '#FF4A4A',
    fontSize: 15,
  },
  footer: {
    alignItems: 'center',
    marginTop: Spacing.five,
    gap: Spacing.one,
  },
  footerText: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    fontFamily: Fonts?.mono,
  }
});
