import { Tabs } from "expo-router";
import { Colors } from "../../constants/theme";
import { Home, Layers, BarChart2, User } from "lucide-react-native";
import { StyleSheet, Platform, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import React, { useEffect } from "react";

// M3 Expressive motion tokens（dampingRatio/stiffness 轉為 Reanimated 物理參數，mass=1：damping = 2ζ√k）。
const SPRING_SPATIAL_FAST = { damping: 34, stiffness: 800 };    // ζ0.6：明顯過衝的彈跳（選中 pop / 放開回彈）
const SPRING_SPATIAL_DEFAULT = { damping: 31, stiffness: 380 }; // ζ0.8：溫和過衝（藥丸展開）
const SPRING_EFFECTS = { damping: 80, stiffness: 1600 };        // ζ1.0：無彈跳的即時回饋（按下壓縮）
// 選中 pop：icon 先快速縮小/下沉，再以彈簧彈回（withSequence 的第一段時長）。
const POP_WIND_UP_MS = 70;
const PRESS_SQUISH_SCALE = 0.9;
// 藥丸底色：品牌橘的低透明 tonal（對應 M3 secondaryContainer 角色）。
const PILL_COLOR = 'rgba(255, 107, 53, 0.22)';


/**
 * Material 3 Expressive 的分頁圖示：聚焦時藥丸展開 + icon 縮放彈跳（squash & stretch pop）。
 * 僅 Android 套用（iOS 維持原本樣式，直接回傳圖示）。
 */
function ExpressiveIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  const progress = useSharedValue(focused ? 1 : 0);
  const iconScale = useSharedValue(1);
  const iconShiftY = useSharedValue(0);
  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, SPRING_SPATIAL_DEFAULT);
    if (focused) {
      // 選中瞬間：icon 縮小下沉（蓄力）→ 彈簧回彈帶過衝，做出 M3E 的活潑 pop。
      iconScale.value = withSequence(
        withTiming(0.7, { duration: POP_WIND_UP_MS }),
        withSpring(1, SPRING_SPATIAL_FAST),
      );
      iconShiftY.value = withSequence(
        withTiming(2, { duration: POP_WIND_UP_MS }),
        withSpring(0, SPRING_SPATIAL_FAST),
      );
    }
  }, [focused, progress, iconScale, iconShiftY]);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: 0.6 + 0.4 * progress.value }],
    opacity: progress.value,
  }));
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }, { translateY: iconShiftY.value }],
  }));

  if (Platform.OS !== 'android') {
    return <>{children}</>;
  }
  return (
    <View style={styles.iconWrap}>
      <Animated.View style={[styles.pill, pillStyle]} />
      <Animated.View style={iconStyle}>{children}</Animated.View>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Android 分頁按鈕：按下時整個項目壓縮（無彈跳、即時），放開以彈簧回彈帶過衝。
 * 取代預設 PlatformPressable；expo-router 會往 button props 注入
 * android_ripple:{borderless:true} / hoverEffect / pressColor / pressOpacity，
 * 必須全部剝掉不往下傳，否則 spread 進 Pressable 後圓形 ripple 又會回來。
 */
function ExpressiveTabButton({
  style,
  onPressIn,
  onPressOut,
  android_ripple: _androidRipple,
  hoverEffect: _hoverEffect,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  ...rest
}: any) {
  const pressScale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  return (
    <AnimatedPressable
      {...rest}
      style={[style, pressStyle]}
      onPressIn={(event: unknown) => {
        pressScale.value = withSpring(PRESS_SQUISH_SCALE, SPRING_EFFECTS);
        onPressIn?.(event);
      }}
      onPressOut={(event: unknown) => {
        pressScale.value = withSpring(1, SPRING_SPATIAL_FAST);
        onPressOut?.(event);
      }}
    />
  );
}

export default function TabLayout() {
  // Android 手勢導覽（edge-to-edge）的系統列 inset：bar 高度與底部 padding 都要加上，標籤才不會被手勢條蓋住。
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // 場景容器釘成 App 深色底：預設是導航主題的亮色，分頁懶載入/重新掛載的瞬間會露出來閃一下。
        sceneStyle: { backgroundColor: Colors.dark.background },
        // M3 的分頁過場：內容朝切換方向微橫移＋交叉淡入，用 M3E spatial default 彈簧驅動。
        animation: 'shift',
        transitionSpec: {
          animation: 'spring',
          config: SPRING_SPATIAL_DEFAULT,
        },
        // Android：Spotify 式浮層 nav bar — 絕對定位讓內容從底下滑過，
        // 背景是垂直漸層（上緣近全透可見內容 → 下緣近實色），藥丸 indicator、標籤在下。
        // iOS：維持原本實色 + 頂線樣式。
        tabBarStyle: Platform.OS === 'android'
          ? {
              position: 'absolute',
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              height: 80 + insets.bottom,
              paddingBottom: 12 + insets.bottom,
              paddingTop: 12,
            }
          : {
              backgroundColor: Colors.dark.background,
              borderTopColor: '#2E3135',
              borderTopWidth: 1,
              height: 85,
              paddingBottom: 16,
              paddingTop: 10,
            },
        tabBarBackground: Platform.OS === 'android'
          ? () => (
              <LinearGradient
                colors={['rgba(11, 12, 16, 0.02)', 'rgba(11, 12, 16, 0.78)', 'rgba(11, 12, 16, 0.99)']}
                locations={[0, 0.45, 1]}
                style={StyleSheet.absoluteFill}
              />
            )
          : undefined,
        // Android：自訂分頁按鈕 — 移除預設圓形 ripple，改為 M3E 的按壓壓縮＋放開回彈。
        tabBarButton: Platform.OS === 'android'
          ? (props) => <ExpressiveTabButton {...props} />
          : undefined,
        tabBarActiveTintColor: Colors.dark.primaryOrange,
        tabBarInactiveTintColor: Colors.dark.textSecondary,
        tabBarLabelStyle: Platform.OS === 'android'
          ? {
              fontSize: 12,
              fontWeight: '600',
              marginTop: 4,
            }
          : {
              fontSize: 10,
              fontWeight: '500',
            },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color, focused }) => (
            <ExpressiveIcon focused={focused}>
              <Home size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
            </ExpressiveIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="decks"
        options={{
          title: "デッキ",
          tabBarIcon: ({ color, focused }) => (
            <ExpressiveIcon focused={focused}>
              <Layers size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
            </ExpressiveIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: "統計",
          tabBarIcon: ({ color, focused }) => (
            <ExpressiveIcon focused={focused}>
              <BarChart2 size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
            </ExpressiveIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "マイページ",
          tabBarIcon: ({ color, focused }) => (
            <ExpressiveIcon focused={focused}>
              <User size={24} color={color} strokeWidth={focused ? 2.4 : 2} />
            </ExpressiveIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="deck"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // M3 藥丸 active indicator：64×32 膠囊，包住 24dp 圖示。
  iconWrap: {
    width: 64,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: PILL_COLOR,
  },
});
