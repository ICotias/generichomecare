/**
 * Barra de seleção de paciente — aparece apenas quando admin simula role family.
 * Scroll horizontal de pacientes ativos para trocar o contexto rapidamente.
 */
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import type { Patient } from '../../core/types';

interface PatientPickerBarProps {
  patients: Patient[];
  selectedId: string | undefined;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}

export const PatientPickerBar = ({
  patients,
  selectedId,
  onSelect,
  isLoading,
}: PatientPickerBarProps) => {
  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color={colors.admin} />
      </View>
    );
  }

  if (patients.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Ionicons name="eye-outline" size={14} color={colors.admin} />
        <Text style={styles.label}>Simulando. Paciente:</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {patients.map((p) => {
          const isActive = p.id === selectedId;
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.chip, isActive && styles.chipActive]}
              onPress={() => onSelect(p.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, isActive && styles.chipTextActive]}>
                {p.nome}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.admin + '0D',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.admin + '33',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.admin,
  },
  scrollContent: {
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.admin,
    borderColor: colors.admin,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipTextActive: {
    color: colors.white,
  },
});
