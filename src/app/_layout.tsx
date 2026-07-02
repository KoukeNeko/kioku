import { Stack } from "expo-router";
import { View, Text, TouchableOpacity } from "react-native";
import { useFonts } from 'expo-font';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
import * as SplashScreen from 'expo-splash-screen';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useState } from 'react';
import { SettingsProvider } from '../context/SettingsContext';
import { initDB } from '../db/schema';
import { attachContentDb } from '../db/contentDb';
import { ensureSelectedDeckCards } from '../db/seed';
import { applyStoredParameters } from '../services/fsrs';
import * as FsrsNative from '../../modules/fsrs-native'; // Slice 0 工具鏈探針（暫時）

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [seedFailed, setSeedFailed] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [loaded, error] = useFonts({
    'SourceHanSerif-Regular': require('../../assets/fonts/SourceHanSerifJP-Regular.otf'),
    'SourceHanSerif-Bold': require('../../assets/fonts/SourceHanSerifJP-Bold.otf'),
    'JetBrainsMono-Regular': JetBrainsMono_400Regular,
  });

  // 主庫建表 → 掛載打包的唯讀內容庫 → 為「目標牌組」（預設範圍）成員增量建卡（個人 FSRS 紀錄留本機）。
  // 失敗（多半是內容庫掛載/建卡出錯）會顯示錯誤＋再試行，而非靜默空白。
  useEffect(() => {
    let cancelled = false;
    // 視窗底色釘成 App 深色：換頁過場的縫隙露出的是 window 背景（預設亮色），不釘會閃白/閃藍。
    SystemUI.setBackgroundColorAsync('#0B0C10').catch(() => {});
    // Slice 0：驗證 fsrs-rs 原生橋接（dev build 應印 42；Expo Go 為 null）。
    console.log('[FsrsNative] available =', FsrsNative.isAvailable(), '| ping =', FsrsNative.ping());
    (async () => {
      try {
        initDB();
        await attachContentDb(); // 掛載唯讀內容庫（content.*）；任何內容查詢前必須完成
        applyStoredParameters(); // 套用本機已訓練的 FSRS 參數（無則用預設）
        await ensureSelectedDeckCards(); // 不傳參數 → 預設範圍（學習範圍為空時為 5 個 JLPT 包）
        if (!cancelled) setSeedFailed(false);
      } catch (dbError) {
        console.error('❌ 資料庫初始化失敗:', dbError);
        if (!cancelled) setSeedFailed(true);
      } finally {
        if (!cancelled) setDbReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [retryKey]);

  useEffect(() => {
    if ((loaded || error) && dbReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error, dbReady]);

  if ((!loaded && !error) || !dbReady) {
    return null;
  }

  if (seedFailed) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0B0C10', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' }}>
          初期化に失敗しました
        </Text>
        <Text style={{ color: '#8E8F94', fontSize: 14, marginBottom: 24, textAlign: 'center', lineHeight: 20 }}>
          単語データの読み込みに失敗しました。アプリを再起動して再試行してください。
        </Text>
        <TouchableOpacity
          onPress={() => { setSeedFailed(false); setDbReady(false); setRetryKey((n) => n + 1); }}
          style={{ paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FF6B35', borderRadius: 8 }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>再試行</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SettingsProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          // 防露底兩件套：場景底 + window 底（見 SystemUI.setBackgroundColorAsync）都釘深色，
          // 換頁過場的縫隙才不會閃出亮色。
          contentStyle: { backgroundColor: '#0B0C10' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="review" />
        <Stack.Screen name="licenses" />
        <Stack.Screen name="open-source" />
        <Stack.Screen name="contributors" />
      </Stack>
    </SettingsProvider>
  );
}
