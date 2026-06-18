import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Volume2, PenTool, EyeOff, Eye } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { Colors, Spacing, Fonts, BORDER_RADIUS } from '../constants/theme';
import { AppBar } from '../components/ui/AppBar';
import { KanjiStrokeBoard } from '../components/ui/KanjiStrokeBoard';
import kanjiData from '../data/kanjiData.json';
import { getKanjiWords, getKanjiExamples, RelatedWord, RelatedExample } from '../db/repositories/kanjiRepository';
import { FuriganaText } from '../components/ui/FuriganaText';
import { ExampleSentenceCard } from '../components/ui/ExampleSentenceCard';
import { BackButton } from '../components/ui/BackButton';

const { width } = Dimensions.get('window');

const DEFAULT_KANJI = '木';

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

const speakJapanese = (text: string) => {
    Speech.speak(text, { language: 'ja-JP', rate: 0.9 });
};

export default function StrokeOrder() {
    const router = useRouter();
    const { kanji: kanjiParam } = useLocalSearchParams<{ kanji?: string }>();

    const kanjiChar = typeof kanjiParam === 'string' && kanjiParam.length > 0 ? [...kanjiParam][0] : DEFAULT_KANJI;
    const entry = KANJI_BY_CHAR[kanjiChar] ?? KANJI_BY_CHAR[DEFAULT_KANJI];
    const paths = entry?.strokes ?? [];

    const [trigger, setTrigger] = useState(0);
    const [showGuidelines, setShowGuidelines] = useState(true);
    const [tab, setTab] = useState<'words' | 'sentences'>('words');

    const [words, setWords] = useState<RelatedWord[]>([]);
    const [examples, setExamples] = useState<RelatedExample[]>([]);

    useEffect(() => {
        setWords(getKanjiWords(kanjiChar, 10));
        setExamples(getKanjiExamples(kanjiChar, 10));
    }, [kanjiChar]);

    const handleReplay = () => {
        setTrigger(prev => prev + 1);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <AppBar
                leftContent={<BackButton />}
                centerContent={
                    <Text style={styles.headerTitle}>{kanjiChar}</Text>
                }
                rightContent={
                    <View style={{ width: 40 }} />
                }
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Animated Board & Controls */}
                <View style={styles.boardArea}>
                    <View style={styles.boardWrapper}>
                        <KanjiStrokeBoard
                            paths={paths}
                            trigger={trigger}
                            activeStroke={0}
                            showGuidelines={showGuidelines}
                        />
                        <TouchableOpacity style={styles.replayBtn} onPress={handleReplay}>
                            <PenTool size={18} color={Colors.dark.primaryOrange} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 4 Info Cards */}
                <View style={styles.infoRow}>
                    <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel} numberOfLines={1} adjustsFontSizeToFit>JLPT</Text>
                        {entry.jlpt ? <Text style={styles.infoBoxValueBadge}>N{entry.jlpt}</Text> : <Text style={styles.infoBoxValue}>-</Text>}
                    </View>
                    <View style={styles.infoBoxBorder} />
                    <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel} numberOfLines={1} adjustsFontSizeToFit>WANIKANI</Text>
                        <Text style={styles.infoBoxValue} numberOfLines={1} adjustsFontSizeToFit>{entry.grade ? `Lv ${entry.grade}` : '-'}</Text>
                    </View>
                    <View style={styles.infoBoxBorder} />
                    <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel} numberOfLines={1} adjustsFontSizeToFit>頻度</Text>
                        <Text style={styles.infoBoxValue} numberOfLines={1} adjustsFontSizeToFit>{entry.frequency || '-'} <Text style={{ color: Colors.dark.pitchBlue }}>○</Text></Text>
                    </View>
                    <View style={styles.infoBoxBorder} />
                    <View style={styles.infoBox}>
                        <Text style={styles.infoBoxLabel} numberOfLines={1} adjustsFontSizeToFit>画数</Text>
                        <Text style={styles.infoBoxValue} numberOfLines={1} adjustsFontSizeToFit>{entry.strokeCount || paths.length} <Text style={{ color: Colors.dark.primaryOrange }}>🪶</Text></Text>
                    </View>
                </View>

                {/* Meanings */}
                {entry.meanings && entry.meanings.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>意味 ・ MEANINGS</Text>
                        <Text style={styles.meaningsText}>{entry.meanings.join(', ')}</Text>
                    </View>
                )}

                {/* On'yomi */}
                {entry.on.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>音読み ・ ON'YOMI</Text>
                        <View style={styles.readingRow}>
                            {entry.on.map((reading, idx) => (
                                <TouchableOpacity key={`on-${idx}`} style={styles.readingChip} onPress={() => speakJapanese(reading)}>
                                    <Text style={styles.readingText}>{reading}</Text>
                                    <Volume2 size={16} color={Colors.dark.primaryOrange} style={{ marginLeft: 6 }} />
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* Kun'yomi */}
                {entry.kun.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>訓読み ・ KUN'YOMI</Text>
                        <View style={styles.readingRow}>
                            {entry.kun.map((reading, idx) => {
                                const cleanReading = reading.replace('.', '');
                                return (
                                    <TouchableOpacity key={`kun-${idx}`} style={styles.readingChip} onPress={() => speakJapanese(cleanReading)}>
                                        <Text style={styles.readingText}>{reading}</Text>
                                        <Volume2 size={16} color={Colors.dark.primaryOrange} style={{ marginLeft: 6 }} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}

                {/* Examples */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>例 ・ EXAMPLES</Text>
                    <View style={styles.tabContainer}>
                        <TouchableOpacity style={[styles.tabBtn, tab === 'words' && styles.tabBtnActive]} onPress={() => setTab('words')}>
                            <Text style={[styles.tabBtnText, tab === 'words' && styles.tabBtnTextActive]}>Words</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.tabBtn, tab === 'sentences' && styles.tabBtnActive]} onPress={() => setTab('sentences')}>
                            <Text style={[styles.tabBtnText, tab === 'sentences' && styles.tabBtnTextActive]}>Sentences</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.listContainer}>
                        {tab === 'words' && words.map((w, idx) => (
                            <ExampleSentenceCard 
                                key={`word-${idx}`} 
                                example={{
                                    jp: w.expression,
                                    en: w.gloss.split(';')[0],
                                    furigana: w.furigana
                                }} 
                                onPress={() => router.push(`/review?vocabId=${w.id}`)}
                            />
                        ))}
                        {tab === 'sentences' && examples.map((e, idx) => (
                            <ExampleSentenceCard key={`ex-${idx}`} example={e} />
                        ))}
                    </View>
                </View>

                <View style={{ height: 60 }} />
            </ScrollView>
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
        fontSize: 18,
        fontFamily: Fonts?.serif,
    },
    scrollContent: {
        paddingHorizontal: Spacing.four,
        paddingTop: Spacing.two,
    },
    boardArea: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.four,
        marginTop: Spacing.two,
        position: 'relative',
    },
    boardWrapper: {
        width: width * 0.8,
        height: width * 0.8,
        position: 'relative',
    },
    replayBtn: {
        position: 'absolute',
        bottom: 1, // 之後處理
        right: 8,
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: Spacing.four,
        marginBottom: Spacing.four,
    },
    infoBox: {
        width: '24%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: Spacing.two,
        overflow: 'hidden',
    },
    infoBoxBorder: {
        width: 1,
        backgroundColor: 'transparent',
        borderLeftWidth: 1,
        borderColor: '#2E3135',
        borderStyle: 'dashed',
    },
    infoBoxLabel: {
        color: '#555861',
        fontSize: 10,
        letterSpacing: 1,
        fontWeight: 'bold',
        fontFamily: Fonts?.sans,
        width: '100%',
        textAlign: 'center',
    },
    infoBoxValue: {
        color: Colors.dark.text,
        fontSize: 16,
        fontWeight: '600',
        fontFamily: Fonts?.sans,
        width: '100%',
        textAlign: 'center',
    },
    infoBoxValueBadge: {
        backgroundColor: '#1E2D3D',
        color: Colors.dark.pitchBlue,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 14,
        fontWeight: 'bold',
        overflow: 'hidden',
    },
    section: {
        marginBottom: Spacing.four,
    },
    sectionTitle: {
        color: '#555861',
        fontSize: 12,
        letterSpacing: 2,
        marginBottom: Spacing.two,
        fontWeight: 'bold',
        fontFamily: Fonts?.sans,
    },
    meaningsText: {
        color: Colors.dark.text,
        fontSize: 22,
        fontFamily: Fonts?.serif,
        lineHeight: 32,
    },
    readingRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: Spacing.three,
    },
    readingChip: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#2E3135',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: '#121316',
    },
    readingText: {
        color: Colors.dark.text,
        fontSize: 16,
        fontFamily: Fonts?.sans,
    },
    tabContainer: {
        flexDirection: 'row',
        backgroundColor: '#1C1D22',
        borderRadius: BORDER_RADIUS.md,
        padding: 4,
        marginBottom: Spacing.four,
    },
    tabBtn: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: BORDER_RADIUS.md - 2,
    },
    tabBtnActive: {
        backgroundColor: '#2E3135',
    },
    tabBtnText: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        fontWeight: '600',
    },
    tabBtnTextActive: {
        color: Colors.dark.text,
    },
    listContainer: {
        gap: Spacing.three,
    }
});
