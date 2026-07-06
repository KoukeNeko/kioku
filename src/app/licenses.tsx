import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, Fonts, BORDER_RADIUS } from '../constants/theme';
import { AppBar } from '../components/ui/AppBar';
import { BackButton } from '../components/ui/BackButton';
import { LibraryItem } from '../components/ui/LibraryItem';

export default function LicensesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AppBar
                leftContent={<BackButton />}
                centerContent={<Text style={styles.headerTitle}>ライセンス</Text>}
                rightContent={
                    <View style={styles.iconButton} pointerEvents="none">
                        <ChevronLeft size={28} color="transparent" />
                    </View>
                }
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>フォント (Fonts)</Text>
                    <View style={styles.divider} />
                    <LibraryItem 
                        name="Source Han Serif (思源宋体)" 
                        license="SIL Open Font License 1.1" 
                        description="Copyright 2017-2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'." 
                        url="https://github.com/adobe-fonts/source-han-serif" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="LINE Seed TW" 
                        license="SIL Open Font License 1.1" 
                        description="Copyright (c) 2025, LY Corporation, with Reserved Font Name 'LINE Seed TW'." 
                        url="https://seed.line.me/" 
                    />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>辞書データ (Dictionaries)</Text>
                    <View style={styles.divider} />
                    
                    <LibraryItem 
                        name="JMdict / KANJIDIC2" 
                        license="EDRDG License" 
                        description="This package uses the JMdict and KANJIDIC2 dictionary files. These files are the property of the Electronic Dictionary Research and Development Group, and are used in conformance with the Group's licence." 
                        url="http://www.edrdg.org/" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="JmdictFurigana" 
                        license="Creative Commons Attribution-Share Alike 4.0" 
                        description="Furigana alignment data by Doublevil, derived from JMdict (EDRDG)." 
                        url="https://github.com/Doublevil/JmdictFurigana" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="KanjiVG" 
                        license="Creative Commons Attribution-Share Alike 3.0" 
                        description="Copyright (C) 2009-2024 Ulrich Apel." 
                        url="https://kanjivg.tagaini.net/" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="Tanaka Corpus (Tatoeba)" 
                        license="CC BY 2.0 FR" 
                        description="Example sentences are from the Tanaka Corpus, distributed via the EDRDG and the Tatoeba Project." 
                        url="https://tatoeba.org/" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="UniDic" 
                        license="BSD 3-Clause" 
                        description="Pitch accent (accent type) data from UniDic, by the National Institute for Japanese Language and Linguistics (NINJAL), via fugashi and unidic-lite." 
                        url="https://clrd.ninjal.ac.jp/unidic/" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="pyopenjtalk / Open JTalk" 
                        license="Modified BSD License" 
                        description="Compound-word pitch accent estimation via pyopenjtalk, built on Open JTalk and the NAIST Japanese Dictionary." 
                        url="https://github.com/r9y9/pyopenjtalk" 
                    />
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>語彙データ (Vocabulary)</Text>
                    <View style={styles.divider} />

                    <LibraryItem 
                        name="JLPT Vocabulary Lists" 
                        license="CC BY / MIT" 
                        description="JLPT N1–N5 vocabulary, readings and meanings from tanos.co.uk (Jonathan Waller, CC BY), packaged by open-anki-jlpt-decks (Jamie Sinclair, MIT)." 
                        url="https://github.com/jamiesinclair/open-anki-jlpt-decks" 
                    />
                    <View style={styles.innerDivider} />
                    <LibraryItem 
                        name="wordfreq" 
                        license="Apache License 2.0" 
                        description="Word frequency ranking by wordfreq (Robyn Speer), aggregated from multiple corpora." 
                        url="https://github.com/rspeer/wordfreq" 
                    />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.dark.background,
    },
    iconButton: {
        padding: Spacing.one,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: Colors.dark.text,
    },
    content: { paddingTop: 24,
        paddingHorizontal: Spacing.three,
        paddingBottom: Spacing.six,
        gap: Spacing.four,
    },
    card: {
        backgroundColor: '#16171B',
        borderRadius: BORDER_RADIUS.lg,
        padding: Spacing.four,
        borderWidth: 1,
        borderColor: '#2E3135',
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: Colors.dark.primaryOrange,
        fontFamily: Fonts?.sans,
        marginBottom: Spacing.three,
    },
    divider: {
        height: 1,
        backgroundColor: '#2E3135',
        marginBottom: Spacing.three,
    },
    innerDivider: {
        height: 1,
        backgroundColor: '#2E3135',
        marginVertical: Spacing.three,
        opacity: 0.5,
    }
});
