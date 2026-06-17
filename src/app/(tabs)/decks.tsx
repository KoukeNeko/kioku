import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { Search, MoreHorizontal, Plus, LayoutGrid, List, Library, Check } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';

export default function Decks() {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'bookshelf'>('bookshelf');

  const deckData = [
    { id: 1, title: "N3\n語彙", count: 324, tag: "N3", color: "#FF5A36", pending: 42, progress: 40 },
    { id: 2, title: "常用\n漢字", count: 2136, tag: "漢字", color: "#F0A944", pending: 27, progress: 25 },
    { id: 3, title: "N4\n語彙", count: 285, tag: "N4", color: "#5CB3FF", pending: 15, progress: 60 },
    { id: 4, title: "会話\nフレーズ", count: 160, tag: "会話", color: "#4DA6FF", pending: 8, progress: 20 },
    { id: 5, title: "N5\n基礎", count: 98, tag: "N5", color: "#66D283", pending: 0, progress: 100 },
    { id: 6, title: "動詞\n活用", count: 120, tag: "文法", color: "#9D72FF", pending: 33, progress: 35 },
    { id: 7, title: "自分\nの単語", count: 48, tag: "単語", color: "#20B2AA", pending: 5, progress: 10 },
  ];

  const renderVerticalText = (text: string) => {
    // split by newline first (e.g. "N3\n語彙")
    const parts = text.split('\n');
    return parts.map((part, index) => {
      // if part is english alphanumeric (like N3), keep it horizontal
      if (/^[a-zA-Z0-9]+$/.test(part)) {
        return <Text key={index} style={styles.verticalCharText}>{part}</Text>;
      }
      // otherwise, split into characters and stack
      return part.split('').map((char, charIdx) => {
        // Handle vertical chōonpu
        const displayChar = char === 'ー' ? '丨' : char;
        return <Text key={`${index}-${charIdx}`} style={styles.verticalCharText}>{displayChar}</Text>;
      });
    });
  };

  const allItems = [...deckData, { id: 'new', isNew: true }];
  const chunkedDecks = [];
  for (let i = 0; i < allItems.length; i += 4) {
    chunkedDecks.push(allItems.slice(i, i + 4));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Custom Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>デッキ</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconButton}>
            <Search size={22} color={Colors.dark.textSecondary} />
          </TouchableOpacity>
          <View style={styles.viewToggle}>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'list' && styles.toggleBtnActive]}
              onPress={() => setViewMode('list')}
            >
              <List size={16} color={viewMode === 'list' ? Colors.dark.text : Colors.dark.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'grid' && styles.toggleBtnActive]}
              onPress={() => setViewMode('grid')}
            >
              <LayoutGrid size={16} color={viewMode === 'grid' ? Colors.dark.text : Colors.dark.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleBtn, viewMode === 'bookshelf' && styles.toggleBtnActive]}
              onPress={() => setViewMode('bookshelf')}
            >
              <Library size={16} color={viewMode === 'bookshelf' ? Colors.dark.text : Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {viewMode === 'bookshelf' ? (
          <View style={styles.bookshelfContainer}>
            {chunkedDecks.map((shelf, shelfIdx) => (
              <View key={`shelf-${shelfIdx}`} style={styles.shelfRowWrapper}>
                <View style={styles.shelfRow}>
                  {shelf.map((deck: any, index) => {
                    if (deck.isNew) {
                      return (
                        <TouchableOpacity key="new" style={styles.newSpine}>
                          <Plus size={24} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                      );
                    }

                    // Calculate a slight height variation
                    const heightOffset = (deck.id % 3) * 10;
                    
                    return (
                      <TouchableOpacity key={deck.id} style={[styles.spineWrapper, { marginTop: heightOffset }]}>
                        <LinearGradient
                          colors={[`${deck.color}15`, '#16171B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.spineCard}
                        >
                          {/* Top Pill */}
                          <View style={styles.spineTop}>
                            <View style={[styles.spinePill, { backgroundColor: deck.pending === 0 ? '#66D283' : deck.color }]}>
                              {deck.pending === 0 ? (
                                <Check size={14} color="#000" strokeWidth={3} />
                              ) : (
                                <Text style={styles.spinePillText}>{deck.pending}</Text>
                              )}
                            </View>
                          </View>

                          {/* Vertical Text */}
                          <View style={styles.verticalTextContainer}>
                            {renderVerticalText(deck.title)}
                          </View>

                          {/* Bottom Label */}
                          <View style={[styles.spineBottom, { backgroundColor: deck.color }]}>
                            <Text style={styles.spineBottomText}>{deck.pending === 0 ? '完了' : deck.count}</Text>
                          </View>
                        </LinearGradient>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {/* The visual shelf board */}
                <LinearGradient
                  colors={['#2E3135', '#0B0C10']}
                  style={styles.shelfBoard}
                />
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {deckData.map((deck) => (
              <TouchableOpacity key={deck.id} style={styles.cardWrapper}>
                <LinearGradient
                  colors={[`${deck.color}0C`, '#16171B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 0.5, y: 0 }}
                  style={styles.card}
                >
                  {/* Left Edge Bar */}
                  <View style={[styles.leftEdge, { backgroundColor: deck.color }]} />
                  
                  {/* Card Inner Content */}
                  <View style={styles.cardInner}>
                    {/* Top Row: Tag & More */}
                    <View style={styles.cardTop}>
                      <View style={[styles.tag, { backgroundColor: `${deck.color}1A` }]}>
                        <Text style={[styles.tagText, { color: deck.color }]}>{deck.tag}</Text>
                      </View>
                      <TouchableOpacity>
                        <MoreHorizontal size={20} color={Colors.dark.textSecondary} />
                      </TouchableOpacity>
                    </View>

                    {/* Title & Count */}
                    <View style={styles.titleContainer}>
                      <Text style={styles.titleText}>{deck.title}</Text>
                      <Text style={styles.countText}>{deck.count} 語</Text>
                    </View>

                    <View style={styles.spacer} />

                    {/* Progress & Pending */}
                    <View style={styles.progressContainer}>
                      <View style={styles.progressBarBg}>
                        <View style={[styles.progressBarFill, { backgroundColor: deck.color, width: `${deck.progress}%` }]} />
                      </View>
                      <View style={styles.pendingRow}>
                        <Text style={[styles.pendingNumber, { color: deck.color }]}>{deck.pending}</Text>
                        <Text style={styles.pendingLabel}>予定</Text>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}

            {/* New Deck Button */}
            <TouchableOpacity style={styles.newDeckCard}>
              <Plus size={28} color={Colors.dark.textSecondary} />
              <Text style={styles.newDeckText}>新規デッキ</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');
const gap = 16;
const cardWidth = (width - 16 * 2 - gap) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.dark.text,
    fontFamily: Fonts?.sans,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  iconButton: {
    padding: Spacing.one,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#0F1014',
    borderRadius: BORDER_RADIUS.md,
    padding: 4,
    borderWidth: 1,
    borderColor: '#1C1D22',
  },
  toggleBtn: {
    padding: 6,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#2E3135',
  },
  scrollContent: {
    padding: Spacing.three,
    paddingBottom: 40,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: gap,
  },
  cardWrapper: {
    width: cardWidth,
    height: 260,
  },
  card: {
    flex: 1,
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  leftEdge: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
  },
  cardInner: {
    flex: 1,
    padding: Spacing.three,
    paddingLeft: Spacing.three + 6, // account for left edge
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  titleContainer: {
    marginTop: Spacing.four,
  },
  titleText: {
    fontFamily: Fonts?.serif,
    fontSize: 28,
    color: Colors.dark.text,
    lineHeight: 34,
  },
  countText: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: Spacing.two,
  },
  spacer: {
    flex: 1,
  },
  progressContainer: {
    marginTop: 'auto',
  },
  progressBarBg: {
    height: 4,
    backgroundColor: '#2E3135',
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  progressBarFill: {
    height: 4,
    borderRadius: 2,
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  pendingNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: Fonts?.sans,
    lineHeight: 36,
  },
  pendingLabel: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 6,
  },
  newDeckCard: {
    width: cardWidth,
    height: 260,
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 2,
    borderColor: '#2E3135',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#0F1014',
  },
  newDeckText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
  },
  // Bookshelf Styles
  bookshelfContainer: {
    paddingHorizontal: 8,
    gap: 40,
  },
  shelfRowWrapper: {
    marginBottom: 16,
  },
  shelfRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 16,
    paddingHorizontal: 16,
    zIndex: 2,
  },
  shelfBoard: {
    height: 8,
    borderRadius: 4,
    marginTop: -4,
    zIndex: 1,
  },
  spineWrapper: {
    width: 60,
    height: 230,
  },
  spineCard: {
    flex: 1,
    borderRadius: 6,
    overflow: 'hidden',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  spineTop: {
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: 'center',
  },
  spinePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
  },
  spinePillText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 13,
  },
  verticalTextContainer: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 8,
  },
  verticalCharText: {
    fontFamily: Fonts?.serif,
    fontSize: 18,
    color: Colors.dark.text,
    lineHeight: 22,
    textAlign: 'center',
  },
  spineBottom: {
    width: '100%',
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spineBottomText: {
    color: '#000',
    fontSize: 11,
    fontFamily: Fonts?.sans,
  },
  newSpine: {
    width: 60,
    height: 190,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#2E3135',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F1014',
  }
});
