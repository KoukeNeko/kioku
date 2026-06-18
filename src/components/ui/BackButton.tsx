import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/theme';

interface BackButtonProps {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  color?: string;
  size?: number;
}

export function BackButton({ onPress, style, color = Colors.dark.textSecondary, size = 24 }: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/');
      }
    }
  };

  return (
    <TouchableOpacity onPress={handlePress} style={[styles.backBtn, style]} activeOpacity={0.7}>
      <ChevronLeft size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1C1D22',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
