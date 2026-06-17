import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { X, Volume2 } from "lucide-react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import { Colors, Spacing, Fonts, BORDER_RADIUS } from "../constants/theme";
import { FuriganaText } from "../components/ui/FuriganaText";
import { FlashCard } from "../components/ui/FlashCard";
import { RatingButtons } from "../components/ui/RatingButtons";
import { AppBar } from "../components/ui/AppBar";
import { Rating } from "ts-fsrs";
import { SafeAreaView } from "react-native-safe-area-context";
import { PenTool } from "lucide-react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useReviewSession } from "../hooks/useReviewSession";
import { ActivityIndicator } from "react-native";
import kanjiData from "../data/kanjiData.json";
import { KanjiStrokeBoard } from "../components/ui/KanjiStrokeBoard";
import { PitchAccent } from "../components/ui/PitchAccent";
import vocabExtra from "../data/vocabExtra.json";

interface KanjiEntry {
    strokes: string[];
    strokeCount: number | null;
    grade: number | null;
    jlpt: number | null;
    frequency: number | null;
    on: string[];
    kun: string[];
    meanings: string[];
}

const KANJI_BY_CHAR = kanjiData.kanji as Record<string, KanjiEntry>;

interface FuriganaSegment {
    ruby: string;
    rt?: string;
}

// 由 scripts/etl/build-vocab-extra.mjs 產生：每張卡的例句（Tanaka）+ 音高重音（Kanjium）。
interface VocabExtraEntry {
    pitch: number | null;
    example: { jp: string; furigana: FuriganaSegment[]; en: string } | null;
}

const VOCAB_EXTRA = vocabExtra as Record<string, VocabExtraEntry>;

const readingOf = (chunks: FuriganaSegment[]): string =>
    chunks.map((chunk) => chunk.rt ?? chunk.ruby).join('');

// 用裝置端 TTS 唸出日文（語言固定 ja-JP，避免被誤判為中文）。
const speakJapanese = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'ja-JP' });
};

export default function Review() {
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId?: string }>();
  const [isFlipped, setIsFlipped] = useState(false);
  const [kanjiTriggers, setKanjiTriggers] = useState<Record<string, number>>({});

  const { 
    currentItem, 
    currentIndex, 
    totalCards, 
    isFinished, 
    isLoading,
    upcomingIntervals, 
    handleRate,
    resetSession 
  } = useReviewSession(deckId);

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRating = (rating: Rating) => {
    handleRate(rating);
    setIsFlipped(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.dark.primaryOrange} />
      </SafeAreaView>
    );
  }

  if (isFinished || !currentItem) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: Colors.dark.text, fontSize: 24, fontWeight: 'bold', marginBottom: Spacing.four }}>
          複習完了！
        </Text>
        <TouchableOpacity 
          onPress={() => {
            resetSession();
            setIsFlipped(false);
          }}
          style={[{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, backgroundColor: Colors.dark.primaryOrange, borderRadius: BORDER_RADIUS.md }]}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>もう一度 (Restart Mock)</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const displayChunks = currentItem.kanji.map((chunk: any) => ({
    ruby: chunk.ruby,
    rt: chunk.rt
  }));

  const expression = displayChunks.map((c: any) => c.ruby).join('');
  const uniqueKanjis = Array.from(new Set(expression.match(/[\u4e00-\u9faf]/g) || []));
  const validKanjis = uniqueKanjis.filter(k => KANJI_BY_CHAR[k as string]);

  // 每張卡的讀音、例句、音高重音（依卡片 id 查表，與牌組資料分離）。
  const reading = readingOf(displayChunks);
  const extra = VOCAB_EXTRA[currentItem.id];
  const example = extra?.example ?? null;
  const pitch = extra?.pitch ?? null;

  const handleKanjiReplay = (k: string) => {
    setKanjiTriggers(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
  };

  const renderFront = () => (
    <View style={styles.frontContent}>
      <View style={styles.wordContainer}>
        <FuriganaText chunks={displayChunks} fontSize={56} />
      </View>
      <TouchableOpacity style={styles.speakerButtonCenter} onPress={() => speakJapanese(reading)}>
        <Volume2 size={24} color={Colors.dark.pitchLine} />
      </TouchableOpacity>
    </View>
  );

  const renderBack = () => (
    <ScrollView style={styles.backContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
      {/* Top Word Area */}
      <View style={styles.backTopArea}>
        <FuriganaText chunks={displayChunks} fontSize={48} />
      </View>
      
      <View style={styles.divider} />

      {/* Pitch Accent Row (per-card, from Kanjium) */}
      <View style={styles.pitchRow}>
        <View style={styles.pitchGraphArea}>
          {pitch != null ? (
            <PitchAccent reading={reading} accent={pitch} />
          ) : (
            <Text style={styles.pitchKanaText}>{reading}</Text>
          )}
        </View>

        <View style={styles.pitchRightArea}>
          <TouchableOpacity style={styles.pitchPill} onPress={() => {
            if (validKanjis.length > 0) {
              router.push(`/stroke-order?kanji=${validKanjis[0]}`);
            } else {
              router.push('/stroke-order');
            }
          }}>
            <PenTool size={14} color={Colors.dark.pitchLine} style={{ marginRight: 4 }} />
            <Text style={styles.pitchPillText}>筆順</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.speakerButtonSmall} onPress={() => speakJapanese(reading)}>
            <Volume2 size={20} color={Colors.dark.pitchLine} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Meaning */}
      <View style={styles.meaningArea}>
        <Text style={styles.meaningText}>{currentItem.english}</Text>
      </View>

      {/* Example Sentence Box (per-card, from Tanaka Corpus) */}
      {example && (
        <View style={styles.sectionArea}>
          <Text style={styles.sectionTitle}>例文</Text>
          <View style={styles.sentenceContainer}>
            <View style={styles.sentenceTopRow}>
              <View style={styles.sentenceTextWrap}>
                <FuriganaText chunks={example.furigana} fontSize={20} align="flex-start" />
              </View>
              <TouchableOpacity style={{ padding: 4 }} onPress={() => speakJapanese(example.jp)}>
                <Volume2 size={20} color={Colors.dark.pitchLine} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sentenceEnglish}>{example.en}</Text>
          </View>
        </View>
      )}

      {/* Embedded Kanji Stroke Orders */}
      {validKanjis.length > 0 && (
        <View style={styles.sectionArea}>
          <Text style={styles.sectionTitle}>構成漢字</Text>
          {validKanjis.map((k) => {
            const entry = KANJI_BY_CHAR[k as string];
            const paths = entry.strokes || [];
            const trigger = kanjiTriggers[k as string] || 0;
            const readingStr = [entry.kun.join('、'), entry.on.join('、')].filter(Boolean).join('  •  ');
            const meaningStr = entry.meanings.slice(0, 3).join(', ');

            return (
              <View key={k} style={styles.kanjiRow}>
                <TouchableOpacity onPress={() => handleKanjiReplay(k as string)} style={styles.kanjiBoardWrapper}>
                  <KanjiStrokeBoard paths={paths} trigger={trigger} size={84} />
                </TouchableOpacity>
                <View style={styles.kanjiInfoRight}>
                  <View style={styles.kanjiInfoTop}>
                    <Text style={styles.kanjiCharText}>{k}</Text>
                    {entry.jlpt && (
                      <View style={styles.kanjiBadge}>
                        <Text style={styles.kanjiBadgeText}>N{entry.jlpt}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.kanjiReadingText} numberOfLines={1}>{readingStr}</Text>
                  <Text style={styles.kanjiMeaningText} numberOfLines={2}>{meaningStr}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Global Footer for Card Back */}
      <View style={styles.cardBackFooter}>
        <Text style={styles.sentenceFooter}>例文 • Tanaka Corpus / Tatoeba CC BY</Text>
      </View>

    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <AppBar 
        leftContent={
          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
          >
            <X size={24} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
        }
        centerContent={
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${(currentIndex / totalCards) * 100}%` }]} />
          </View>
        }
        rightContent={
          <Text style={styles.progressText}>{currentIndex}/{totalCards}</Text>
        }
      />

      <View style={styles.mainArea}>
        <FlashCard 
          frontContent={renderFront()} 
          backContent={renderBack()} 
          isFlipped={isFlipped} 
          onFlip={handleFlip} 
        />
      </View>

      <LinearGradient 
        colors={[`${Colors.dark.background}00`, Colors.dark.background, Colors.dark.background]} 
        locations={[0, 0.4, 1]}
        style={styles.bottomArea}
        pointerEvents="box-none"
      >
        {isFlipped ? (
          <RatingButtons onRating={handleRating} intervals={upcomingIntervals} />
        ) : (
          <View style={styles.actionWrapper}>
            <TouchableOpacity style={styles.flipButton} onPress={handleFlip}>
              <Text style={styles.flipButtonText}>答えを表示</Text>
            </TouchableOpacity>
            <Text style={styles.actionHintText}>タップ または スペースキー</Text>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  closeButton: {
    paddingRight: Spacing.three,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: '#2E3135',
    marginHorizontal: Spacing.two, // Reduced margin to make it longer
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '30%',
    height: '100%',
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: 3,
  },
  progressText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontFamily: Fonts?.mono,
    marginLeft: Spacing.three,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  togglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.dark.backgroundSelected,
    borderRadius: BORDER_RADIUS.round,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one,
    paddingVertical: 2,
    backgroundColor: Colors.dark.background,
  },
  toggleText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginRight: Spacing.one,
  },
  mainArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  bottomArea: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    paddingTop: Spacing.six,
  },
  actionWrapper: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    width: '100%',
  },
  flipButton: {
    backgroundColor: '#1C1D22',
    height: 64,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#2E3135',
    marginBottom: Spacing.four,
  },
  flipButtonText: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionHintText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 6,
    height: 14,
  },
  frontContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  backContent: {
    flex: 1,
    width: '100%',
  },
  categoryLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: Spacing.four,
  },
  wordContainer: {
    marginBottom: Spacing.four,
  },
  speakerButtonCenter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: Colors.dark.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.four,
  },
  backTopArea: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.four,
  },
  divider: {
    height: 1,
    backgroundColor: '#2E3135',
    width: '100%',
    marginBottom: Spacing.four,
  },
  pitchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: Spacing.four,
  },
  pitchGraphArea: {
    alignItems: 'center',
  },
  pitchGraphTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 90,
    marginTop: 4,
  },
  pitchKanaText: {
    color: Colors.dark.text,
    fontSize: 18,
  },
  pitchRightArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  pitchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E2B38', // Slight blue tint matching the stroke
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: BORDER_RADIUS.sm,
  },
  pitchPillText: {
    color: Colors.dark.pitchLine,
    fontSize: 12,
    fontWeight: 'bold',
  },
  speakerButtonSmall: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.dark.backgroundSelected,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meaningArea: {
    marginBottom: Spacing.four,
  },
  meaningText: {
    color: Colors.dark.text,
    fontSize: 28,
    fontFamily: Fonts?.serif, // Serif font for English meaning if possible
    marginBottom: Spacing.two,
  },
  posText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  sentenceContainer: {
    padding: Spacing.three,
    backgroundColor: '#16171B', // slightly darker than card
    borderRadius: BORDER_RADIUS.lg,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  sentenceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.two,
  },
  sentenceTextWrap: {
    flex: 1,
    marginRight: Spacing.two,
  },
  sentenceRuby: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
  },
  sentenceJapanese: {
    color: Colors.dark.text,
    fontSize: 20,
    fontWeight: '500',
  },
  sentenceEnglish: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  cardBackFooter: {
    marginTop: Spacing.six,
    alignItems: 'center',
    paddingBottom: Spacing.two,
  },
  sentenceFooter: {
    color: '#4F525A', // darker gray
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionArea: {
    marginTop: Spacing.four,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: Spacing.three,
  },
  kanjiRow: {
    flexDirection: 'row',
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    alignItems: 'center',
  },
  kanjiBoardWrapper: {
    marginRight: Spacing.four,
  },
  kanjiInfoRight: {
    flex: 1,
    justifyContent: 'center',
  },
  kanjiInfoTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Spacing.two,
  },
  kanjiCharText: {
    color: Colors.dark.text,
    fontSize: 24,
    fontFamily: Fonts?.serif,
    fontWeight: 'bold',
  },
  kanjiBadge: {
    backgroundColor: '#1C2939',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  kanjiBadgeText: {
    color: '#68A5FF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  kanjiReadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginBottom: 2,
  },
  kanjiMeaningText: {
    color: Colors.dark.text,
    fontSize: 14,
  }
});
