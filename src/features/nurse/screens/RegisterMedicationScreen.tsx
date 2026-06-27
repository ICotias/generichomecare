import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import { usePatientWithActiveShift } from '../../../core/hooks/usePatientWithActiveShift';
import * as registroService from '../../../core/services/registroService';
import type { Patient } from '../../../core/types';

import { ModalHeader } from '../../../shared/components/ui/ModalHeader';
import { InsetGroupedSection } from '../../../shared/components/ui/InsetGroupedSection';
import { InsetRow } from '../../../shared/components/ui/InsetRow';
import { SelectionListModal, type SelectionItem } from '../../../shared/components/ui/SelectionListModal';

const VIA_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'topica', label: 'Tópica' },
  { value: 'intramuscular', label: 'IM' },
  { value: 'subcutanea', label: 'SC' },
  { value: 'intravenosa', label: 'IV' },
  { value: 'retal', label: 'Retal' },
  { value: 'inalatoria', label: 'Inalatória' },
] as const;

const VIA_SELECTION_ITEMS: SelectionItem[] = VIA_OPTIONS.map((opt) => ({
  id: opt.value,
  label: opt.label,
}));

const formatTime = (date: Date): string => {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
};

export const RegisterMedicationScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  // Patient selector (pré-seleciona paciente do plantão ativo)
  const { patients, selectedPatient, setSelectedPatient } = usePatientWithActiveShift(user?.empresaId, user?.uid);


  // Form
  const [medicamento, setMedicamento] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [horario, setHorario] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [via, setVia] = useState('');
  const [showViaPicker, setShowViaPicker] = useState(false);
  const [observacoes, setObservacoes] = useState('');
  const [recusado, setRecusado] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!selectedPatient) e.paciente = 'Selecione o paciente';
    if (!medicamento.trim()) e.medicamento = 'Informe o medicamento';
    if (!dosagem.trim()) e.dosagem = 'Informe a dosagem';
    if (!via) e.via = 'Selecione a via';
    setErrors(e);
    if (Object.keys(e).length > 0) {
      Alert.alert(e.paciente ? 'Sem paciente' : 'Campos obrigatórios',
        e.paciente ? 'Inicie um plantão antes de registrar.' : 'Preencha todos os campos antes de salvar.');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    if (!validate()) return;
    if (!user?.empresaId || !user?.uid) return;

    setIsSubmitting(true);
    try {
      await registroService.createRecord(user.empresaId, selectedPatient!.id, {
        type: 'medicamento',
        pacienteId: selectedPatient!.id,
        empresaId: user.empresaId,
        profissionalId: user.uid,
        profissionalNome: user.nome,
        medicamento: medicamento.trim(),
        dosagem: dosagem.trim(),
        via,
        prescricaoId: '',
        recusado,
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
      });

      Alert.alert('Registrado', `Medicamento registrado para ${selectedPatient!.nome}.`, [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível salvar o registro.');
      console.error('RegisterMedication error', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get the label for the selected via
  const selectedViaLabel = VIA_OPTIONS.find((o) => o.value === via)?.label;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={styles.root}>
          {/* Apple-style modal header */}
          <View style={{ paddingTop: insets.top }}>
            <ModalHeader
              title="Registrar Medicamento"
              onCancel={() => (navigation as any).getParent()?.navigate('NurseHomeStack')}
              onDone={handleSubmit}
              doneLabel="Salvar"
              doneDisabled={isSubmitting}
              isLoading={isSubmitting}
              accentColor={colors.primary}
            />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Medicamento e Dosagem */}
            <InsetGroupedSection header="MEDICAMENTO">
              <InsetRow
                label="Nome"
                rightContent={
                  <TextInput
                    value={medicamento}
                    onChangeText={(v) => { setMedicamento(v); setErrors((p) => ({ ...p, medicamento: '' })); }}
                    placeholder="Ex.: Losartana 50mg"
                    placeholderTextColor={colors.textMuted}
                    style={styles.inlineInput}
                    returnKeyType="next"
                    editable={!isSubmitting}
                  />
                }
              />
              <InsetRow
                label="Dosagem"
                last
                rightContent={
                  <TextInput
                    value={dosagem}
                    onChangeText={(v) => { setDosagem(v); setErrors((p) => ({ ...p, dosagem: '' })); }}
                    placeholder="Ex.: 1 comp."
                    placeholderTextColor={colors.textMuted}
                    style={styles.inlineInput}
                    returnKeyType="done"
                    editable={!isSubmitting}
                  />
                }
              />
            </InsetGroupedSection>
            {errors.medicamento ? <Text style={styles.errorText}>{errors.medicamento}</Text> : null}
            {errors.dosagem ? <Text style={styles.errorText}>{errors.dosagem}</Text> : null}

            {/* Horário e Via */}
            <InsetGroupedSection header="ADMINISTRAÇÃO">
              <InsetRow
                label="Horário"
                value={formatTime(horario)}
                onPress={() => setShowTimePicker(!showTimePicker)}
              />
              {showTimePicker && (
                <View style={styles.pickerContainer}>
                  <DateTimePicker
                    value={horario}
                    mode="time"
                    display="spinner"
                    minuteInterval={5}
                    onChange={(_event: any, selectedDate: Date | undefined) => {
                      if (selectedDate) setHorario(selectedDate);
                    }}
                    locale="pt-BR"
                  />
                </View>
              )}
              <InsetRow
                label="Via"
                value={selectedViaLabel}
                placeholder="Selecione"
                chevron
                onPress={() => { setShowViaPicker(true); setErrors((p) => ({ ...p, via: '' })); }}
                last
              />
            </InsetGroupedSection>
            {errors.via ? <Text style={styles.errorText}>{errors.via}</Text> : null}

            {/* Recusado */}
            <InsetGroupedSection>
              <InsetRow
                label="Paciente recusou"
                last
                rightContent={
                  <Switch
                    value={recusado}
                    onValueChange={setRecusado}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    disabled={isSubmitting}
                  />
                }
              />
            </InsetGroupedSection>

            {/* Observações */}
            <InsetGroupedSection header="OBSERVAÇÕES">
              <View style={styles.textAreaWrapper}>
                <TextInput
                  value={observacoes}
                  onChangeText={setObservacoes}
                  placeholder="Reação, motivo da recusa, etc."
                  placeholderTextColor={colors.textMuted}
                  style={styles.textArea}
                  multiline
                  textAlignVertical="top"
                  editable={!isSubmitting}
                />
              </View>
            </InsetGroupedSection>
          </ScrollView>

          {/* Selection modals */}
          <SelectionListModal
            visible={showViaPicker}
            title="Via de Administração"
            items={VIA_SELECTION_ITEMS}
            selectedId={via || null}
            onSelect={(item) => {
              setVia(item.id);
              setErrors((prev) => ({ ...prev, via: '' }));
            }}
            onClose={() => setShowViaPicker(false)}
          />
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  inlineInput: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    textAlign: 'right',
    minWidth: 140,
    paddingVertical: 0,
  },
  pickerContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  textArea: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    minHeight: 100,
    padding: spacing.md,
  },
  textAreaWrapper: {
    minHeight: 100,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.md,
    marginBottom: spacing.md,
    marginLeft: spacing.md,
  },
});
