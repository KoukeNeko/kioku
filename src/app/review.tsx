import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { X, Volume2, Bookmark, EyeOff } from "lucide-react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Speech from "expo-speech";
import { Colors, Spacing, Fonts, BORDER_RADIUS } from "../constants/theme";
import { FuriganaText } from "../components/ui/FuriganaText";
import { FlashCard } from '../components/ui/FlashCard';
import { RatingButtons } from '../components/ui/RatingButtons';
import { KanjiStrokeBoard } from '../components/ui/KanjiStrokeBoard';
import { ExampleSentenceCard } from '../components/ui/ExampleSentenceCard';
import { AppBar } from '../components/ui/AppBar';
import { Rating } from "ts-fsrs";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { PenTool } from "lucide-react-native";
import { BackButton } from "../components/ui/BackButton";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useReviewSession, VocabItem } from "../hooks/useReviewSession";
import { getVocabById } from "../db/repositories/cardRepository";
import { getCardFlags, setBookmarked, setSuspended } from "../db/repositories/collectionsRepository";
import { ActivityIndicator } from "react-native";
import { PitchAccent } from "../components/ui/PitchAccent";

interface FuriganaSegment {
    ruby: string;
    rt?: string;
}

const readingOf = (chunks: FuriganaSegment[]): string =>
    chunks.map((chunk) => chunk.rt ?? chunk.ruby).join('');

// 用裝置端 TTS 唸出日文（語言固定 ja-JP，避免被誤判為中文）。
const speakJapanese = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'ja-JP' });
};

export default function Review() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { deckId, vocabId } = useLocalSearchParams<{ deckId?: string, vocabId?: string }>();
  const isDictionaryMode = !!vocabId;
  const [isFlipped, setIsFlipped] = useState(isDictionaryMode);
  const [kanjiTriggers, setKanjiTriggers] = useState<Record<string, number>>({});

  // 字典模式：向雲端查單字（async；沿用 isLoading/loadError 的 UI）。
  const [dictItem, setDictItem] = useState<VocabItem | null>(null);
  const [dictLoading, setDictLoading] = useState(isDictionaryMode);
  const [dictError, setDictError] = useState(false);
  const [dictRetry, setDictRetry] = useState(0);

  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  useEffect(() => {
    if (!isDictionaryMode) return;
    let cancelled = false;
    setDictLoading(true);
    setDictError(false);
    getVocabById(vocabId as string)
      .then((item) => {
        if (cancelled) return;
        setDictItem(item);
        setDictError(item === null);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('查詢單字失敗', error);
        setDictItem(null);
        setDictError(true);
      })
      .finally(() => {
        if (!cancelled) setDictLoading(false);
      });
    return () => { cancelled = true; };
  }, [vocabId, isDictionaryMode, dictRetry]);

  const session = useReviewSession(isDictionaryMode ? undefined : deckId, !isDictionaryMode);
  const currentItem = isDictionaryMode ? dictItem : session.currentItem;
  const currentIndex = isDictionaryMode ? 1 : session.currentIndex;
  const totalCards = isDictionaryMode ? 1 : session.totalCards;
  const isFinished = isDictionaryMode ? (!dictLoading && !dictError && !dictItem) : session.isFinished;
  const isLoading = isDictionaryMode ? dictLoading : session.isLoading;
  const loadError = isDictionaryMode ? dictError : session.loadError;
  const upcomingIntervals = session.upcomingIntervals;
  const handleRate = session.handleRate;
  const resetSession = session.resetSession;

  useEffect(() => {
    if (currentItem?.id) {
      const flags = getCardFlags(currentItem.id);
      setIsBookmarked(flags.bookmarked);
      setIsSuspended(flags.suspended);
    }
  }, [currentItem?.id]);

  const handleToggleBookmark = () => {
    if (!currentItem?.id) return;
    const next = !isBookmarked;
    setIsBookmarked(next);
    setBookmarked(currentItem.id, next);
  };

  const handleToggleSuspend = () => {
    if (!currentItem?.id) return;
    const next = !isSuspended;
    setIsSuspended(next);
    setSuspended(currentItem.id, next);
  };

  // 重試：字典模式重新查詢，複習模式重載工作階段。
  const handleRetry = () => {
    if (isDictionaryMode) {
      setDictRetry((n) => n + 1);
    } else {
      resetSession();
    }
    setIsFlipped(isDictionaryMode);
  };

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRating = (rating: Rating) => {
    handleRate(rating);
    setIsFlipped(false);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
        <ActivityIndicator size="large" color={Colors.dark.primaryOrange} />
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center', padding: Spacing.four }]} edges={['top']}>
        <Text style={{ color: Colors.dark.text, fontSize: 20, fontWeight: 'bold', marginBottom: Spacing.two, textAlign: 'center' }}>
          サーバーに接続できません
        </Text>
        <Text style={{ color: Colors.dark.textSecondary, fontSize: 14, marginBottom: Spacing.four, textAlign: 'center', lineHeight: 20 }}>
          クラウドからカード内容を取得できませんでした。サーバーが起動しているか確認して再試行してください。
        </Text>
        <TouchableOpacity
          onPress={handleRetry}
          style={[{ paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, backgroundColor: Colors.dark.primaryOrange, borderRadius: BORDER_RADIUS.md }]}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>再試行</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isFinished || !currentItem) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]} edges={['top']}>
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


  // 讀音 / 例句 / 音高 / 構成漢字 皆由 content 庫充實後帶在 currentItem 上。
  const reading = readingOf(displayChunks);
  const example = currentItem.example;
  const pitch = currentItem.pitch;
  const kanjiList = currentItem.kanjiList;

  const handleKanjiReplay = (k: string) => {
    setKanjiTriggers(prev => ({ ...prev, [k]: (prev[k] || 0) + 1 }));
  };

  const getDeckLabel = () => {
    if (currentItem.jlpt) {
      return `JLPT N${currentItem.jlpt} 語彙`;
    }
    return '語彙';
  };

  const renderFront = () => (
    <View style={styles.frontContent}>
      <View style={styles.cardFlagsContainer}>
        <TouchableOpacity style={[styles.flagButton, isBookmarked && styles.flagActive]} onPress={handleToggleBookmark}>
          <Bookmark size={22} color={isBookmarked ? Colors.dark.primaryOrange : Colors.dark.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.flagButton, isSuspended && styles.flagActive]} onPress={handleToggleSuspend}>
          <EyeOff size={22} color={isSuspended ? '#FF4D4D' : Colors.dark.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.categoryLabel}>{getDeckLabel()}</Text>
      <View style={styles.wordContainer}>
        <FuriganaText chunks={displayChunks} fontSize={56} />
      </View>
      <TouchableOpacity style={styles.speakerButtonCenter} onPress={() => speakJapanese(reading)}>
        <Volume2 size={24} color={Colors.dark.primaryOrange} />
      </TouchableOpacity>
    </View>
  );

  const renderBack = () => (
    <ScrollView 
      style={styles.backContent} 
      showsVerticalScrollIndicator={false} 
      contentContainerStyle={{ paddingBottom: isDictionaryMode ? (insets.bottom + Spacing.four) : (140 + insets.bottom) }}
    >
      <View style={styles.cardFlagsContainer}>
        <TouchableOpacity style={[styles.flagButton, isBookmarked && styles.flagActive]} onPress={handleToggleBookmark}>
          <Bookmark size={22} color={isBookmarked ? Colors.dark.primaryOrange : Colors.dark.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.flagButton, isSuspended && styles.flagActive]} onPress={handleToggleSuspend}>
          <EyeOff size={22} color={isSuspended ? '#FF4D4D' : Colors.dark.textSecondary} />
        </TouchableOpacity>
      </View>
      {/* Top Word Area */}
      <View style={styles.backTopArea}>
        <Text style={[styles.categoryLabel, { marginBottom: Spacing.two }]}>{getDeckLabel()}</Text>
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
          <ExampleSentenceCard example={example} />
        </View>
      )}

      {/* Embedded Kanji Stroke Orders */}
      {kanjiList.length > 0 && (
        <View style={styles.sectionArea}>
          <Text style={styles.sectionTitle}>構成漢字</Text>
          {kanjiList.map((entry) => {
            const k = entry.char;
            const paths = entry.strokes || [];
            const trigger = kanjiTriggers[k] || 0;
            const readingStr = [entry.kun.join('、'), entry.on.join('、')].filter(Boolean).join('  •  ');
            const meaningStr = entry.meanings.slice(0, 3).join(', ');

            return (
              <TouchableOpacity 
                key={k} 
                style={styles.kanjiRow}
                activeOpacity={0.7}
                onPress={() => router.push(`/stroke-order?kanji=${k}`)}
              >
                <TouchableOpacity onPress={() => handleKanjiReplay(k)} style={styles.kanjiBoardWrapper}>
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
              </TouchableOpacity>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        centerMode="flex"
        leftContent={
          isDictionaryMode ? (
            <BackButton />
          ) : (
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
          )
        }
        centerContent={
          isDictionaryMode ? (
            <Text style={{ color: Colors.dark.textSecondary, fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>単語詳細</Text>
          ) : (
            <View style={styles.progressBarContainer}>
              <View style={[styles.progressBarFill, { width: `${(currentIndex / totalCards) * 100}%` }]} />
            </View>
          )
        }
        rightContent={
          isDictionaryMode ? (
            <View style={{ width: 40 }} />
          ) : (
            <Text style={styles.progressText}>{currentIndex}/{totalCards}</Text>
          )
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

      {!isDictionaryMode && (
        <LinearGradient 
          colors={[`${Colors.dark.background}00`, Colors.dark.background, Colors.dark.background]} 
          locations={[0, 0.4, 1]}
          style={[styles.bottomArea, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}
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
      )}
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
    height: 8,
    backgroundColor: '#2E3135',
    marginHorizontal: 0,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    width: '30%',
    height: '100%',
    backgroundColor: Colors.dark.primaryOrange,
    borderRadius: 4,
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
    paddingBottom: 120, // offset for the absolute positioned bottom area
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
    fontFamily: Fonts?.lineSeed,
    marginBottom: Spacing.two,
  },
  posText: {
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
    fontFamily: Fonts?.lineSeed,
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
  },
  cardFlagsContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    flexDirection: 'row',
    gap: Spacing.one,
    zIndex: 10,
  },
  flagButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagActive: {
    backgroundColor: '#1C1D22',
  }
});
