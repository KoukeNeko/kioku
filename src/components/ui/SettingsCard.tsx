import React, { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ViewStyle } from 'react-native';
import { Colors, BORDER_RADIUS } from '../../constants/theme';
import { ChevronRight } from 'lucide-react-native';

interface SettingsCardProps {
  children: ReactNode;
  style?: ViewStyle;
}

export function SettingsCard({ children, style }: SettingsCardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SettingsDivider() {
  return <View style={styles.divider} />;
}

interface SettingsRowProps {
  label: string;
  subLabel?: string;
  valueText?: string;
  valueColor?: string;
  onPress?: () => void;
  showChevron?: boolean;
  children?: ReactNode;
  paddingVertical?: number;
  icon?: ReactNode; // For profile menu left icon
  centeredContent?: ReactNode; // For centered items like logout
}

export function SettingsRow({ 
  label, 
  subLabel, 
  valueText, 
  valueColor,
  onPress, 
  showChevron, 
  children, 
  paddingVertical = 14,
  icon,
  centeredContent
}: SettingsRowProps) {
  
  if (centeredContent) {
    const inner = <View style={[styles.row, { paddingVertical, justifyContent: 'center' }]}>{centeredContent}</View>;
    return onPress ? <TouchableOpacity onPress={onPress}>{inner}</TouchableOpacity> : inner;
  }

  const inner = (
    <View style={[styles.row, { paddingVertical }]}>
      <View style={styles.rowLeft}>
        {icon && <View style={styles.iconWrapper}>{icon}</View>}
        <View>
          <Text style={styles.rowLabel}>{label}</Text>
          {subLabel && <Text style={styles.rowSubLabel}>{subLabel}</Text>}
        </View>
      </View>
      <View style={styles.rowRight}>
        {children}
        {valueText !== undefined && (
          <Text style={[styles.rowValue, valueColor ? { color: valueColor } : undefined]}>
            {valueText}
          </Text>
        )}
        {showChevron && <ChevronRight size={18} color={Colors.dark.textSecondary} style={styles.chevron} />}
      </View>
    </View>
  );

  if (onPress) {
    return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
  }
  return inner;
}

interface SettingsSwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
}

export function SettingsSwitchRow({ label, value, onValueChange }: SettingsSwitchRowProps) {
  return (
    <View style={[styles.row, { paddingVertical: 14 }]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: '#2E3135', true: Colors.dark.primaryOrange }}
        thumbColor={'#FFF'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#16171B',
    borderRadius: BORDER_RADIUS.xl,
    paddingHorizontal: 20,
    paddingVertical: 6, // Adding 6px so that rows with 14px padding result in 20px total visual padding
    borderWidth: 1,
    borderColor: '#2E3135',
    overflow: 'hidden',
    marginBottom: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#2E3135',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrapper: {
    marginRight: 12,
  },
  rowLabel: {
    color: Colors.dark.text,
    fontSize: 15,
  },
  rowSubLabel: {
    color: Colors.dark.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowValue: {
    color: Colors.dark.textSecondary,
    fontSize: 15,
  },
  chevron: {
    marginLeft: 0,
  },
});
