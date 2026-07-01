import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import * as adminUserService from '../../../core/services/adminUserService';
import type { FamilyMember } from '../../../core/services/adminUserService';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';
import type { Patient } from '../../../core/types';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'CreatePatient'>;

const GENERO_OPTIONS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'feminino', label: 'Feminino' },
  { key: 'outro', label: 'Outro' },
];

const formatDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const CreatePatientScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  // Dados pessoais (o mínimo que o admin preenche)
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [genero, setGenero] = useState<Patient['genero']>('masculino');

  // Vínculo com uma família já cadastrada (sem paciente)
  const [families, setFamilies] = useState<FamilyMember[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [selectedFamily, setSelectedFamily] = useState<FamilyMember | null>(null);
  const [showFamilyList, setShowFamilyList] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.empresaId) {
        setLoadingFamilies(false);
        return;
      }
      setLoadingFamilies(true);
      adminUserService
        .listUnlinkedFamily(user.empresaId)
        .then(setFamilies)
        .catch((e) => {
          console.error('listUnlinkedFamily error', e);
          setFamilies([]);
        })
        .finally(() => setLoadingFamilies(false));
    }, [user?.empresaId])
  );

  const canSave = nome.trim().length > 1 && dataNascimento != null && !!selectedFamily;

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!user?.empresaId || !user?.uid || !dataNascimento || !selectedFamily) return;
    setIsSubmitting(true);
    try {
      const pid = await patientService.createPatientStub(user.empresaId, user.uid, {
        nome: nome.trim(),
        dataNascimento,
        genero,
      });
      await adminUserService.linkExistingFamily(
        selectedFamily.uid,
        pid,
        selectedFamily.parentesco ?? ''
      );
      Alert.alert(
        'Paciente criado',
        `${nome.trim()} foi criado e vinculado a ${selectedFamily.nome}. O familiar vai completar os dados clínicos pelo app.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (e) {
      console.error('createPatientStub error', e);
      Alert.alert('Erro', 'Não foi possível criar o paciente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const familyItems: SelectionItem[] = families.map((f) => ({
    id: f.uid,
    label: f.nome + (f.email ? '  ·  ' + f.email : ''),
  }));

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top }}>
        <ModalHeader
          title="Novo Paciente"
          onCancel={() => navigation.goBack()}
          onDone={handleSubmit}
          doneLabel="Criar"
          doneDisabled={!canSave}
          isLoading={isSubmitting}
          accentColor={colors.admin}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Informe os dados pessoais e vincule a um familiar já cadastrado. O familiar completa as
          informações clínicas (condições, sinais vitais, medicações) pelo app.
        </Text>

        <InsetGroupedSection header="DADOS PESSOAIS">
          <InsetRow
            label="Nome"
            rightContent={
              <TextInput
                style={styles.inlineInput}
                value={nome}
                onChangeText={setNome}
                placeholder="Nome completo"
                placeholderTextColor={colors.textMuted}
              />
            }
          />
          <InsetRow
            label="Nascimento"
            value={dataNascimento ? formatDate(dataNascimento) : 'Selecionar'}
            valueColor={dataNascimento ? colors.textPrimary : colors.textMuted}
            onPress={() => setShowDatePicker((s) => !s)}
            chevron
            last
          />
        </InsetGroupedSection>

        {showDatePicker && (
          <View style={styles.pickerWrap}>
            <DateTimePicker
              value={dataNascimento ?? new Date(1950, 0, 1)}
              mode="date"
              display="spinner"
              maximumDate={new Date()}
              onChange={(_, d) => {
                if (d) setDataNascimento(d);
                if (Platform.OS === 'android') setShowDatePicker(false);
              }}
            />
          </View>
        )}

        <Text style={styles.sectionLabel}>GÊNERO</Text>
        <SegmentedControl
          options={GENERO_OPTIONS}
          selectedKey={genero}
          onSelect={(k) => setGenero(k as Patient['genero'])}
          accentColor={colors.admin}
        />

        <Text style={styles.sectionLabel}>FAMILIAR RESPONSÁVEL</Text>
        {loadingFamilies ? (
          <ActivityIndicator color={colors.admin} style={styles.loader} />
        ) : families.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nenhuma família disponível</Text>
            <Text style={styles.emptyText}>
              É preciso ter uma conta de família (ainda sem paciente) para vincular. Convide a
              família primeiro.
            </Text>
            <TouchableOpacity
              style={styles.inviteBtn}
              onPress={() => navigation.navigate('InviteFamily')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={18} color={colors.primary} />
              <Text style={styles.inviteBtnText}>Convidar família</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <InsetGroupedSection>
            <InsetRow
              label="Familiar"
              value={selectedFamily ? selectedFamily.nome : 'Selecionar'}
              valueColor={selectedFamily ? colors.textPrimary : colors.textMuted}
              onPress={() => setShowFamilyList(true)}
              chevron
              last
            />
          </InsetGroupedSection>
        )}
      </ScrollView>

      <SelectionListModal
        visible={showFamilyList}
        title="Vincular ao familiar"
        items={familyItems}
        selectedId={selectedFamily?.uid ?? null}
        onSelect={(item) => {
          setSelectedFamily(families.find((f) => f.uid === item.id) ?? null);
          setShowFamilyList(false);
        }}
        onClose={() => setShowFamilyList(false)}
        accentColor={colors.admin}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  intro: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  inlineInput: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'right', paddingVertical: 0 },
  pickerWrap: { backgroundColor: colors.surface, borderRadius: borderRadius.md, marginTop: spacing.sm },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loader: { marginVertical: spacing.lg },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: fontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary + '14',
    borderWidth: 1,
    borderColor: colors.primary + '33',
  },
  inviteBtnText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
});
