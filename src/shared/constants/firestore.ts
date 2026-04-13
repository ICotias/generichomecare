/**
 * Paths das collections no Firestore
 *
 * Estrutura:
 * empresas/{empresaId}
 *   └── pacientes/{pacienteId}
 *         ├── prescricoes/{prescricaoId}
 *         ├── registros/{registroId}
 *         └── evolucoes/{evolucaoId}
 *   └── escalas/{escalaId}
 *   └── plantoes/{plantaoId}
 *   └── financeiro/{financeiroId}
 * usuarios/{uid}
 * auditLog/{logId}
 */
export const Collections = {
  EMPRESAS: 'empresas',
  USUARIOS: 'usuarios',
  AUDIT_LOG: 'auditLog',

  // Subcollections de empresas
  pacientes: (empresaId: string) => `empresas/${empresaId}/pacientes`,
  escalas: (empresaId: string) => `empresas/${empresaId}/escalas`,
  plantoes: (empresaId: string) => `empresas/${empresaId}/plantoes`,
  financeiro: (empresaId: string) => `empresas/${empresaId}/financeiro`,

  // Subcollections de pacientes
  prescricoes: (empresaId: string, pacienteId: string) =>
    `empresas/${empresaId}/pacientes/${pacienteId}/prescricoes`,
  registros: (empresaId: string, pacienteId: string) =>
    `empresas/${empresaId}/pacientes/${pacienteId}/registros`,
  evolucoes: (empresaId: string, pacienteId: string) =>
    `empresas/${empresaId}/pacientes/${pacienteId}/evolucoes`,
} as const;
