import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  type KeyboardTypeOptions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

import { colors, spacing, fontSize, borderRadius } from '../../../core/theme/theme';
import { useAuthStore } from '../../../core/hooks/useAuth';
import * as patientService from '../../../core/services/patientService';
import { DEFAULT_VITAL_SIGNS } from '../../../core/services/patientService';
import type {
  VitalSignsRange,
  Patient,
  Prescription,
  EmergencyContact,
} from '../../../core/types';
import type { FamilyMedicationInput } from '../../../core/services/patientService';
import {
  InsetGroupedSection,
  InsetRow,
  SegmentedControl,
  SelectionListModal,
  FormInput,
  PrimaryButton,
} from '../../../shared/components/ui';
import type { SelectionItem } from '../../../shared/components/ui';

const STEPS = [
  'Paciente',
  'Condições',
  'Sinais vitais',
  'Medicamentos',
  'Contatos',
  'Confirmação',
];

const GENERO_OPTIONS = [
  { key: 'masculino', label: 'Masculino' },
  { key: 'feminino', label: 'Feminino' },
  { key: 'outro', label: 'Outro' },
];

const VIA_OPTIONS: SelectionItem[] = [
  { id: 'oral', label: 'Oral' },
  { id: 'sublingual', label: 'Sublingual' },
  { id: 'topica', label: 'Tópica' },
  { id: 'intramuscular', label: 'Intramuscular' },
  { id: 'subcutanea', label: 'Subcutânea' },
  { id: 'intravenosa', label: 'Intravenosa' },
  { id: 'retal', label: 'Retal' },
  { id: 'inalatoria', label: 'Inalatória' },
];

const formatDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const FamilyOnboardingScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<{ goBack: () => void }>();
  const route = useRoute();
  // Se veio com patientId, é "modo completar" (paciente-stub criado pelo admin).
  const completePatientId = (route.params as { patientId?: string } | undefined)?.patientId;
  const isComplete = !!completePatientId;
  const { user, setUser } = useAuthStore();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 0 — paciente
  const [nome, setNome] = useState('');
  const [dataNascimento, setDataNascimento] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [genero, setGenero] = useState<Patient['genero']>('masculino');

  // Step 1 — condições & alergias
  const [diagnosticos, setDiagnosticos] = useState<string[]>([]);
  const [alergias, setAlergias] = useState<string[]>([]);
  const [diagInput, setDiagInput] = useState('');
  const [alergiaInput, setAlergiaInput] = useState('');

  // Step 2 — faixas de sinais vitais
  const [ranges, setRanges] = useState<VitalSignsRange>({ ...DEFAULT_VITAL_SIGNS });

  // Step 3 — medicamentos
  const [medicamentos, setMedicamentos] = useState<FamilyMedicationInput[]>([]);
  const [medNome, setMedNome] = useState('');
  const [medDose, setMedDose] = useState('');
  const [medVia, setMedVia] = useState<Prescription['via']>('oral');
  const [medFreq, setMedFreq] = useState('');
  const [medHorarios, setMedHorarios] = useState('');
  const [showViaList, setShowViaList] = useState(false);

  // Step 4 — médico & contato
  const [medicoNome, setMedicoNome] = useState('');
  const [medicoCrm, setMedicoCrm] = useState('');
  const [medicoTel, setMedicoTel] = useState('');
  // Contato principal = o próprio usuário (pré-preenchido, editável)
  const [contatoNome, setContatoNome] = useState(user?.nome ?? '');
  const [contatoTel, setContatoTel] = useState(user?.telefone ?? '');
  // Contatos de emergência adicionais
  const [contatosAdicionais, setContatosAdicionais] = useState<EmergencyContact[]>([]);
  const [addNome, setAddNome] = useState('');
  const [addParentesco, setAddParentesco] = useState('');
  const [addTel, setAddTel] = useState('');

  // Step 5 — confirmação
  const [confirmado, setConfirmado] = useState(false);

  // Modo completar: pré-preenche os dados pessoais já informados pelo admin (stub)
  useEffect(() => {
    if (!isComplete || !user?.empresaId || !completePatientId) return;
    patientService
      .getPatient(user.empresaId, completePatientId)
      .then((p) => {
        if (!p) return;
        setNome(p.nome ?? '');
        setDataNascimento(p.dataNascimento ?? null);
        setGenero(p.genero ?? 'masculino');
        if (p.diagnosticos?.length) setDiagnosticos(p.diagnosticos);
        if (p.alergias?.length) setAlergias(p.alergias);
        if (p.faixaSinaisVitais) setRanges(p.faixaSinaisVitais);
      })
      .catch((e) => console.error('FamilyOnboarding: erro ao carregar stub', e));
  }, [isComplete, completePatientId, user?.empresaId]);

  // ── Validação por passo ──
  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return nome.trim().length > 1 && dataNascimento != null;
      case 5:
        return confirmado;
      default:
        return true; // demais passos são opcionais
    }
  };

  const setRange = (key: keyof VitalSignsRange, value: string) => {
    const n = parseFloat(value.replace(',', '.'));
    setRanges((r) => ({ ...r, [key]: Number.isNaN(n) ? 0 : n }));
  };

  const addItem = (
    value: string,
    list: string[],
    setList: (v: string[]) => void,
    clear: () => void
  ) => {
    const v = value.trim();
    if (!v) return;
    setList([...list, v]);
    clear();
  };

  const addContato = () => {
    if (!addNome.trim()) return;
    setContatosAdicionais((c) => [
      ...c,
      { nome: addNome.trim(), parentesco: addParentesco.trim(), telefone: addTel.trim() },
    ]);
    setAddNome('');
    setAddParentesco('');
    setAddTel('');
  };

  const removeContato = (i: number) =>
    setContatosAdicionais((c) => c.filter((_, idx) => idx !== i));

  const addMedicamento = () => {
    if (!medNome.trim()) return;
    setMedicamentos((m) => [
      ...m,
      {
        medicamento: medNome.trim(),
        dosagem: medDose.trim(),
        via: medVia,
        frequencia: medFreq.trim(),
        horarios: medHorarios
          .split(',')
          .map((h) => h.trim())
          .filter(Boolean),
      },
    ]);
    setMedNome('');
    setMedDose('');
    setMedVia('oral');
    setMedFreq('');
    setMedHorarios('');
  };

  const handleFinish = async () => {
    if (!user?.empresaId || !user?.uid || !dataNascimento) return;
    setSaving(true);
    try {
      const input = {
        nome: nome.trim(),
        dataNascimento,
        genero,
        diagnosticos,
        alergias,
        contatoEmergencia: {
          nome: contatoNome.trim() || user.nome || '',
          parentesco: user.parentesco ?? 'Responsável',
          telefone: contatoTel.trim(),
        },
        contatosAdicionais,
        medicoResponsavel: medicoNome.trim()
          ? {
              nome: medicoNome.trim(),
              crm: medicoCrm.trim() || undefined,
              telefone: medicoTel.trim() || undefined,
            }
          : undefined,
        faixaSinaisVitais: ranges,
        medicamentos,
      };

      if (isComplete && completePatientId) {
        // Completa o paciente-stub criado pelo admin (já vinculado à família)
        await patientService.completePatientByFamily(user.empresaId, completePatientId, input);
        navigation.goBack();
      } else {
        // Fluxo legado: a própria família cria o paciente do zero
        const newId = await patientService.createPatientByFamily(user.empresaId, user.uid, input);
        // Atualiza o store → RootNavigator passa a renderizar as abas da família
        setUser({ ...user, pacienteId: newId });
      }
    } catch (e) {
      console.error('FamilyOnboarding finish error', e);
      Alert.alert(
        'Erro ao cadastrar',
        'Não foi possível salvar o cadastro. Verifique sua conexão e tente novamente.'
      );
    } finally {
      setSaving(false);
    }
  };

  const goNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header com progresso */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerTop}>
          {step > 0 ? (
            <TouchableOpacity onPress={goBack} style={styles.backRow} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={colors.family} />
              <Text style={styles.backText}>Voltar</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backRow} />
          )}
          <Text style={styles.stepCount}>Passo {step + 1} de {STEPS.length}</Text>
        </View>
        <Text style={styles.title}>{STEPS[step]}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ───── Passo 0: Paciente ───── */}
        {step === 0 && (
          <>
            <InsetGroupedSection header="DADOS DO PACIENTE">
              <InputRow label="Nome" value={nome} onChangeText={setNome} placeholder="Nome completo" />
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

            <Text style={styles.sectionLabel}>SEXO</Text>
            <SegmentedControl
              options={GENERO_OPTIONS}
              selectedKey={genero}
              onSelect={(k) => setGenero(k as Patient['genero'])}
              accentColor={colors.family}
            />
          </>
        )}

        {/* ───── Passo 1: Condições & alergias ───── */}
        {step === 1 && (
          <>
            <Text style={styles.helper}>
              Informe os diagnósticos e alergias do paciente, conforme orientação médica.
            </Text>
            <AddList
              header="DIAGNÓSTICOS / CONDIÇÕES"
              placeholder="Ex.: Hipertensão"
              value={diagInput}
              onChangeValue={setDiagInput}
              items={diagnosticos}
              onAdd={() => addItem(diagInput, diagnosticos, setDiagnosticos, () => setDiagInput(''))}
              onRemove={(i) => setDiagnosticos(diagnosticos.filter((_, idx) => idx !== i))}
            />
            <AddList
              header="ALERGIAS"
              placeholder="Ex.: Dipirona"
              value={alergiaInput}
              onChangeValue={setAlergiaInput}
              items={alergias}
              onAdd={() => addItem(alergiaInput, alergias, setAlergias, () => setAlergiaInput(''))}
              onRemove={(i) => setAlergias(alergias.filter((_, idx) => idx !== i))}
            />
          </>
        )}

        {/* ───── Passo 2: Sinais vitais ───── */}
        {step === 2 && (
          <>
            <Text style={styles.helper}>
              Faixas esperadas definidas pelo médico do paciente. Elas disparam os alertas,
              preencha com cuidado.
            </Text>
            <RangePair label="Pressão sistólica (mmHg)" minKey="paSistolicaMin" maxKey="paSistolicaMax" ranges={ranges} onChange={setRange} />
            <RangePair label="Pressão diastólica (mmHg)" minKey="paDiastolicaMin" maxKey="paDiastolicaMax" ranges={ranges} onChange={setRange} />
            <RangePair label="Freq. cardíaca (bpm)" minKey="fcMin" maxKey="fcMax" ranges={ranges} onChange={setRange} />
            <RangePair label="Freq. respiratória (irpm)" minKey="frMin" maxKey="frMax" ranges={ranges} onChange={setRange} />
            <RangePair label="Temperatura (°C)" minKey="tempMin" maxKey="tempMax" ranges={ranges} onChange={setRange} />
            <View style={styles.singleRange}>
              <Text style={styles.rangeLabel}>SpO₂ mínima (%)</Text>
              <FormInput
                value={String(ranges.satO2Min)}
                onChangeText={(v) => setRange('satO2Min', v)}
                keyboardType="numeric"
                style={styles.numInput}
              />
            </View>
          </>
        )}

        {/* ───── Passo 3: Medicamentos ───── */}
        {step === 3 && (
          <>
            <Text style={styles.helper}>
              Medicamentos de uso contínuo, conforme prescrição médica.
            </Text>

            {medicamentos.map((m, i) => (
              <View key={`${m.medicamento}-${i}`} style={styles.medCard}>
                <View style={styles.flex1}>
                  <Text style={styles.medName}>{m.medicamento}</Text>
                  <Text style={styles.medMeta}>
                    {[m.dosagem, m.via, m.frequencia].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setMedicamentos(medicamentos.filter((_, idx) => idx !== i))}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            <InsetGroupedSection header="ADICIONAR MEDICAMENTO">
              <InputRow label="Medicamento" value={medNome} onChangeText={setMedNome} placeholder="Nome" />
              <InputRow label="Dosagem" value={medDose} onChangeText={setMedDose} placeholder="Ex.: 1 comp / 50mg" />
              <InsetRow
                label="Via"
                value={VIA_OPTIONS.find((v) => v.id === medVia)?.label ?? 'Oral'}
                onPress={() => setShowViaList(true)}
                chevron
              />
              <InputRow label="Frequência" value={medFreq} onChangeText={setMedFreq} placeholder="Ex.: 8/8h" />
              <InputRow label="Horários" value={medHorarios} onChangeText={setMedHorarios} placeholder="08:00, 16:00" last />
            </InsetGroupedSection>

            <TouchableOpacity style={styles.addMedBtn} onPress={addMedicamento} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color={colors.family} />
              <Text style={styles.addMedText}>Adicionar à lista</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ───── Passo 4: Médico & contato ───── */}
        {step === 4 && (
          <>
            <InsetGroupedSection header="MÉDICO RESPONSÁVEL">
              <InputRow label="Nome" value={medicoNome} onChangeText={setMedicoNome} placeholder="Dr(a)." />
              <InputRow label="CRM" value={medicoCrm} onChangeText={setMedicoCrm} placeholder="Opcional" />
              <InputRow label="Telefone" value={medicoTel} onChangeText={setMedicoTel} placeholder="Opcional" keyboardType="phone-pad" last />
            </InsetGroupedSection>

            <Text style={styles.helper}>
              Você já é o contato de emergência principal. Edite se precisar e adicione outros contatos.
            </Text>
            <InsetGroupedSection header="CONTATO PRINCIPAL (VOCÊ)">
              <InputRow label="Nome" value={contatoNome} onChangeText={setContatoNome} placeholder={user?.nome ?? 'Nome'} />
              <InputRow label="Telefone" value={contatoTel} onChangeText={setContatoTel} placeholder="(11) 99999-9999" keyboardType="phone-pad" last />
            </InsetGroupedSection>

            {contatosAdicionais.map((c, i) => (
              <View key={`${c.nome}-${i}`} style={styles.medCard}>
                <View style={styles.flex1}>
                  <Text style={styles.medName}>{c.nome}</Text>
                  <Text style={styles.medMeta}>
                    {[c.parentesco, c.telefone].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => removeContato(i)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>
            ))}

            <InsetGroupedSection header="ADICIONAR OUTRO CONTATO">
              <InputRow label="Nome" value={addNome} onChangeText={setAddNome} placeholder="Nome" />
              <InputRow label="Parentesco" value={addParentesco} onChangeText={setAddParentesco} placeholder="Ex.: Filho(a)" />
              <InputRow label="Telefone" value={addTel} onChangeText={setAddTel} placeholder="(11) 99999-9999" keyboardType="phone-pad" last />
            </InsetGroupedSection>
            <TouchableOpacity style={styles.addMedBtn} onPress={addContato} activeOpacity={0.7}>
              <Ionicons name="add-circle-outline" size={20} color={colors.family} />
              <Text style={styles.addMedText}>Adicionar contato</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ───── Passo 5: Confirmação ───── */}
        {step === 5 && (
          <>
            <InsetGroupedSection header="RESUMO">
              <InsetRow label="Paciente" value={nome || 'Nenhum'} />
              <InsetRow label="Nascimento" value={dataNascimento ? formatDate(dataNascimento) : 'Nenhum'} />
              <InsetRow label="Diagnósticos" value={diagnosticos.length ? String(diagnosticos.length) : 'Nenhum'} />
              <InsetRow label="Alergias" value={alergias.length ? String(alergias.length) : 'Nenhuma'} />
              <InsetRow label="Medicamentos" value={medicamentos.length ? String(medicamentos.length) : 'Nenhum'} last />
            </InsetGroupedSection>

            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setConfirmado((c) => !c)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={confirmado ? 'checkbox' : 'square-outline'}
                size={24}
                color={confirmado ? colors.family : colors.textMuted}
              />
              <Text style={styles.checkText}>
                Confirmo que estes dados foram definidos pelo médico do paciente.
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <PrimaryButton
          title={step === STEPS.length - 1 ? 'Concluir cadastro' : 'Continuar'}
          onPress={goNext}
          disabled={!canAdvance()}
          loading={saving}
          style={{ backgroundColor: colors.family }}
        />
      </View>

      <SelectionListModal
        visible={showViaList}
        title="Via de administração"
        items={VIA_OPTIONS}
        selectedId={medVia}
        onSelect={(item) => {
          setMedVia(item.id as Prescription['via']);
          setShowViaList(false);
        }}
        onClose={() => setShowViaList(false)}
        accentColor={colors.family}
      />
    </KeyboardAvoidingView>
  );
};

// ════════════════════════════════════════════
// Subcomponentes
// ════════════════════════════════════════════

/**
 * Linha de formulário cujo toque em QUALQUER parte foca o TextInput.
 */
const InputRow = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  last,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  last?: boolean;
}) => {
  const ref = useRef<TextInput>(null);
  return (
    <InsetRow
      label={label}
      last={last}
      onPress={() => ref.current?.focus()}
      rightContent={
        <TextInput
          ref={ref}
          style={styles.inlineInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          keyboardType={keyboardType}
        />
      }
    />
  );
};

interface AddListProps {
  header: string;
  placeholder: string;
  value: string;
  onChangeValue: (v: string) => void;
  items: string[];
  onAdd: () => void;
  onRemove: (index: number) => void;
}

const AddList = ({ header, placeholder, value, onChangeValue, items, onAdd, onRemove }: AddListProps) => (
  <View style={styles.addListWrap}>
    <Text style={styles.sectionLabel}>{header}</Text>
    {items.map((it, i) => (
      <View key={`${it}-${i}`} style={styles.itemRow}>
        <Text style={styles.itemText}>{it}</Text>
        <TouchableOpacity onPress={() => onRemove(i)} hitSlop={8}>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    ))}
    <View style={styles.addInputRow}>
      <TextInput
        style={styles.addInput}
        value={value}
        onChangeText={onChangeValue}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={onAdd}
        returnKeyType="done"
      />
      <TouchableOpacity onPress={onAdd} hitSlop={8} style={styles.addBtn}>
        <Ionicons name="add-circle" size={26} color={colors.family} />
      </TouchableOpacity>
    </View>
  </View>
);

interface RangePairProps {
  label: string;
  minKey: keyof VitalSignsRange;
  maxKey: keyof VitalSignsRange;
  ranges: VitalSignsRange;
  onChange: (key: keyof VitalSignsRange, value: string) => void;
}

const RangePair = ({ label, minKey, maxKey, ranges, onChange }: RangePairProps) => (
  <View style={styles.rangePair}>
    <Text style={styles.rangeLabel}>{label}</Text>
    <View style={styles.rangeInputs}>
      <FormInput
        value={String(ranges[minKey])}
        onChangeText={(v) => onChange(minKey, v)}
        keyboardType="numeric"
        half
        style={styles.numInput}
      />
      <Text style={styles.rangeSep}>até</Text>
      <FormInput
        value={String(ranges[maxKey])}
        onChangeText={(v) => onChange(maxKey, v)}
        keyboardType="numeric"
        half
        style={styles.numInput}
      />
    </View>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },

  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backRow: { flexDirection: 'row', alignItems: 'center', minWidth: 80, minHeight: 24 },
  backText: { fontSize: fontSize.md, color: colors.family, fontWeight: '600' },
  stepCount: { fontSize: fontSize.sm, color: colors.textMuted, fontWeight: '500' },
  title: { fontSize: fontSize.title, fontWeight: '700', color: colors.textPrimary, marginTop: spacing.sm, letterSpacing: 0.35 },
  progressTrack: { height: 4, backgroundColor: colors.border, borderRadius: 2, marginTop: spacing.md, overflow: 'hidden' },
  progressFill: { height: 4, backgroundColor: colors.family, borderRadius: 2 },

  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },

  helper: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: spacing.md, lineHeight: 20 },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: '600', color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },

  inlineInput: { flex: 1, fontSize: fontSize.md, color: colors.textPrimary, textAlign: 'right', paddingVertical: 0 },

  pickerWrap: { backgroundColor: colors.surface, borderRadius: borderRadius.md, marginTop: spacing.sm },

  // Add list
  addListWrap: { marginBottom: spacing.sm },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm, marginBottom: spacing.xs,
  },
  itemText: { fontSize: fontSize.md, color: colors.textPrimary, flex: 1 },
  addInputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addInput: {
    flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    fontSize: fontSize.md, color: colors.textPrimary, minHeight: 44,
  },
  addBtn: { padding: 2 },

  // Ranges
  rangePair: { marginBottom: spacing.md },
  rangeLabel: { fontSize: fontSize.sm, fontWeight: '600', color: colors.textPrimary, marginBottom: spacing.xs },
  rangeInputs: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rangeSep: { fontSize: fontSize.sm, color: colors.textMuted },
  numInput: { textAlign: 'center' },
  singleRange: { marginBottom: spacing.md },

  // Meds
  medCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, marginBottom: spacing.sm,
  },
  flex1: { flex: 1 },
  medName: { fontSize: fontSize.md, fontWeight: '700', color: colors.textPrimary },
  medMeta: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  addMedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.md },
  addMedText: { fontSize: fontSize.md, fontWeight: '600', color: colors.family },

  // Confirm
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  checkText: { flex: 1, fontSize: fontSize.sm, color: colors.textPrimary, lineHeight: 20 },

  // Footer
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    backgroundColor: colors.background, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
  },
});
