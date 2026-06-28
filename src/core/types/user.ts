export type UserRole = 'nurse' | 'family' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  empresaId: string;
  telefone: string;
  coren?: string;
  avatarUrl?: string;
  lgpdConsentAt?: Date;
  /** Conta criada pelo admin com senha temporária — força troca no 1º acesso */
  mustChangePassword?: boolean;
  /** Família: paciente vinculado (vazio até o cadastro no 1º acesso) */
  pacienteId?: string;
  /** Família: parentesco com o paciente */
  parentesco?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface NurseProfile extends AppUser {
  role: 'nurse';
  coren: string;
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
