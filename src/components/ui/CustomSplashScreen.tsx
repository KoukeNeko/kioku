import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Animated, Easing, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

interface CustomSplashScreenProps {
  onAnimationComplete: () => void;
  isReady: boolean;
}

const { width, height } = Dimensions.get('window');

/** 平滑放射狀光暈（真 glow）：SVG RadialGradient 連續衰減，無圓形邊界。id 需唯一避免多實例衝突。 */
const RadialGlow = ({
  id,
  size,
  maxOpacity,
  style,
}: {
  id: string;
  size: number;
  maxOpacity: number;
  style?: object;
}) => (
  <Svg width={size} height={size} style={style} pointerEvents="none">
    <Defs>
      <RadialGradient id={id} cx="50%" cy="50%" r="50%">
        <Stop offset="0%" stopColor="#FF5A36" stopOpacity={maxOpacity} />
        <Stop offset="45%" stopColor="#FF5A36" stopOpacity={maxOpacity * 0.45} />
        <Stop offset="75%" stopColor="#FF5A36" stopOpacity={maxOpacity * 0.12} />
        <Stop offset="100%" stopColor="#FF5A36" stopOpacity={0} />
      </RadialGradient>
    </Defs>
    <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
  </Svg>
);

const ICON_SIZE = 104;
const ICON_GLOW_SIZE = 380;

// 進度條：細短置中（同 design），未就緒時橘色小段左右掃動，就緒後展開填滿再整頁淡出。
const TRACK_WIDTH = 120;
const SEGMENT_WIDTH = 44;
const SWEEP_RANGE = (TRACK_WIDTH - SEGMENT_WIDTH) / 2;
const MIN_SPLASH_MS = 1500;

export const CustomSplashScreen: React.FC<CustomSplashScreenProps> = ({
  onAnimationComplete,
  isReady,
}) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;   // -1 ←→ 1 掃動
  const fillAnim = useRef(new Animated.Value(0)).current;    // 0 → 1 收尾展開
  const minTimeElapsed = useRef(false);
  const isReadyRef = useRef(isReady);
  const [shouldFinish, setShouldFinish] = useState(false);

  useEffect(() => {
    isReadyRef.current = isReady;
    if (isReady && minTimeElapsed.current) {
      setShouldFinish(true);
    }
  }, [isReady]);

  useEffect(() => {
    // 等待期間：橘色小段來回掃動（indeterminate）。
    const sweep = Animated.loop(
      Animated.sequence([
        Animated.timing(sweepAnim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(sweepAnim, {
          toValue: -1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    sweep.start();

    // 強制至少顯示 MIN_SPLASH_MS。
    const timer = setTimeout(() => {
      minTimeElapsed.current = true;
      if (isReadyRef.current) {
        setShouldFinish(true);
      }
    }, MIN_SPLASH_MS);
    return () => {
      sweep.stop();
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (shouldFinish) {
      // 收尾：掃動段展開成整條 → 稍候 → 整頁淡出。
      Animated.timing(fillAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          delay: 200,
          useNativeDriver: true,
        }).start(() => {
          onAnimationComplete();
        });
      });
    }
    // 依賴必須是 shouldFinish：計時器路徑（setTimeout → setShouldFinish）不改 isReady，
    // 若依賴寫 isReady，這個收尾動畫永遠不會被觸發、開屏會卡住。
  }, [shouldFinish]);

  // 掃動位移在收尾時歸零（回到置中），同時橫向放大到蓋滿整條。
  const segmentTranslateX = Animated.multiply(
    sweepAnim,
    fillAnim.interpolate({ inputRange: [0, 1], outputRange: [SWEEP_RANGE, 0] }),
  );
  const segmentScaleX = fillAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, TRACK_WIDTH / SEGMENT_WIDTH],
  });

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      {/* 右下角浮水印與微光 */}
      <RadialGlow id="corner-glow" size={width * 1.2} maxOpacity={0.07} style={styles.cornerGlow} />
      <Text style={styles.watermark} allowFontScaling={false}>憶</Text>

      {/* 中心 Icon 區塊 */}
      <View style={styles.centerContainer}>
        <RadialGlow id="icon-glow" size={ICON_GLOW_SIZE} maxOpacity={0.2} style={styles.iconGlow} />
        <Image
          source={require('../../../assets/images/icon.png')}
          style={styles.iconTile}
          resizeMode="cover"
        />
        <Text style={styles.title} allowFontScaling={false}>Kioku</Text>
        <Text style={styles.subtitle} allowFontScaling={false}>記 憶</Text>
      </View>

      {/* 底部讀取條與標語 */}
      <View style={styles.bottomContainer}>
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressSegment,
              { transform: [{ translateX: segmentTranslateX }, { scaleX: segmentScaleX }] },
            ]}
          />
        </View>
        <Text style={styles.bottomText} allowFontScaling={false}>日本語を、正しく。</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0C10',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999, // 確保蓋在所有東西上面
  },
  watermark: {
    position: 'absolute',
    right: -width * 0.18,
    bottom: -height * 0.13,
    fontSize: 360,
    fontFamily: 'SourceHanSerif-Bold',
    color: 'rgba(235, 240, 250, 0.035)', // 近乎隱形的中性淺灰（design 的浮水印不是暖色）
    includeFontPadding: false,
  },
  cornerGlow: {
    position: 'absolute',
    right: -width * 0.35,
    bottom: -width * 0.3,
  },
  centerContainer: {
    alignItems: 'center',
    marginTop: -height * 0.08,
  },
  // 光暈中心對齊 icon 中心（icon 在 centerContainer 頂端）。
  iconGlow: {
    position: 'absolute',
    top: -(ICON_GLOW_SIZE - ICON_SIZE) / 2,
  },
  // App icon 以圓角裁切呈現（原圖為方形深底，直接放會是黑方塊）。
  iconTile: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: 26,
    marginBottom: 36,
  },
  title: {
    fontFamily: 'SourceHanSerif-Bold',
    fontSize: 44,
    color: '#FDF5E6',
    marginBottom: 10,
    includeFontPadding: false,
  },
  subtitle: {
    fontFamily: 'SourceHanSerif-Bold',
    fontSize: 15,
    color: '#FF5A36',
    letterSpacing: 6,
    includeFontPadding: false,
  },
  bottomContainer: {
    position: 'absolute',
    bottom: height * 0.12,
    alignItems: 'center',
    width: '100%',
  },
  progressTrack: {
    width: TRACK_WIDTH,
    height: 3,
    backgroundColor: '#23262C',
    borderRadius: 1.5,
    overflow: 'hidden',
    marginBottom: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressSegment: {
    width: SEGMENT_WIDTH,
    height: '100%',
    backgroundColor: '#FF5A36',
    borderRadius: 1.5,
  },
  bottomText: {
    fontFamily: 'SourceHanSerif-Regular',
    fontSize: 14,
    color: '#8E8F94',
    includeFontPadding: false,
  },
});
