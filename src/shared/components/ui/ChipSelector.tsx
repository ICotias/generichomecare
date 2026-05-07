import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

interface ChipSelectorProps<T extends string> {
  label?: string;
  options: readonly T[];
  selected: T | null;
  onSelect: (value: T) => void;
  /** Display label mapping — defaults to the value itself */
  displayLabel?: (value: T) => string;
}

export function ChipSelector<T extends string>({
  label,
  options,
  selected,
  onSelect,
  displayLabel,
}: ChipSelectorProps<T>) {
  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.chipRow}>
        {options.map((option) => {
          const isActive = selected === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(option)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {displayLabel ? displayLabel(option) : option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.chipBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.chipActiveBg,
    borderColor: colors.chipActiveBg,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.chipText,
  },
  chipTextActive: {
    color: colors.chipActiveText,
  },
});
