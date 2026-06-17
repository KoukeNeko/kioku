import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { X, Volume2 } from "lucide-react-native";
import Svg, { Line, Circle } from "react-native-svg";
import { Colors, Spacing, Fonts, BORDER_RADIUS } from "../constants/theme";
import { FuriganaText } from "../components/ui/FuriganaText";
import { FlashCard } from "../components/ui/FlashCard";
import { RatingButtons } from "../components/ui/RatingButtons";
import { AppBar } from "../components/ui/AppBar";
import { Rating } from "ts-fsrs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "expo-router";

export default function Review() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isFlipped, setIsFlipped] = useState(false);

  // Mock data for the flashcard
  const mockWord = [
    { ruby: "食", rt: "た" },
    { ruby: "べる" }
  ];

  const handleFlip = () => {
    setIsFlipped(true);
  };

  const handleRating = (rating: Rating) => {
    console.log(`User rated: ${rating}`);
    // Reset to next card in a real app
    setIsFlipped(false);
  };

  const displayChunks = mockWord.map(chunk => ({
    ruby: chunk.ruby,
    rt: chunk.rt
  }));

  const renderFront = () => (
    <View style={styles.frontContent}>
      <Text style={styles.categoryLabel}>動詞 ・ VERB</Text>
      <View style={styles.wordContainer}>
        <FuriganaText chunks={displayChunks} fontSize={56} />
      </View>
      <TouchableOpacity style={styles.speakerButtonCenter}>
        <Volume2 size={24} color={Colors.dark.pitchLine} />
      </TouchableOpacity>
    </View>
  );

  const renderBack = () => (
    <ScrollView style={styles.backContent} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.six }}>
      {/* Top Word Area */}
      <View style={styles.backTopArea}>
        <FuriganaText chunks={displayChunks} fontSize={48} />
      </View>
      
      <View style={styles.divider} />

      {/* Pitch Accent Row */}
      <View style={styles.pitchRow}>
        <View style={styles.pitchGraphArea}>
          <Svg height="40" width="100" viewBox="0 0 100 40">
            <Line x1="10" y1="25" x2="50" y2="10" stroke={Colors.dark.pitchLine} strokeWidth="3" />
            <Line x1="50" y1="10" x2="90" y2="25" stroke={Colors.dark.pitchLine} strokeWidth="3" />
            <Circle cx="10" cy="25" r="4" fill={Colors.dark.pitchNodeFill} stroke={Colors.dark.pitchNode} strokeWidth="2" />
            <Circle cx="50" cy="10" r="4" fill={Colors.dark.pitchNode} />
            <Circle cx="90" cy="25" r="4" fill={Colors.dark.pitchNodeFill} stroke={Colors.dark.pitchNode} strokeWidth="2" />
          </Svg>
          <View style={styles.pitchGraphTextRow}>
             <Text style={styles.pitchKanaText}>た</Text>
             <Text style={styles.pitchKanaText}>べ</Text>
             <Text style={styles.pitchKanaText}>る</Text>
          </View>
        </View>

        <View style={styles.pitchRightArea}>
          <View style={styles.pitchPill}>
            <Text style={styles.pitchPillText}>[2] 中高</Text>
          </View>
          <TouchableOpacity style={styles.speakerButtonSmall}>
            <Volume2 size={20} color={Colors.dark.pitchLine} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Meaning & POS */}
      <View style={styles.meaningArea}>
        <Text style={styles.meaningText}>to eat</Text>
        <Text style={styles.posText}>一段動詞 • 他動詞 — ichidan, transitive</Text>
      </View>

      {/* Example Sentence Box */}
      <View style={styles.sentenceContainer}>
        <View style={styles.sentenceTopRow}>
           <View>
             {/* Simple furigana mock for sentence */}
             <View style={{flexDirection: 'row', marginBottom: 2}}>
                <Text style={styles.sentenceRuby}>あさ</Text>
                <Text style={{width: 8}}/>
                <Text style={styles.sentenceRuby}>はん</Text>
                <Text style={{width: 14}}/>
                <Text style={styles.sentenceRuby}>た</Text>
             </View>
             <Text style={styles.sentenceJapanese}>朝ご飯を食べました。</Text>
           </View>
           <TouchableOpacity style={{padding: 4}}>
              <Volume2 size={20} color={Colors.dark.pitchLine} />
           </TouchableOpacity>
        </View>
        <Text style={styles.sentenceEnglish}>I ate breakfast this morning.</Text>
        
        <Text style={styles.sentenceFooter}>例文 • Tatoeba CC BY</Text>
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
            <View style={styles.progressBarFill} />
          </View>
        }
        rightContent={
          <Text style={styles.progressText}>23/87</Text>
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

      <View style={styles.bottomArea}>
        {isFlipped ? (
          <RatingButtons onRating={handleRating} />
        ) : (
          <View style={styles.actionWrapper}>
            <TouchableOpacity style={styles.flipButton} onPress={handleFlip}>
              <Text style={styles.flipButtonText}>答えを表示</Text>
            </TouchableOpacity>
            <Text style={styles.actionHintText}>タップ または スペースキー</Text>
          </View>
        )}
      </View>
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
    width: '100%',
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
    marginBottom: Spacing.three,
  },
  sentenceFooter: {
    color: '#4F525A', // darker gray
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
