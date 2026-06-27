import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { colors, spacing, fontSize } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as adminUserService from '../../../core/services/adminUserService';
import { MOCK_PATIENTS } from '../../../core/mocks/patients';
import type { Patient } from '../../../core/types';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal } from '../../../shared/components/ui/SelectionListModal';
import type { SelectionItem } from '../../../shared/components/ui/SelectionListModal';

type RouteType = RouteProp<{ LinkFamily: { patientId?: string } }, 'LinkFamily'>;

const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const mapFirebaseError = (error: unknown): string => {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Já existe uma conta com este e-mail';
    case 'auth/invalid-email':
      return 'E-mail inválido';
    case 'auth/weak-password':
      return 'Senha muito fraca';
    case 'auth/network-request-failed':
      return 'Falha de rede. Verifique sua conexão';
    default:
      return (error instanceof Error ? error.message : '') || 'Erro desconhecido ao vincular família';
  }
};

const PARENTESCO_OPTIONS: SelectionItem[] = [
  { id: 'filho', label: 'Filho(a)' },
  { id: 'conjuge', label: 'Cônjuge' },
  { id: 'neto', label: 'Neto(a)' },
  { id: 'irmao', label: 'Irmão(ã)' },
  { id: 'sobrinho', label: 'Sobrinho(a)' },
  { id: 'cuidador', label: 'Cuidador(a)' },
  { id: 'outro', label: 'Outro' },
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
  const [showPatientList, setShowPatientList] = useState(false);
  const [showParentescoList, setShowParentescoList] = useState(false);

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
  const selectedParentescoItem = PARENTESCO_OPTIONS.find((o) => o.label === parentesco);

  // Patient items for SelectionListModal
  const patientItems: SelectionItem[] = patients
    .filter((p) => p.status === 'ativo')
    .map((p) => ({ id: p.id, label: p.nome }));

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
      Alert.alert('Erro ao vincular', mapFirebaseError(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={{ paddingTop: insets.top }}>
        <ModalHeader
          title="Vincular Família"
          onCancel={() => navigation.goBack()}
          onDone={handleSave}
          doneLabel="Vincular"
          doneDisabled={!canSave}
          isLoading={isSaving}
          accentColor={colors.admin}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Patient selector — drill-down row */}
        <InsetGroupedSection header="PACIENTE">
          {isLoadingPatients ? (
            <ActivityIndicator color={colors.admin} style={styles.loader} />
          ) : (
            <InsetRow
              label="Paciente"
              value={selectedPatient ? selectedPatient.nome : 'Selecionar'}
              valueColor={selectedPatient ? colors.textPrimary : colors.textMuted}
              onPress={() => setShowPatientList(true)}
              last
            />
          )}
        </InsetGroupedSection>

        {/* Form fields — Inset Grouped */}
        <InsetGroupedSection header="DADOS DO FAMILIAR">
          <InsetRow
            label="Nome"
            rightContent={
              <TextInput
                style={styles.inlineInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={colors.textMuted}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            }
          />
          <InsetRow
            label="E-mail"
            rightContent={
              <TextInput
                ref={emailRef}
                style={styles.inlineInput}
                value={email}
                onChangeText={setEmail}
                placeholder="email@exemplo.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="next"
                onSubmitEditing={() => telRef.current?.focus()}
              />
            }
          />
          <InsetRow
            label="Telefone"
            rightContent={
              <TextInput
                ref={telRef}
                style={styles.inlineInput}
                value={telefone}
                onChangeText={(v) => setTelefone(formatPhone(v))}
                placeholder="(11) 99999-9999"
                placeholderTextColor={colors.textMuted}
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => senhaRef.current?.focus()}
              />
            }
          />
          <InsetRow
            label="Senha"
            rightContent={
              <TextInput
                ref={senhaRef}
                style={styles.inlineInput}
                value={senha}
                onChangeText={setSenha}
                placeholder="Mín. 8 caracteres"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            }
            last
          />
        </InsetGroupedSection>

        {/* Parentesco — drill-down row */}
        <InsetGroupedSection header="PARENTESCO">
          <InsetRow
            label="Parentesco"
            value={parentesco || 'Selecionar'}
            valueColor={parentesco ? colors.textPrimary : colors.textMuted}
            onPress={() => setShowParentescoList(true)}
            last
          />
        </InsetGroupedSection>
      </ScrollView>

      {/* Selection modals */}
      <SelectionListModal
        visible={showPatientList}
        title="Selecionar Paciente"
        items={patientItems}
        selectedId={selectedPatientId}
        onSelect={(item) => {
          setSelectedPatientId(item.id);
          setShowPatientList(false);
        }}
        onClose={() => setShowPatientList(false)}
        accentColor={colors.admin}
      />

      <SelectionListModal
        visible={showParentescoList}
        title="Parentesco"
        items={PARENTESCO_OPTIONS}
        selectedId={selectedParentescoItem?.id ?? null}
        onSelect={(item) => {
          setParentesco(item.label);
          setShowParentescoList(false);
        }}
        onClose={() => setShowParentescoList(false)}
        accentColor={colors.admin}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  loader: { marginVertical: spacing.md },
  inlineInput: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'right',
    paddingVertical: 0,
  },
});
