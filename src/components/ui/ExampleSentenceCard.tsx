import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { Volume2 } from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { FuriganaText } from './FuriganaText';
import { Colors, Spacing, BORDER_RADIUS, Fonts } from '../../constants/theme';

interface ExampleSentenceCardProps {
    example: {
        jp: string;
        en: string;
        furigana: any[];
    };
    style?: StyleProp<ViewStyle>;
    onPress?: () => void;
}

const speakJapanese = (text: string) => {
    Speech.speak(text, { language: 'ja-JP', rate: 0.9 });
};

export const ExampleSentenceCard: React.FC<ExampleSentenceCardProps> = ({ example, style, onPress }) => {
    const Container = onPress ? TouchableOpacity : View;
    return (
        <Container 
            style={[styles.sentenceContainer, style]} 
            onPress={onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View style={styles.sentenceTopRow}>
                <View style={styles.sentenceTextWrap}>
                    <FuriganaText chunks={example.furigana} fontSize={20} align="flex-start" />
                </View>
                <TouchableOpacity style={styles.speakerButton} onPress={() => speakJapanese(example.jp)}>
                    <Volume2 size={20} color={Colors.dark.primaryOrange} />
                </TouchableOpacity>
            </View>
            <Text style={styles.sentenceEnglish}>{example.en}</Text>
        </Container>
    );
};

const styles = StyleSheet.create({
    sentenceContainer: {
        padding: Spacing.three,
        backgroundColor: '#16171B',
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
    sentenceTextWrap: {
        flex: 1,
        marginRight: Spacing.two,
    },
    speakerButton: {
        padding: 4,
    },
    sentenceEnglish: {
        color: Colors.dark.textSecondary,
        fontSize: 14,
        fontFamily: Fonts?.lineSeed,
    },
});
