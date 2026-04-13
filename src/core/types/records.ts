export type RecordType =
  | 'medicamento'
  | 'sinaisVitais'
  | 'alimentacao'
  | 'atividade'
  | 'foto'
  | 'intercorrencia';

export interface BaseRecord {
  id: string;
  pacienteId: string;
  empresaId: string;
  profissionalId: string;
  profissionalNome: string;
  type: RecordType;
  timestamp: Date;
  observacoes?: string;
  syncStatus: 'synced' | 'pending';
}

export interface MedicationRecord extends BaseRecord {
  type: 'medicamento';
  medicamento: string;
  dosagem: string;
  via: string;
  prescricaoId: string;
  reacao?: string;
  recusado: boolean;
}

export interface VitalSignsRecord extends BaseRecord {
  type: 'sinaisVitais';
  paSistolica: number;
  paDiastolica: number;
  fc: number;
  fr: number;
  temperatura: number;
  satO2: number;
  alerta: boolean;
}

export interface FeedingRecord extends BaseRecord {
  type: 'alimentacao';
  tipoRefeicao:
    | 'cafe'
    | 'lanche_manha'
    | 'almoco'
    | 'lanche_tarde'
    | 'jantar'
    | 'ceia';
  aceitacao: number; // 0, 25, 50, 75, 100
  consistencia: 'normal' | 'pastosa' | 'liquida' | 'enteral';
  hidratacaoMl: number;
  intercorrencia?: string;
}

export interface ActivityRecord extends BaseRecord {
  type: 'atividade';
  categoria:
    | 'banho'
    | 'higiene_oral'
    | 'troca_fralda'
    | 'curativo'
    | 'reposicionamento'
    | 'mobilidade'
    | 'fisioterapia'
    | 'outro';
}

export interface PhotoRecord extends BaseRecord {
  type: 'foto';
  imageUrl: string;
  imagePath: string;
  fotoClinica: boolean; // true = não visível para família
  atividadeVinculada?: string;
}

export type CareRecord =
  | MedicationRecord
  | VitalSignsRecord
  | FeedingRecord
  | ActivityRecord
  | PhotoRecord;
