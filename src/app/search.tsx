import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Search, X } from "lucide-react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Colors, Spacing, BORDER_RADIUS } from "../constants/theme";
import { searchVocab, searchKanji, searchDecks, VocabSearchResult, KanjiSearchResult, DeckSearchResult } from "../db/repositories/searchRepository";
import { HighlightText } from "../components/ui/HighlightText";

type SearchTab = 'all' | 'vocab' | 'kanji' | 'deck';

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  
  const [vocabResults, setVocabResults] = useState<VocabSearchResult[]>([]);
  const [kanjiResults, setKanjiResults] = useState<KanjiSearchResult[]>([]);
  const [deckResults, setDeckResults] = useState<DeckSearchResult[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (q) {
      setVocabResults(searchVocab(q, 20));
      setKanjiResults(searchKanji(q, 20));
      setDecksResults(searchDecks(q, 20));
    } else {
      setVocabResults([]);
      setKanjiResults([]);
      setDecksResults([]);
    }
  }, [query]);

  // Handle deck results update
  const setDecksResults = (res: DeckSearchResult[]) => setDeckResults(res);

  const handleCancel = () => {
    router.back();
  };

  const renderTabs = () => (
    <View style={styles.tabsContainer}>
      {(['all', 'vocab', 'kanji', 'deck'] as SearchTab[]).map(tab => {
        const isActive = activeTab === tab;
        const labels: Record<SearchTab, string> = {
          all: 'すべて',
          vocab: '単語',
          kanji: '漢字',
          deck: 'デッキ'
        };
        return (
          <TouchableOpacity 
            key={tab}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {labels[tab]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderVocabResults = () => {
    if (vocabResults.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>単語 ・ {vocabResults.length}件</Text>
        {vocabResults.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => router.push(`/review?vocabId=${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <HighlightText text={item.reading} highlight={query} style={styles.rubyText} />
            </View>
            <View style={styles.cardMain}>
              <View style={styles.expressionRow}>
                <HighlightText text={item.expression} highlight={query} style={styles.expressionText} />
                {item.jlpt && (
                  <View style={styles.jlptBadge}>
                    <Text style={styles.jlptBadgeText}>N{item.jlpt} 語彙</Text>
                  </View>
                )}
              </View>
              <HighlightText text={item.gloss} highlight={query} style={styles.glossText} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderKanjiResults = () => {
    if (kanjiResults.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>漢字 ・ {kanjiResults.length}件</Text>
        <View style={styles.kanjiGrid}>
          {kanjiResults.map(item => (
            <TouchableOpacity 
              key={item.char} 
              style={styles.kanjiCard}
              onPress={() => router.push(`/stroke-order?char=${item.char}`)}
            >
              <HighlightText text={item.char} highlight={query} style={styles.kanjiCharText} />
              <View style={styles.kanjiDetails}>
                <HighlightText text={item.meanings.split(',')[0]} highlight={query} style={styles.kanjiMeaningText} />
                <HighlightText text={(item.on_readings || item.kun_readings || '').split(',')[0]} highlight={query} style={styles.kanjiReadingText} />
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderDeckResults = () => {
    if (deckResults.length === 0) return null;
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>デッキ ・ {deckResults.length}件</Text>
        {deckResults.map(item => (
          <TouchableOpacity 
            key={item.id} 
            style={styles.card}
            onPress={() => router.push(`/deck/${item.id}`)}
          >
            <View style={styles.deckCardInner}>
              <View style={[styles.deckColorBar, { backgroundColor: item.color || Colors.dark.primaryOrange }]} />
              <View style={styles.deckInfo}>
                <HighlightText text={item.name} highlight={query} style={styles.deckNameText} />
                {item.vocab_count > 0 && query.trim() && (
                  <Text style={styles.deckSubtitle}>「{query.trim()}」を含む {item.vocab_count}語</Text>
                )}
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      
      {/* Results (render first so it goes under absolute header) */}
      <ScrollView 
        style={styles.scrollArea} 
        contentContainerStyle={{ paddingTop: insets.top + 120, paddingBottom: insets.bottom + Spacing.four }}
        showsVerticalScrollIndicator={false} 
        keyboardShouldPersistTaps="handled"
      >
        {(activeTab === 'all' || activeTab === 'vocab') && renderVocabResults()}
        {(activeTab === 'all' || activeTab === 'kanji') && renderKanjiResults()}
        {(activeTab === 'all' || activeTab === 'deck') && renderDeckResults()}
      </ScrollView>

      {/* Floating Gradient Header */}
      <LinearGradient 
        colors={[Colors.dark.background, Colors.dark.background, `${Colors.dark.background}00`]}
        locations={[0, 0.8, 1]}
        style={[styles.floatingHeader, { paddingTop: insets.top }]}
        pointerEvents="box-none"
      >
        <View style={styles.header} pointerEvents="auto">
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.dark.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor={Colors.dark.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              selectionColor={Colors.dark.primaryOrange}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery("")}>
                <View style={styles.clearIconBg}>
                  <X size={14} color={Colors.dark.background} />
                </View>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelText}>取消</Text>
          </TouchableOpacity>
        </View>

        <View pointerEvents="auto">
          {renderTabs()}
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  floatingHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: BORDER_RADIUS.round,
    paddingHorizontal: Spacing.four,
    height: 48,
    borderWidth: 1,
    borderColor: Colors.dark.primaryOrange,
  },
  searchInput: {
    flex: 1,
    color: Colors.dark.text,
    fontSize: 16,
    marginLeft: Spacing.three,
  },
  clearIconBg: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.dark.textSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.two,
  },
  cancelText: {
    color: Colors.dark.primaryOrange,
    fontSize: 16,
    marginLeft: Spacing.four,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    marginBottom: Spacing.four,
    gap: Spacing.two,
  },
  tabButton: {
    paddingHorizontal: Spacing.four,
    paddingVertical: 8,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: Colors.dark.backgroundElement,
  },
  tabButtonActive: {
    backgroundColor: Colors.dark.primaryOrange,
  },
  tabText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#000000',
    fontWeight: 'bold',
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  section: {
    marginBottom: Spacing.six,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginBottom: Spacing.three,
  },
  card: {
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: BORDER_RADIUS.md,
    padding: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  cardHeader: {
    marginBottom: 4,
  },
  rubyText: {
    color: Colors.dark.primaryOrange,
    fontSize: 12,
  },
  cardMain: {
    flexDirection: 'column',
  },
  expressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  expressionText: {
    color: Colors.dark.text,
    fontSize: 24,
    marginRight: Spacing.three,
    flex: 1,
  },
  glossText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    flex: 1,
  },
  jlptBadge: {
    backgroundColor: 'rgba(77, 166, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: Spacing.two,
  },
  jlptBadgeText: {
    color: '#4DA6FF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  kanjiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  kanjiCard: {
    backgroundColor: Colors.dark.backgroundElement,
    borderRadius: BORDER_RADIUS.md,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
    flexDirection: 'row',
    alignItems: 'center',
    width: (Dimensions.get('window').width - Spacing.four * 2 - Spacing.three) / 2,
  },
  kanjiCharText: {
    color: Colors.dark.primaryOrange,
    fontSize: 28,
    marginRight: Spacing.three,
  },
  kanjiDetails: {
    flex: 1,
  },
  kanjiMeaningText: {
    color: Colors.dark.text,
    fontSize: 14,
  },
  kanjiReadingText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  deckCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deckColorBar: {
    width: 6,
    height: 32,
    borderRadius: 3,
    marginRight: Spacing.three,
  },
  deckInfo: {
    flex: 1,
  },
  deckNameText: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  deckSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  }
});
