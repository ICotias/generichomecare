export interface Shift {
  id: string;
  empresaId: string;
  pacienteId: string;
  profissionalId: string;
  profissionalNome: string;
  checkinAt: Date;
  checkinLat: number;
  checkinLng: number;
  checkoutAt?: Date;
  checkoutLat?: number;
  checkoutLng?: number;
  status: 'em_andamento' | 'finalizado';
}

// Passagem de plantão — método SBAR
export interface ShiftHandoff {
  id: string;
  empresaId: string;
  pacienteId: string;
  profissionalId: string;
  plantaoId: string;
  situacao: string;        // S — Situação atual do paciente
  ocorrencias: string;     // B — Background / o que aconteceu no plantão
  pendencias: string;      // A — Assessment / pendências
  orientacoes: string;     // R — Recommendation / orientações pro próximo
  observacoesLivres?: string;
  timestamp: Date;
}

export interface Schedule {
  id: string;
  empresaId: string;
  pacienteId: string;
  profissionalId: string;
  diaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=dom, 6=sáb
  horaInicio: string; // "07:00"
  horaFim: string;    // "19:00"
  ativo: boolean;
}
