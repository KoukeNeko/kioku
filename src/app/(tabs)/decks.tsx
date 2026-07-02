import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { Search, MoreHorizontal, Plus, LayoutGrid, List, Library, Check } from "lucide-react-native";
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useFocusEffect } from "expo-router";
import { getAllDecksWithMetrics, Deck } from "../../db/repositories/deckRepository";
import { AppBar } from "../../components/ui/AppBar";
import { useCallback } from "react";

export default function Decks() {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'bookshelf'>('bookshelf');
  const [decks, setDecks] = useState<Deck[]>([]);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getAllDecksWithMetrics()
        .then((data) => { if (!cancelled) setDecks(data); })
        .catch((e) => console.error('Failed to load decks', e));
      return () => { cancelled = true; };
    }, [])
  );

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

  const formatTitleForSpine = (name: string) => {
    // JLPT N5 -> N5\n語彙 or similar. If it has a space, replace the first space with newline.
    // e.g. "JLPT N5" -> "N5\n語彙"
    let t = name.replace('JLPT ', '');
    // If it's just "N5", make it "N5\n語彙"
    if (t.match(/^N[1-5]$/)) {
      t = t + '\n語彙';
    } else if (t.includes(' ')) {
      t = t.replace(' ', '\n');
    }
    return t;
  };

  const allItems = [...decks, { id: 'new', isNew: true } as any];
  const chunkedDecks = [];
  for (let i = 0; i < allItems.length; i += 4) {
    chunkedDecks.push(allItems.slice(i, i + 4));
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={<Text style={styles.headerTitle}>デッキ</Text>}
        rightContent={
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.push('/search')}>
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
        }
      />

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

                    // Calculate a slight height variation based on id string length or char codes
                    const heightOffset = (deck.id.length % 3) * 10;
                    
                    const pending = Math.min(deck.metrics.newCards, 20) + deck.metrics.learningCards + deck.metrics.reviewCards;
                    
                    return (
                      <TouchableOpacity 
                        key={deck.id} 
                        style={[styles.spineWrapper, { marginTop: heightOffset }]}
                        onPress={() => router.push(`/deck/${deck.id}`)}
                      >
                        <LinearGradient
                          colors={[`${deck.color || '#66D283'}15`, '#16171B']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.spineCard}
                        >
                          {/* Top Pill */}
                          <View style={styles.spineTop}>
                            <View style={[styles.spinePill, { backgroundColor: pending === 0 ? '#66D283' : (deck.color || '#66D283') }]}>
                              {pending === 0 ? (
                                <Check size={14} color="#000" strokeWidth={3} />
                              ) : (
                                <Text style={styles.spinePillText}>{pending}</Text>
                              )}
                            </View>
                          </View>

                          {/* Vertical Text */}
                          <View style={styles.verticalTextContainer}>
                            {renderVerticalText(formatTitleForSpine(deck.name))}
                          </View>

                          {/* Bottom Label */}
                          <View style={[styles.spineBottom, { backgroundColor: deck.color || '#66D283' }]}>
                            <Text style={styles.spineBottomText}>{pending === 0 ? '完了' : deck.metrics.totalCards}</Text>
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
        ) : viewMode === 'list' ? (
          <View style={styles.listContainer}>
            {decks.map((deck) => {
              const pending = Math.min(deck.metrics.newCards, 20) + deck.metrics.learningCards + deck.metrics.reviewCards;
              const progressRatio = deck.metrics.totalCards > 0 ? (deck.metrics.totalCards - pending) / deck.metrics.totalCards : 1;
              const progressPercent = Math.max(0, Math.min(100, progressRatio * 100));

              return (
                <TouchableOpacity 
                  key={deck.id} 
                  style={styles.deckCard}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                >
                  <View style={styles.deckContentRow}>
                    <View style={styles.deckLeft}>
                      <View style={styles.deckTitleRow}>
                        <Text style={styles.deckTitle}>{deck.name}</Text>
                        {deck.tags && deck.tags.length > 0 && (
                          <View style={[styles.tagBadge, { backgroundColor: '#1C2939' }]}>
                            <Text style={[styles.tagText, { color: deck.color || '#68A5FF' }]}>{deck.tags[0]}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.deckSubtitle}>{deck.description}</Text>
                    </View>
                    <View style={styles.deckRight}>
                      <Text style={[styles.dueCount, { color: pending === 0 ? '#66D283' : (deck.color || Colors.dark.primaryOrange) }]}>{pending}</Text>
                      <Text style={styles.dueLabel}>予定</Text>
                    </View>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: `${progressPercent}%`, backgroundColor: pending === 0 ? '#66D283' : (deck.color || Colors.dark.primaryOrange) }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
            {/* New Deck Button (List) */}
            <TouchableOpacity style={styles.newDeckListCard}>
              <Plus size={24} color={Colors.dark.textSecondary} />
              <Text style={styles.newDeckListText}>新規デッキ</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.gridContainer}>
            {decks.map((deck) => {
              const pending = Math.min(deck.metrics.newCards, 20) + deck.metrics.learningCards + deck.metrics.reviewCards;
              const progressRatio = deck.metrics.totalCards > 0 ? (deck.metrics.totalCards - pending) / deck.metrics.totalCards : 1;
              const progressPercent = Math.max(0, Math.min(100, progressRatio * 100));

              return (
                <TouchableOpacity 
                  key={deck.id} 
                  style={styles.cardWrapper}
                  onPress={() => router.push(`/deck/${deck.id}`)}
                >
                  <LinearGradient
                    colors={[`${deck.color || '#66D283'}0C`, '#16171B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 0.5, y: 0 }}
                    style={styles.card}
                  >
                    {/* Left Edge Bar */}
                    <View style={[styles.leftEdge, { backgroundColor: deck.color || '#66D283' }]} />
                    
                    {/* Card Inner Content */}
                    <View style={styles.cardInner}>
                      {/* Top Row: Tag & More */}
                      <View style={styles.cardTop}>
                        {deck.tags && deck.tags.length > 0 && (
                          <View style={[styles.tag, { backgroundColor: `${deck.color || '#68A5FF'}1A` }]}>
                            <Text style={[styles.tagText, { color: deck.color || '#68A5FF' }]}>{deck.tags[0]}</Text>
                          </View>
                        )}
                        <TouchableOpacity>
                          <MoreHorizontal size={20} color={Colors.dark.textSecondary} />
                        </TouchableOpacity>
                      </View>

                      {/* Title & Count */}
                      <View style={styles.titleContainer}>
                        <Text style={styles.titleText}>{deck.name}</Text>
                        <Text style={styles.countText}>{deck.metrics.totalCards} 語</Text>
                      </View>

                      <View style={styles.spacer} />

                      {/* Progress & Pending */}
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBarBg}>
                          <View style={[styles.progressBarFill, { backgroundColor: deck.color || '#66D283', width: `${progressPercent}%` }]} />
                        </View>
                        <View style={styles.pendingRow}>
                          <Text style={[styles.pendingNumber, { color: deck.color || '#66D283' }]}>{pending}</Text>
                          <Text style={styles.pendingLabel}>予定</Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}

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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
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
    fontFamily: Fonts?.mono,
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
    fontFamily: Fonts?.mono,
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
  },
  // List View Styles
  listContainer: {
    gap: Spacing.three,
  },
  deckCard: {
    backgroundColor: '#121316',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: '#2E3135',
  },
  deckContentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.three,
  },
  deckLeft: {
    flex: 1,
  },
  deckTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: Spacing.two,
  },
  deckTitle: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  deckSubtitle: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
  },
  deckRight: {
    alignItems: 'center',
    marginLeft: Spacing.three,
  },
  dueCount: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: -2,
  },
  dueLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 10,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#2E3135',
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  newDeckListCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1014',
    borderRadius: BORDER_RADIUS.lg,
    padding: Spacing.four,
    borderWidth: 2,
    borderColor: '#2E3135',
    borderStyle: 'dashed',
    gap: Spacing.two,
  },
  newDeckListText: {
    color: Colors.dark.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  }
});
