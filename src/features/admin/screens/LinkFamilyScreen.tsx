import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as adminUserService from '../../../core/services/adminUserService';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import type { Patient } from '../../../core/types';

type RouteType = RouteProp<{ LinkFamily: { patientId?: string } }, 'LinkFamily'>;

const PARENTESCO_OPTIONS = [
  'Filho(a)',
  'Cônjuge',
  'Neto(a)',
  'Irmão(ã)',
  'Sobrinho(a)',
  'Cuidador(a)',
  'Outro',
];

export const LinkFamilyScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<RouteType>();
  const { user } = useAuthStore();

  const initialPatientId = route.params?.patientId;

  // Form state
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [senha, setSenha] = useState('');
  const [parentesco, setParentesco] = useState('');

  // Patient selection
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(initialPatientId ?? null);
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);

  const [isSaving, setIsSaving] = useState(false);

  // Refs
  const emailRef = useRef<TextInput>(null);
  const telRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);

  // Load patients
  useEffect(() => {
    if (!user?.empresaId) return;
    patientService
      .listPatients(user.empresaId)
      .then((list) => setPatients(list.length > 0 ? list : MOCK_PATIENTS))
      .catch(() => setPatients(MOCK_PATIENTS))
      .finally(() => setIsLoadingPatients(false));
  }, [user?.empresaId]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Validation
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSave =
    nome.trim().length > 0 &&
    emailValid &&
    senha.length >= 8 &&
    parentesco.length > 0 &&
    selectedPatientId != null;

  const handleSave = async () => {
    if (!canSave || !user?.empresaId || !selectedPatientId) return;

    setIsSaving(true);
    try {
      const result = await adminUserService.createFamilyAccount({
        email: email.trim(),
        password: senha,
        nome: nome.trim(),
        telefone: telefone.trim(),
        empresaId: user.empresaId,
        pacienteId: selectedPatientId,
        parentesco,
      });

      Alert.alert(
        'Família vinculada',
        `Conta criada para ${nome.trim()}.\nUID: ${result.uid}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      Alert.alert('Erro ao vincular', msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.headerBar, { paddingTop: insets.top + spacing.sm }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={styles.cancelBtn}>Cancelar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vincular Família</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient selector */}
        <Text style={styles.sectionLabel}>PACIENTE</Text>
        {isLoadingPatients ? (
          <ActivityIndicator color={colors.admin} style={styles.loader} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              {patients.filter((p) => p.status === 'ativo').map((p) => {
                const active = selectedPatientId === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.patientChip, active && styles.patientChipActive]}
                    onPress={() => setSelectedPatientId(p.id)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.patientChipText, active && styles.patientChipTextActive]}>
                      {p.nome.split(' ').slice(0, 2).join(' ')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
        {selectedPatient && (
          <Text style={styles.selectedHint}>Vinculando ao paciente: {selectedPatient.nome}</Text>
        )}

        {/* Form fields */}
        <Text style={styles.sectionLabel}>DADOS DO FAMILIAR</Text>

        <Text style={styles.fieldLabel}>Nome completo</Text>
        <TextInput
          style={styles.input}
          value={nome}
          onChangeText={setNome}
          placeholder="Nome do familiar"
          placeholderTextColor={colors.textMuted}
          returnKeyType="next"
          onSubmitEditing={() => emailRef.current?.focus()}
        />

        <Text style={styles.fieldLabel}>E-mail</Text>
        <TextInput
          ref={emailRef}
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="email@exemplo.com"
          placeholderTextColor={colors.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => telRef.current?.focus()}
        />

        <Text style={styles.fieldLabel}>Telefone</Text>
        <TextInput
          ref={telRef}
          style={styles.input}
          value={telefone}
          onChangeText={setTelefone}
          placeholder="(11) 99999-9999"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          returnKeyType="next"
          onSubmitEditing={() => senhaRef.current?.focus()}
        />

        <Text style={styles.fieldLabel}>Senha (mín. 8 caracteres)</Text>
        <TextInput
          ref={senhaRef}
          style={styles.input}
          value={senha}
          onChangeText={setSenha}
          placeholder="Senha de acesso"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />

        {/* Parentesco */}
        <Text style={styles.sectionLabel}>PARENTESCO</Text>
        <View style={styles.chipRowWrap}>
          {PARENTESCO_OPTIONS.map((opt) => {
            const active = parentesco === opt;
            return (
              <TouchableOpacity
                key={opt}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setParentesco(opt)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Save button */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || isSaving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={!canSave || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.saveBtnText}>Vincular Família</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancelBtn: { fontSize: fontSize.md, color: colors.admin, fontWeight: '600' },
  headerTitle: { fontSize: fontSize.lg, fontWeight: '700', color: colors.textPrimary },
  headerRight: { width: 60 },

  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  loader: { marginVertical: spacing.md },

  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },

  chipRow: { flexDirection: 'row', gap: spacing.sm },
  patientChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  patientChipActive: { borderColor: colors.admin, backgroundColor: colors.admin + '1A' },
  patientChipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  patientChipTextActive: { color: colors.admin, fontWeight: '700' },
  selectedHint: { fontSize: fontSize.xs, color: colors.admin, fontWeight: '500', marginTop: spacing.xs },

  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.select({ ios: 14, android: 10 }),
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },

  chipRowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.admin, borderColor: colors.admin },
  chipText: { fontSize: fontSize.sm, fontWeight: '500', color: colors.textPrimary },
  chipTextActive: { color: colors.white },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.admin,
    borderRadius: borderRadius.full,
    paddingVertical: spacing.md,
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { fontSize: fontSize.md, fontWeight: '700', color: colors.white },
});
