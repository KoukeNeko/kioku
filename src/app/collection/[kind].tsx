import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Colors, Spacing, BORDER_RADIUS, Fonts } from "../../constants/theme";
import { AppBar } from "../../components/ui/AppBar";
import { BackButton } from "../../components/ui/BackButton";
import { getCollectionVocabIds } from "../../db/repositories/collectionsRepository";
import { fetchVocabByIds, ApiVocab } from "../../api/contentApi";

export default function CollectionScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [vocabs, setVocabs] = useState<ApiVocab[]>([]);

  const titles: Record<string, string> = {
    history: "学習履歴",
    bookmark: "ブックマーク",
    suspended: "非表示",
    leech: "覚えにくい単語",
    difficult: "難しい単語"
  };
  const title = kind ? (titles[kind] || "コレクション") : "コレクション";

  useFocusEffect(
    useCallback(() => {
      if (!kind) return;
      let cancelled = false;
      setLoading(true);

      const loadData = async () => {
        try {
          const ids = getCollectionVocabIds(kind as any);
          if (ids.length === 0) {
            if (!cancelled) {
              setVocabs([]);
              setLoading(false);
            }
            return;
          }

          const results = await fetchVocabByIds(ids);
          // 重新根據 ids 排序
          const resultById = new Map(results.map(v => [v.id, v]));
          const sorted = ids.map(id => resultById.get(id)).filter(Boolean) as ApiVocab[];

          if (!cancelled) {
            setVocabs(sorted);
            setLoading(false);
          }
        } catch (error) {
          console.error("Failed to load collection", error);
          if (!cancelled) setLoading(false);
        }
      };

      loadData();
      return () => { cancelled = true; };
    }, [kind])
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <AppBar
        leftContent={<BackButton />}
        centerContent={<Text style={styles.headerTitle}>{title}</Text>}
        rightContent={<View style={{ width: 40 }} />}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primaryOrange} />
        </View>
      ) : vocabs.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>まだありません</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four, paddingTop: Spacing.three }}
          showsVerticalScrollIndicator={false}
        >
          {vocabs.map(item => (
            <TouchableOpacity
              key={item.id}
              style={styles.card}
              onPress={() => router.push({ pathname: '/review', params: { vocabId: item.id } })}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.rubyText}>{item.reading}</Text>
              </View>
              <View style={styles.cardMain}>
                <View style={styles.expressionRow}>
                  <Text style={styles.expressionText}>{item.expression}</Text>
                  {item.jlpt && (
                    <View style={styles.jlptBadge}>
                      <Text style={styles.jlptBadgeText}>N{item.jlpt} 語彙</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.glossText}>{item.gloss}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  headerTitle: {
    color: Colors.dark.text,
    fontSize: 16,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: Colors.dark.textSecondary,
    fontSize: 16,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
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
    fontFamily: Fonts?.lineSeedJP,
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
    fontFamily: Fonts?.lineSeedJP,
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
});
