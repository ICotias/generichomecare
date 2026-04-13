export type UserRole = 'nurse' | 'family' | 'admin';

export interface AppUser {
  uid: string;
  email: string;
  nome: string;
  role: UserRole;
  empresaId: string;
  telefone: string;
  avatarUrl?: string;
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
