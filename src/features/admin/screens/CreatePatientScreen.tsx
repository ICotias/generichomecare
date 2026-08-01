import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import type { PatientMgmtStackParamList } from '../../../core/navigation/RootNavigator';
import type { Patient } from '../../../core/types';
import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SegmentedControl } from '../../../shared/components/ui/SegmentedControl';

type NavProp = NativeStackNavigationProp<PatientMgmtStackParamList, 'CreatePatient'>;

const GENERO_OPTIONS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'feminino', label: 'Feminino' },
  { key: 'outro', label: 'Outro' },
];

const formatDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/**
 * Cadastro do paciente pelo admin. Só dados pessoais: os dados clínicos vêm
 * logo em seguida, no assistente (rota CompletePatient).
 *
 * A família NÃO é pedida aqui de propósito. Ela virou espectadora no modo
 * empresa, então exigir a conta dela antes do paciente existir era um bloqueio
 * sem razão de ser. Vincular ou convidar a família é ação da ficha do paciente.
 */
export const CreatePatientScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const { user } = useAuthStore();

  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [genero, setGenero] = useState<Patient['genero']>('masculino');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSave = nome.trim().length > 1 && dataNascimento != null;

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!user?.empresaId || !user?.uid || !dataNascimento) return;
    setIsSubmitting(true);
    try {
      const pid = await patientService.createPatientStub(user.empresaId, user.uid, {
        nome: nome.trim(),
        dataNascimento,
        genero,
      });
      navigation.replace('CompletePatient', { patientId: pid });
    } catch (e) {
      console.error('createPatientStub error', e);
      Alert.alert('Erro', 'Não foi possível criar o paciente. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

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
          Informe os dados pessoais. Na próxima etapa você completa as informações clínicas
          (condições, sinais vitais, medicações). O acesso da família pode ser criado depois, na
          ficha do paciente.
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
      </ScrollView>
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
});
