import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';

interface InsetGroupedSectionProps {
  header?: string;
  children: React.ReactNode;
}

/**
 * Apple-style Inset Grouped section.
 * Wraps children in a rounded card with hairline separators.
 * Use InsetRow as children for the standard label–value layout.
 */
export const InsetGroupedSection = ({ header, children }: InsetGroupedSectionProps) => (
  <View style={styles.wrapper}>
    {header ? <Text style={styles.header}>{header}</Text> : null}
    <View style={styles.card}>{children}</View>
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  header: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginLeft: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
});
