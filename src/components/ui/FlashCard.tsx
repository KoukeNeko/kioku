import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Colors, Spacing, BORDER_RADIUS } from '../../constants/theme';

interface FlashCardProps {
    frontContent: React.ReactNode;
    backContent?: React.ReactNode;
    isFlipped: boolean;
    onFlip: () => void;
}

export const FlashCard: React.FC<FlashCardProps> = ({ frontContent, backContent, isFlipped, onFlip }) => {
    return (
        <View style={styles.container}>
            {/* Main Card Content */}
            <View style={styles.card}>
                {isFlipped && backContent ? (
                    <View style={styles.back}>
                        {backContent}
                    </View>
                ) : (
                    <View style={styles.front}>
                        {frontContent}
                    </View>
                )}
            </View>

        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        width: '100%',
        justifyContent: 'space-between',
    },
    card: {
        flex: 1,
        width: '100%',
    },
    front: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    back: {
        flex: 1,
        width: '100%',
    },
    actionContainer: {
        paddingBottom: Spacing.four,
        width: '100%',
        alignItems: 'center',
    },
    flipButton: {
        backgroundColor: Colors.dark.backgroundElement,
        paddingVertical: 18,
        borderRadius: BORDER_RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        borderWidth: 1,
        borderColor: '#2E3135', // Slight border
    },
    flipButtonText: {
        color: Colors.dark.text,
        fontSize: 18,
        fontWeight: 'bold',
    },
    hintText: {
        color: Colors.dark.textSecondary,
        fontSize: 12,
        marginTop: Spacing.two,
    }
});
