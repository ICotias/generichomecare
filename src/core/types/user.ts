export type UserRole = 'nurse' | 'family' | 'admin';

/** Categoria profissional registrada no Cofen */
export type CorenCategoria = 'enfermeiro' | 'tecnico' | 'auxiliar';

/**
 * Plano do cuidador autônomo, cobrado por faixa de pacientes ativos.
 *
 * O `inicio` é permanente e gratuito: serve para conhecer o aplicativo com
 * paciente real. Ausente = `inicio`, para não trancar conta antiga fora.
 *
 * O campo é IMUTÁVEL para o próprio usuário nas rules. Não existe pagamento
 * dentro do aplicativo, então quem muda de faixa é a operação, fora dele. Se o
 * cuidador pudesse editar, a faixa não valeria nada.
 */
export type PlanoAutonomo = 'inicio' | 'essencial' | 'profissional' | 'ilimitado';

/** Teto de pacientes ativos por faixa. `null` = sem limite. */
export const LIMITE_PACIENTES: Record<PlanoAutonomo, number | null> = {
  inicio: 2,
  essencial: 6,
  profissional: 15,
  ilimitado: null,
};

export const PLANO_LABEL: Record<PlanoAutonomo, string> = {
  inicio: 'Início',
  essencial: 'Essencial',
  profissional: 'Profissional',
  ilimitado: 'Ilimitado',
};

/**
 * Registro no COREN, conferido pelo admin no portal do Cofen. O app não valida
 * o registro de forma automática: guarda o dado estruturado e o atesto de quem
 * conferiu, como trilha de auditoria.
 *
 * Opcional na conta: cuidador não tem conselho profissional. Presente quando o
 * profissional é enfermeiro, técnico ou auxiliar.
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
  /** Registro no conselho + atesto do admin. Ausente para cuidador sem registro. */
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
  /**
   * Cuidador autônomo: faixa contratada. Só existe em conta `nurse` que é dona
   * do próprio tenant (`empresas/{id}.tipo === 'autonomo'`). Ausente = `inicio`.
   */
  planoAutonomo?: PlanoAutonomo;
  createdAt: Date;
  updatedAt: Date;
}

export interface NurseProfile extends AppUser {
  role: 'nurse';
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
