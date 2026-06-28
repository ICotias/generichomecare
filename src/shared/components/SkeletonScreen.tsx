import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, fontSize } from '../../core/theme/theme';

interface SkeletonScreenProps {
  title: string;
  subtitle?: string;
}

/**
 * Placeholder genérico para telas ainda não implementadas.
 * Usado durante a Fase 1 (esqueletos) e removido quando a feature real entra.
 */
export const SkeletonScreen = ({ title, subtitle }: SkeletonScreenProps) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.placeholder}>
        <View style={styles.block} />
        <View style={[styles.block, styles.blockMedium]} />
        <View style={[styles.block, styles.blockShort]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.35,
  },
  subtitle: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  placeholder: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  block: {
    height: 64,
    backgroundColor: colors.border,
    borderRadius: 12,
    opacity: 0.4,
  },
  blockMedium: {
    width: '75%',
  },
  blockShort: {
    width: '50%',
  },
});
