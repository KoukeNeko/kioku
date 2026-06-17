import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Fonts } from '../../constants/theme';

export interface FuriganaChunk {
    ruby: string;
    rt?: string;
}

interface FuriganaTextProps {
    chunks: FuriganaChunk[];
    fontSize?: number;
    color?: string;
    align?: 'center' | 'flex-start'; // 單字置中；例句等長文字靠左
}

export const FuriganaText: React.FC<FuriganaTextProps> = ({
    chunks,
    fontSize = 32,
    color = Colors.dark.text,
    align = 'center'
}) => {
    const rubySize = fontSize * 0.45; // Furigana is usually around 40-50% of base size

    return (
        <View style={[styles.container, { justifyContent: align }]}>
            {chunks.map((chunk, index) => (
                <View key={index} style={styles.chunk}>
                    {/* The reading (Furigana) */}
                    <Text 
                        style={[
                            styles.rt, 
                            { 
                                fontSize: rubySize, 
                                color: color,
                                // If no reading, we keep the space to maintain baseline alignment
                                opacity: chunk.rt ? 1 : 0,
                                marginBottom: -(fontSize * 0.15) // Use negative margin to pull it closer to the kanji
                            }
                        ]}
                        allowFontScaling={false}
                    >
                        {chunk.rt || ' '}
                    </Text>
                    {/* The base text (Kanji) */}
                    <Text 
                        style={[
                            styles.ruby, 
                            { fontSize: fontSize, color: color }
                        ]}
                        allowFontScaling={false}
                    >
                        {chunk.ruby}
                    </Text>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'flex-end', // Align baseline of Kanji
        justifyContent: 'center',
        flexWrap: 'wrap',
    },
    chunk: {
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginHorizontal: 1, // Slight spacing between words if needed
    },
    rt: {
        fontFamily: Fonts?.serif,
        textAlign: 'center',
    },
    ruby: {
        fontFamily: Fonts?.serifBold,
        textAlign: 'center',
    }
});
