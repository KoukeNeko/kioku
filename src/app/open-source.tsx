import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, Fonts, BORDER_RADIUS } from '../constants/theme';
import { AppBar } from '../components/ui/AppBar';
import { BackButton } from '../components/ui/BackButton';

export default function OpenSourceScreen() {
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <AppBar
                leftContent={
                    <BackButton />
                }
                centerContent={
                    <Text style={styles.headerTitle}>オープンソースライブラリ</Text>
                }
                rightContent={
                    <View style={styles.iconButton} pointerEvents="none">
                        <ChevronLeft size={28} color="transparent" />
                    </View>
                }
            />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Core Frameworks</Text>
                    <View style={styles.divider} />
                    
                    <Text style={styles.itemName}>React & React Native</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        Copyright (c) Meta Platforms, Inc. and affiliates.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>Expo</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        Copyright (c) 2015-present 650 Industries, Inc. (dba Expo)
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Data & Algorithm</Text>
                    <View style={styles.divider} />
                    
                    <Text style={styles.itemName}>OP-SQLite</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        High performance React Native SQLite library. Copyright (c) 2021 Oscar Franco.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>ts-fsrs</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        Free Spaced Repetition Scheduler (FSRS) implementation. Copyright (c) 2023 open-spaced-repetition.
                    </Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>UI & Animation</Text>
                    <View style={styles.divider} />

                    <Text style={styles.itemName}>React Native Reanimated</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        Copyright (c) 2020 Software Mansion
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>Lucide React Native</Text>
                    <Text style={styles.licenseText}>ISC License</Text>
                    <Text style={styles.descriptionText}>
                        Beautiful & consistent icons. Copyright (c) 2022 Lucide Contributors.
                    </Text>

                    <View style={styles.innerDivider} />

                    <Text style={styles.itemName}>React Native SVG</Text>
                    <Text style={styles.licenseText}>MIT License</Text>
                    <Text style={styles.descriptionText}>
                        SVG library for React Native. Copyright (c) 2015 Horcrux.
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
        paddingTop: 24,
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
