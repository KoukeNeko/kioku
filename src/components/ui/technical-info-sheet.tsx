import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2 } from 'lucide-react-native';
import { BORDER_RADIUS, Colors, Fonts, Spacing } from '../../constants/theme';

export interface TechnicalInfoRow {
  label: string;
  value: string;
  audioEntryId?: string;
}

export interface TechnicalInfoSection {
  title: string;
  rows: TechnicalInfoRow[];
}

interface TechnicalInfoSheetProps {
  modalRef: React.RefObject<BottomSheetModal | null>;
  sections: TechnicalInfoSection[];
  title?: string;
  onRegenerateAudio?: (entryId: string) => Promise<void>;
}

export function TechnicalInfoSheet({
  modalRef,
  sections,
  title = '技術情報',
  onRegenerateAudio,
}: TechnicalInfoSheetProps) {
  const insets = useSafeAreaInsets();
  const [regeneratingEntryId, setRegeneratingEntryId] = useState<string | null>(null);

  const regenerate = async (entryId: string) => {
    if (!onRegenerateAudio || regeneratingEntryId) return;
    setRegeneratingEntryId(entryId);
    try {
      await onRegenerateAudio(entryId);
      Alert.alert('音声を再生成', `${entryId} を削除し、再生成を開始しました。`);
    } catch (error) {
      Alert.alert(
        '音声を再生成できませんでした',
        error instanceof Error ? error.message : '不明なエラーが発生しました。',
      );
    } finally {
      setRegeneratingEntryId(null);
    }
  };

  const confirmRegeneration = (entryId: string) => {
    Alert.alert(
      '音声ファイルを削除',
      `${entryId} の Server 音声と端末キャッシュを削除して再生成します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除して再生成',
          style: 'destructive',
          onPress: () => void regenerate(entryId),
        },
      ],
    );
  };

  return (
    <BottomSheetModal
      ref={modalRef}
      index={0}
      snapPoints={['55%', '85%']}
      enablePanDownToClose
      backdropComponent={(props) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.6}
        />
      )}
      backgroundStyle={styles.background}
      handleIndicatorStyle={styles.handle}
    >
      <View style={styles.header}>
        <Text style={styles.title} selectable>{title}</Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="技術情報を閉じる"
          onPress={() => modalRef.current?.dismiss()}
          style={styles.closeButton}
        >
          <Text style={styles.closeText}>閉じる</Text>
        </TouchableOpacity>
      </View>

      <BottomSheetScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}
        showsVerticalScrollIndicator
      >
        {sections.filter((section) => section.rows.length > 0).map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle} selectable>{section.title}</Text>
            <View style={styles.card}>
              {section.rows.map((row, index) => (
                <View
                  key={`${row.label}-${index}`}
                  style={[styles.row, index > 0 && styles.rowBorder]}
                >
                  <Text style={styles.label} selectable>{row.label}</Text>
                  <Text style={styles.value} selectable>{row.value}</Text>
                  {row.audioEntryId && onRegenerateAudio && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel={`${row.audioEntryId} の音声を削除して再生成`}
                      activeOpacity={0.7}
                      disabled={regeneratingEntryId !== null}
                      onPress={() => confirmRegeneration(row.audioEntryId!)}
                      style={[
                        styles.regenerateButton,
                        regeneratingEntryId !== null && styles.regenerateButtonDisabled,
                      ]}
                    >
                      <Trash2 size={15} color="#FF6B6B" />
                      <Text style={styles.regenerateButtonText}>
                        {regeneratingEntryId === row.audioEntryId ? '処理中…' : '削除して再生成'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#16171B',
  },
  handle: {
    backgroundColor: '#555861',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.three,
  },
  title: {
    color: Colors.dark.text,
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  closeText: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
  content: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionTitle: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    letterSpacing: 1.5,
  },
  card: {
    backgroundColor: '#111216',
    borderWidth: 1,
    borderColor: '#2E3135',
    borderRadius: BORDER_RADIUS.lg,
    overflow: 'hidden',
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.one,
  },
  rowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#2E3135',
  },
  label: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
  },
  value: {
    color: Colors.dark.text,
    fontSize: 14,
    fontFamily: Fonts?.mono,
    lineHeight: 20,
  },
  regenerateButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
    borderRadius: BORDER_RADIUS.md,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  regenerateButtonDisabled: {
    opacity: 0.45,
  },
  regenerateButtonText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
});
