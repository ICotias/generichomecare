import { Text, StyleSheet } from 'react-native';
import { colors, spacing, fontSize } from '../../../core/theme/theme';

interface SectionLabelProps {
  children: string;
}

export const SectionLabel = ({ children }: SectionLabelProps) => (
  <Text style={styles.label}>{children}</Text>
);

const styles = StyleSheet.create({
  label: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase' as const,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
});
