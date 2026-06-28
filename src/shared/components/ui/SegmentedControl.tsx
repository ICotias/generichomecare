import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

interface SegmentedControlOption {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  options: SegmentedControlOption[];
  selectedKey: string;
  onSelect: (key: string) => void;
  /** Accent color for the selected segment. Defaults to colors.primary */
  accentColor?: string;
}

/**
 * Apple-style segmented control for 2–4 mutually exclusive options.
 * Use instead of chips for small fixed option sets in forms.
 */
export const SegmentedControl = ({
  options,
  selectedKey,
  onSelect,
  accentColor = colors.primary,
}: SegmentedControlProps) => (
  <View style={styles.track}>
    {options.map((opt) => {
      const active = opt.key === selectedKey;
      return (
        <TouchableOpacity
          key={opt.key}
          style={[styles.segment, active && [styles.segmentActive, { backgroundColor: accentColor }]]}
          onPress={() => onSelect(opt.key)}
          activeOpacity={0.7}
        >
          <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.border + '60',
    borderRadius: borderRadius.md,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: Platform.select({ ios: 8, android: 7 }),
    alignItems: 'center',
    borderRadius: borderRadius.md - 1,
  },
  segmentActive: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  segmentText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  segmentTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
});
