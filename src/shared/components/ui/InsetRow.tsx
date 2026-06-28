import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize } from '../../../core/theme/theme';

interface InsetRowProps {
  label: string;
  value?: string;
  placeholder?: string;
  onPress?: () => void;
  /** Show chevron on the right (drill-down indicator) */
  chevron?: boolean;
  /** Accent color for the value text */
  valueColor?: string;
  /** Show as last row (no bottom border) */
  last?: boolean;
  /** Custom right-side content instead of value text */
  rightContent?: React.ReactNode;
}

/**
 * Apple-style inset row: label left, value right, optional chevron.
 * Used inside InsetGroupedSection.
 */
export const InsetRow = ({
  label,
  value,
  placeholder,
  onPress,
  chevron,
  valueColor,
  last,
  rightContent,
}: InsetRowProps) => {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {rightContent ?? (
          <Text
            style={[
              styles.value,
              !value && styles.placeholder,
              valueColor ? { color: valueColor } : undefined,
            ]}
            numberOfLines={1}
          >
            {value || placeholder || ''}
          </Text>
        )}
        {chevron && (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={colors.textMuted}
            style={styles.chevron}
          />
        )}
      </View>
    </View>
  );

  if (onPress || rightContent) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={onPress ? 0.6 : 1}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    maxWidth: '55%',
  },
  value: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  placeholder: {
    color: colors.textMuted,
  },
  chevron: {
    marginLeft: 4,
  },
});
