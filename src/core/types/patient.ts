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
  medicamentosEmUso?: string[];
  observacoes?: string;
  fotoUrl?: string;
  faixaSinaisVitais: VitalSignsRange;
  /** Quem originou os dados clínicos: a equipe (admin/enfermagem) ou a família */
  origemDados?: 'equipe' | 'familia';
  /** UID de quem criou o registro do paciente */
  criadoPorUid?: string;
  /** Se a equipe já revisou/validou os dados trazidos pela família */
  validadoPorEquipe?: boolean;
  /** Médico responsável informado (proveniência dos parâmetros clínicos) */
  medicoResponsavel?: ResponsibleDoctor;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResponsibleDoctor {
  nome: string;
  crm?: string;
  telefone?: string;
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
