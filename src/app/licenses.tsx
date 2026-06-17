import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, Fonts, BORDER_RADIUS } from '../constants/theme';
import { AppBar } from '../components/ui/AppBar';

export default function LicensesScreen() {
    const router = useRouter();

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AppBar 
                leftContent={
                    <TouchableOpacity onPress={() => router.back()} style={styles.iconButton}>
                        <ChevronLeft size={28} color={Colors.dark.text} />
                    </TouchableOpacity>
                }
                centerContent={
                    <Text style={styles.headerTitle}>ライセンス</Text>
                }
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
                    <Text style={styles.itemName}>Source Han Serif (思源宋体)</Text>
                    <Text style={styles.licenseText}>SIL Open Font License 1.1</Text>
                    <Text style={styles.descriptionText}>
                        Copyright 2017-2021 Adobe Systems Incorporated (http://www.adobe.com/), with Reserved Font Name 'Source'.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>辞書データ (Dictionaries)</Text>
                    <View style={styles.divider} />
                    
                    <Text style={styles.itemName}>JMdict / KANJIDIC2</Text>
                    <Text style={styles.licenseText}>EDRDG License</Text>
                    <Text style={styles.descriptionText}>
                        This package uses the JMdict and KANJIDIC2 dictionary files. These files are the property of the Electronic Dictionary Research and Development Group, and are used in conformance with the Group's licence.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>JmdictFurigana</Text>
                    <Text style={styles.licenseText}>Creative Commons Attribution-Share Alike 4.0</Text>
                    <Text style={styles.descriptionText}>
                        Furigana alignment data by Doublevil, derived from JMdict (EDRDG).
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>KanjiVG</Text>
                    <Text style={styles.licenseText}>Creative Commons Attribution-Share Alike 3.0</Text>
                    <Text style={styles.descriptionText}>
                        Copyright (C) 2009-2024 Ulrich Apel.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>Tanaka Corpus (Tatoeba)</Text>
                    <Text style={styles.licenseText}>CC BY 2.0 FR</Text>
                    <Text style={styles.descriptionText}>
                        Example sentences are from the Tanaka Corpus, distributed via the EDRDG and the Tatoeba Project.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>Kanjium</Text>
                    <Text style={styles.licenseText}>Creative Commons Attribution-Share Alike 4.0</Text>
                    <Text style={styles.descriptionText}>
                        Pitch accent data from the Kanjium project (mifunetoshiro).
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>語彙データ (Vocabulary)</Text>
                    <View style={styles.divider} />

                    <Text style={styles.itemName}>JLPT Vocabulary Lists</Text>
                    <Text style={styles.licenseText}>CC BY / MIT</Text>
                    <Text style={styles.descriptionText}>
                        JLPT N1–N5 vocabulary, readings and meanings from tanos.co.uk (Jonathan Waller, CC BY), packaged by open-anki-jlpt-decks (Jamie Sinclair, MIT).
                    </Text>
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
    content: {
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
    },
    itemName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: Colors.dark.text,
        marginBottom: Spacing.one,
    },
    licenseText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#68A5FF',
        marginBottom: Spacing.two,
    },
    descriptionText: {
        fontSize: 14,
        color: Colors.dark.textSecondary,
        lineHeight: 20,
    }
});
