import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Line, Circle } from 'react-native-svg';
import { Colors } from '../../constants/theme';

/**
 * 東京式音高重音圖（downstep 標記）。
 * accent: 0=平板、1=頭高、N≥2=中高/尾高（第 N 拍後下降）。
 * 由讀音拆出「拍」(mora) 並逐拍標高低，繪出線條 + 節點 + 假名。
 */
interface PitchAccentProps {
  reading: string;
  accent: number;
}

const SMALL_KANA = 'ゃゅょぁぃぅぇぉゎゕゖャュョァィゥェォヮヵヶ';
const MORA_WIDTH = 28;
const HIGH_Y = 8;
const LOW_Y = 26;
const NODE_RADIUS = 4;
const SVG_HEIGHT = 34;

const splitMorae = (reading: string): string[] => {
  const morae: string[] = [];
  for (const char of reading) {
    if (SMALL_KANA.includes(char) && morae.length > 0) {
      morae[morae.length - 1] += char;
    } else {
      morae.push(char);
    }
  }
  return morae;
};

// 第 index 拍是否為高音（accent: 0 平板 / 1 頭高 / ≥2 第 accent 拍後下降）。
const isHighMora = (index: number, accent: number): boolean => {
  if (accent === 0) return index >= 1;
  if (accent === 1) return index === 0;
  return index >= 1 && index < accent;
};

export const PitchAccent: React.FC<PitchAccentProps> = ({ reading, accent }) => {
  const morae = splitMorae(reading);
  if (morae.length === 0) return null;

  const centerX = (index: number) => index * MORA_WIDTH + MORA_WIDTH / 2;
  const moraY = (index: number) => (isHighMora(index, accent) ? HIGH_Y : LOW_Y);
  const width = morae.length * MORA_WIDTH;

  return (
    <View style={styles.container}>
      <Svg height={SVG_HEIGHT} width={width}>
        {morae.slice(0, -1).map((_, index) => (
          <Line
            key={`line-${index}`}
            x1={centerX(index)}
            y1={moraY(index)}
            x2={centerX(index + 1)}
            y2={moraY(index + 1)}
            stroke={Colors.dark.pitchLine}
            strokeWidth="2.5"
          />
        ))}
        {morae.map((_, index) => {
          const isHigh = isHighMora(index, accent);
          return (
            <Circle
              key={`node-${index}`}
              cx={centerX(index)}
              cy={moraY(index)}
              r={NODE_RADIUS}
              fill={isHigh ? Colors.dark.pitchNode : Colors.dark.pitchNodeFill}
              stroke={Colors.dark.pitchNode}
              strokeWidth="2"
            />
          );
        })}
      </Svg>
      <View style={[styles.kanaRow, { width }]}>
        {morae.map((mora, index) => (
          <Text 
            key={`kana-${index}`} 
            style={[styles.kana, { width: MORA_WIDTH }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {mora}
          </Text>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
  },
  kanaRow: {
    flexDirection: 'row',
    marginTop: 2,
  },
  kana: {
    color: Colors.dark.text,
    fontSize: 16,
    textAlign: 'center',
  },
});
