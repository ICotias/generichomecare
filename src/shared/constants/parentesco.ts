import type { SelectionItem } from '../components/ui';

/** Opções de parentesco para vínculo de familiar com paciente. */
export const PARENTESCO_OPTIONS: SelectionItem[] = [
  { id: 'filho', label: 'Filho(a)' },
  { id: 'conjuge', label: 'Cônjuge' },
  { id: 'neto', label: 'Neto(a)' },
  { id: 'irmao', label: 'Irmão(ã)' },
  { id: 'sobrinho', label: 'Sobrinho(a)' },
  { id: 'cuidador', label: 'Cuidador(a)' },
  { id: 'outro', label: 'Outro' },
];
