import { View, Text, StyleSheet, TouchableOpacity, Modal, FlatList } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { Patient } from '../../../core/types';

interface PatientDropdownProps {
  patients: Patient[];
  selected: Patient | null;
  onSelect: (patient: Patient) => void;
  label?: string;
}

export const PatientDropdown = ({
  patients,
  selected,
  onSelect,
  label = 'Paciente',
}: PatientDropdownProps) => {
  const [open, setOpen] = useState(false);

  const activePatients = patients.filter((p) => p.status === 'ativo');

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Text style={[styles.dropdownText, !selected && styles.placeholder]}>
          {selected?.nome ?? 'Selecionar paciente'}
        </Text>
        <Ionicons name="chevron-expand-outline" size={20} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Selecionar Paciente</Text>
            <FlatList
              data={activePatients}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.option,
                    selected?.id === item.id && styles.optionActive,
                  ]}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.nome.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.optionInfo}>
                    <Text style={styles.optionName}>{item.nome}</Text>
                    {item.dataNascimento ? (
                      <Text style={styles.optionAge}>
                        {Math.floor((Date.now() - item.dataNascimento.getTime()) / (365.25 * 24 * 60 * 60 * 1000))} anos
                      </Text>
                    ) : null}
                  </View>
                  {selected?.id === item.id && (
                    <Ionicons name="checkmark" size={22} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs + 2,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    minHeight: 48,
  },
  dropdownText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  placeholder: {
    color: colors.textMuted,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  modal: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    maxHeight: '60%',
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: 2,
  },
  optionActive: {
    backgroundColor: colors.primary + '10',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '1A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm + 4,
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: '700',
    color: colors.primary,
  },
  optionInfo: {
    flex: 1,
  },
  optionName: {
    fontSize: fontSize.md,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  optionAge: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: 1,
  },
});
