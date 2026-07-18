export type UserRole = 'nurse' | 'family' | 'admin';

/** Categoria profissional registrada no Cofen */
export type CorenCategoria = 'enfermeiro' | 'tecnico' | 'auxiliar';

/**
 * Registro profissional do enfermeiro, conferido pelo admin no portal do Cofen.
 * O app não valida o registro de forma automática: guarda o dado estruturado e
 * o atesto de quem conferiu, como trilha de auditoria.
 */
export interface CorenRegistro {
  uf: string;
  numero: string;
  categoria: CorenCategoria;
  /** Admin declarou ter conferido o registro no Cofen e que a situação é ativa */
  verificado: boolean;
  /** Quando o atesto foi feito */
  verificadoEm?: Date;
  /** UID de quem atestou */
  verificadoPorUid?: string;
}

export interface AppUser {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  empresaId: string;
  telefone: string;
  /** Enfermeiro: registro profissional estruturado + atesto do admin */
  corenRegistro?: CorenRegistro;
  avatarUrl?: string;
  lgpdConsentAt?: Date;
  /** Conta criada pelo admin com senha temporária — força troca no 1º acesso */
  mustChangePassword?: boolean;
  /** Família: paciente vinculado (vazio até o cadastro no 1º acesso) */
  pacienteId?: string;
  /** Família: parentesco com o paciente */
  parentesco?: string;
  /**
   * Família: titular do cadastro (quem responde pelos dados do paciente) ou
   * acompanhante convidado (só leitura).
   *
   * Ausente = titular. Contas anteriores a este campo são todas titulares, e o
   * default nas rules é `true` justamente para não trancá-las fora.
   */
  familiaTitular?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface NurseProfile extends AppUser {
  role: 'nurse';
  corenRegistro: CorenRegistro;
  especialidades: string[];
  disponibilidade: string;
  valorHora: number;
  status: 'ativo' | 'inativo';
}

export interface FamilyProfile extends AppUser {
  role: 'family';
  pacienteId: string;
  parentesco: string;
}

export interface AdminProfile extends AppUser {
  role: 'admin';
  cargo: string;
}
