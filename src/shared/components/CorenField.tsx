/**
 * Registro profissional no COREN, com conferência assistida.
 *
 * OPCIONAL POR DESENHO: cuidador não é profissão regulamentada e não tem
 * conselho, então a conta existe sem registro. Quem é enfermeiro, técnico ou
 * auxiliar preenche e o admin atesta. Preencheu pela metade não passa: a tela
 * exige o conjunto completo assim que o primeiro campo é tocado.
 *
 * POR QUE ASSISTIDA E NÃO AUTOMÁTICA: o Cofen publica a consulta pública
 * (Sigen), mas não oferece API. As APIs de terceiros são pagas e por estado,
 * e usá-las exigiria um backend só para guardar a chave. Enquanto isso não se
 * paga, o desenho honesto é este: campo estruturado, botão que abre a consulta
 * oficial, e o atesto de quem conferiu, gravado com autor e data.
 *
 * O QUE ISTO NÃO FAZ: não impede um admin relapso de marcar sem conferir, e
 * não reverifica com o tempo (registro pode ser suspenso depois). O que ele
 * entrega é a trilha: quem afirmou o quê, e quando.
 */
import { useState } from 'react';
import { Text, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, fontSize, borderRadius } from '../../core/theme/theme';
import type { CorenCategoria } from '../../core/types';
import { UF_LIST, COREN_CATEGORIA_LABEL } from '../utils/formatters';
import { FormInput } from './ui/FormInput';
import { InsetGroupedSection } from './ui/InsetGroupedSection';
import { InsetRow } from './ui/InsetRow';
import { SelectionListModal } from './ui/SelectionListModal';

/** Consulta pública de profissionais do Cofen */
const SIGEN_URL = 'https://sigen.cofen.gov.br/profissional/consultar';

export interface CorenFieldValue {
  uf: string;
  numero: string;
  categoria: CorenCategoria;
  verificado: boolean;
}

export const EMPTY_COREN: CorenFieldValue = {
  uf: '',
  numero: '',
  categoria: 'enfermeiro',
  verificado: false,
};

interface CorenFieldProps {
  value: CorenFieldValue;
  onChange: (next: CorenFieldValue) => void;
  editable?: boolean;
  accentColor?: string;
  /** Erros por campo, vindos da validação da tela */
  errors?: { uf?: string; numero?: string; verificado?: string };
}

const CATEGORIAS: CorenCategoria[] = ['enfermeiro', 'tecnico', 'auxiliar'];

export const CorenField = ({
  value,
  onChange,
  editable = true,
  accentColor = colors.primary,
  errors,
}: CorenFieldProps) => {
  const [showUfPicker, setShowUfPicker] = useState(false);
  const [showCategoriaPicker, setShowCategoriaPicker] = useState(false);

  const set = (patch: Partial<CorenFieldValue>) => onChange({ ...value, ...patch });

  const openSigen = async () => {
    const canOpen = await Linking.canOpenURL(SIGEN_URL);
    if (!canOpen) {
      Alert.alert(
        'Não foi possível abrir',
        'Abra o endereço sigen.cofen.gov.br/profissional/consultar no navegador para consultar o registro.'
      );
      return;
    }
    await Linking.openURL(SIGEN_URL);
  };

  // Trocar o registro invalida o atesto anterior: quem conferiu, conferiu
  // outro número. Obrigar a reconferir é o ponto do campo existir.
  const setRegistro = (patch: Partial<CorenFieldValue>) =>
    onChange({ ...value, ...patch, verificado: false });

  return (
    <>
      <InsetGroupedSection header="Registro profissional (opcional)">
        <InsetRow
          label="Categoria"
          value={COREN_CATEGORIA_LABEL[value.categoria]}
          chevron
          onPress={editable ? () => setShowCategoriaPicker(true) : undefined}
        />
        <InsetRow
          label="UF do conselho"
          value={value.uf}
          placeholder="Selecionar"
          chevron
          onPress={editable ? () => setShowUfPicker(true) : undefined}
        />
        <InsetRow
          label="Número"
          last
          rightContent={
            <FormInput
              value={value.numero}
              onChangeText={(v) => setRegistro({ numero: v.replace(/\D/g, '').slice(0, 12) })}
              placeholder="000000"
              keyboardType="number-pad"
              editable={editable}
              style={styles.numeroInput}
            />
          }
        />
      </InsetGroupedSection>

      {errors?.uf || errors?.numero ? (
        <Text style={styles.errorText}>{errors.uf ?? errors.numero}</Text>
      ) : null}

      {/* Conferência no Cofen */}
      <TouchableOpacity
        style={[styles.verifyLink, !editable && styles.disabled]}
        onPress={openSigen}
        disabled={!editable}
        activeOpacity={0.6}
      >
        <Ionicons name="open-outline" size={18} color={accentColor} />
        <Text style={[styles.verifyLinkText, { color: accentColor }]}>
          Consultar este registro no Cofen
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.attestRow, !editable && styles.disabled]}
        onPress={() => set({ verificado: !value.verificado })}
        disabled={!editable}
        activeOpacity={0.6}
      >
        <Ionicons
          name={value.verificado ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={value.verificado ? accentColor : colors.textMuted}
        />
        <Text style={styles.attestText}>
          Confirmo que consultei este registro no Cofen e que a situação está ativa
        </Text>
      </TouchableOpacity>

      {errors?.verificado ? (
        <Text style={styles.errorText}>{errors.verificado}</Text>
      ) : null}

      <Text style={styles.hint}>
        Cuidador sem registro em conselho pode ficar em branco. Se preencher, o
        número e a conferência passam a ser obrigatórios. A conferência fica
        registrada com o seu nome e a data. Quem responde pela checagem do
        registro é a empresa, não o aplicativo.
      </Text>

      <SelectionListModal
        visible={showCategoriaPicker}
        title="Categoria"
        items={CATEGORIAS.map((c) => ({ id: c, label: COREN_CATEGORIA_LABEL[c] }))}
        selectedId={value.categoria}
        onSelect={(item) => setRegistro({ categoria: item.id as CorenCategoria })}
        onClose={() => setShowCategoriaPicker(false)}
        accentColor={accentColor}
      />

      <SelectionListModal
        visible={showUfPicker}
        title="UF do conselho"
        items={UF_LIST.map((uf) => ({ id: uf, label: uf }))}
        selectedId={value.uf || null}
        onSelect={(item) => setRegistro({ uf: item.id })}
        onClose={() => setShowUfPicker(false)}
        accentColor={accentColor}
      />
    </>
  );
};

const styles = StyleSheet.create({
  numeroInput: {
    minWidth: 120,
    textAlign: 'right',
    marginBottom: 0,
  },
  verifyLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
  },
  verifyLinkText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  attestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  attestText: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  disabled: {
    opacity: 0.5,
  },
  hint: {
    fontSize: fontSize.xs,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: fontSize.xs,
    marginTop: -spacing.sm,
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },
});
