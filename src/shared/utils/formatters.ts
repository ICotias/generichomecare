/**
 * Formatadores de input — máscaras brasileiras.
 * Centralizado para evitar duplicação entre telas.
 */
import { CorenCategoria, CorenRegistro } from '../../core/types';

/** (00) 00000-0000 */
export const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

/** 000.000.000-00 */
export const formatCPF = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── COREN ──

/** Siglas das UFs, para o seletor de COREN */
export const UF_LIST = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export const COREN_CATEGORIA_LABEL: Record<CorenCategoria, string> = {
  enfermeiro: 'Enfermeiro(a)',
  tecnico: 'Técnico(a) de enfermagem',
  auxiliar: 'Auxiliar de enfermagem',
};

/** Sufixo que o Cofen usa na inscrição, por categoria */
const CATEGORIA_SUFIXO: Record<CorenCategoria, string> = {
  enfermeiro: 'ENF',
  tecnico: 'TE',
  auxiliar: 'AE',
};

/** Ex.: "COREN-BA 123456-ENF" */
export const formatCoren = (registro?: CorenRegistro): string => {
  if (!registro?.numero || !registro?.uf) return '';
  return `COREN-${registro.uf} ${registro.numero}-${CATEGORIA_SUFIXO[registro.categoria]}`;
};
