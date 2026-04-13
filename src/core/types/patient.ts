export interface Patient {
  id: string;
  empresaId: string;
  nome: string;
  dataNascimento: Date;
  cpf: string;
  genero: 'masculino' | 'feminino' | 'outro';
  endereco: Address;
  contatoEmergencia: EmergencyContact;
  diagnosticos: string[];
  alergias: string[];
  tipoAtendimento: 'integral' | 'diurno' | 'noturno' | 'visita';
  status: 'ativo' | 'inativo' | 'alta';
  faixaSinaisVitais: VitalSignsRange;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface EmergencyContact {
  nome: string;
  parentesco: string;
  telefone: string;
}

export interface VitalSignsRange {
  paSistolicaMin: number;
  paSistolicaMax: number;
  paDiastolicaMin: number;
  paDiastolicaMax: number;
  fcMin: number;
  fcMax: number;
  frMin: number;
  frMax: number;
  tempMin: number;
  tempMax: number;
  satO2Min: number;
}

export interface Prescription {
  id: string;
  pacienteId: string;
  medicamento: string;
  dosagem: string;
  via:
    | 'oral'
    | 'sublingual'
    | 'topica'
    | 'intramuscular'
    | 'subcutanea'
    | 'intravenosa'
    | 'retal'
    | 'inalatoria';
  frequencia: string;
  horarios: string[];
  dataInicio: Date;
  dataFim?: Date;
  observacoes?: string;
  ativo: boolean;
}
