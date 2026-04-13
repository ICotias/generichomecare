import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../core/hooks/useAuth';
import { colors, fontSize, spacing } from '../../core/theme/theme';

/**
 * Banner que aparece no topo quando um admin está simulando outro perfil.
 * Toque para voltar ao painel admin.
 */
export const SimulationBanner = () => {
  const insets = useSafeAreaInsets();
  const { isSimulating, stopSimulation } = useAuthStore();

  if (!isSimulating) return null;

  return (
    <TouchableOpacity
      style={[styles.banner, { paddingTop: insets.top + spacing.xs }]}
      onPress={stopSimulation}
      activeOpacity={0.8}
    >
      <Text style={styles.text}>Simulando perfil — Voltar ao Admin</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.admin,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  text: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
