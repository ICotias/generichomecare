export type TransactionType = 'receita' | 'despesa';

export interface FinancialRecord {
  id: string;
  empresaId: string;
  tipo: TransactionType;
  categoria: string;
  descricao: string;
  valor: number;
  pacienteId?: string;
  profissionalId?: string;
  data: Date;
  createdAt: Date;
}
