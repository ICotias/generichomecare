/**
 * Serviço de log de auditoria (client-side).
 *
 * Por enquanto, grava no console e na collection local.
 * Em produção, o ideal é gravar via Cloud Function para que
 * o usuário não tenha permissão de escrita direta no auditLog
 * (as rules atuais bloqueiam write: false).
 *
 * Enquanto Cloud Functions não estão configuradas, usamos
 * uma collection temporária `auditLogClient` que o user
 * pode escrever, ou simplesmente logamos localmente.
 *
 * Estrutura do log:
 *   auditLog/{logId}
 *     - action: string (ex: 'create_record', 'login', 'lgpd_consent')
 *     - userId: string
 *     - userRole: string
 *     - empresaId: string
 *     - details: Record<string, unknown>
 *     - timestamp: Timestamp
 *     - ip?: string (only via Cloud Function)
 */

import { Timestamp } from 'firebase/firestore';

export type AuditAction =
  | 'login'
  | 'logout'
  | 'lgpd_consent'
  | 'create_record'
  | 'create_patient'
  | 'update_patient'
  | 'create_nurse'
  | 'create_family'
  | 'shift_checkin'
  | 'shift_checkout'
  | 'export_report'
  | 'create_evolucao';

export interface AuditEntry {
  action: AuditAction;
  userId: string;
  userRole: string;
  empresaId: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ════════════════════════════════════════════
// In-memory buffer (will be persisted when Cloud Functions are ready)
// ════════════════════════════════════════════

const auditBuffer: AuditEntry[] = [];
const MAX_BUFFER = 200;

/**
 * Registra um evento de auditoria.
 *
 * Atualmente salva em memória e console.
 * Quando Cloud Functions estiverem prontas, enviar via HTTP callable.
 */
export const logAudit = (
  action: AuditAction,
  userId: string,
  userRole: string,
  empresaId: string,
  details?: Record<string, unknown>
): void => {
  const entry: AuditEntry = {
    action,
    userId,
    userRole,
    empresaId,
    details,
    timestamp: new Date(),
  };

  // Buffer in memory
  if (auditBuffer.length >= MAX_BUFFER) {
    auditBuffer.shift(); // Remove oldest
  }
  auditBuffer.push(entry);

  // Console log for dev
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(
      `[AUDIT] ${action} | user=${userId} | role=${userRole} | empresa=${empresaId}`,
      details ? JSON.stringify(details) : ''
    );
  }
};

/**
 * Retorna os logs de auditoria em memória (para debug/admin).
 */
export const getAuditBuffer = (): readonly AuditEntry[] => auditBuffer;

/**
 * Limpa o buffer (para testes).
 */
export const clearAuditBuffer = (): void => {
  auditBuffer.length = 0;
};

/**
 * Prepara um payload para Cloud Function (futuro).
 */
export const serializeForCloudFunction = (entry: AuditEntry) => ({
  ...entry,
  timestamp: Timestamp.fromDate(entry.timestamp),
});
