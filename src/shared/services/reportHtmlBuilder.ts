/**
 * Gera HTML para o relatório PDF do paciente.
 *
 * Usado por ExportReportScreen — converte registros de cuidados
 * em um documento HTML estilizado pronto para react-native-html-to-pdf.
 */
import type { Patient } from '../../core/types';
import type { CareRecord, VitalSignsRecord } from '../../core/types';

// ════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════

const fmtDate = (d: Date) =>
  d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

const fmtTime = (d: Date) =>
  d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

const fmtDateTime = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}`;

const calcAge = (birth: Date): number => {
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
};

// ════════════════════════════════════════════
// Record renderers
// ════════════════════════════════════════════

const TYPE_LABELS: Record<string, string> = {
  medicamento: 'Medicamento',
  sinaisVitais: 'Sinais Vitais',
  alimentacao: 'Alimentação',
  atividade: 'Atividade',
  intercorrencia: 'Intercorrência',
  foto: 'Foto',
};

const TYPE_COLORS: Record<string, string> = {
  medicamento: '#8B5CF6',
  sinaisVitais: '#EF4444',
  alimentacao: '#F59E0B',
  atividade: '#10B981',
  intercorrencia: '#DC2626',
  foto: '#3B82F6',
};

const renderRecord = (r: CareRecord): string => {
  const color = TYPE_COLORS[r.type] ?? '#6B7280';
  const label = TYPE_LABELS[r.type] ?? r.type;

  let details = '';

  switch (r.type) {
    case 'medicamento':
      details = `<b>${r.medicamento}</b>: ${r.dosagem} (${r.via})${r.recusado ? ' <span style="color:#DC2626">[RECUSADO]</span>' : ''}`;
      break;
    case 'sinaisVitais': {
      const v = r as VitalSignsRecord;
      details = `PA ${v.paSistolica}/${v.paDiastolica} · FC ${v.fc} · T ${v.temperatura}°C · SpO₂ ${v.satO2}% · FR ${v.fr}${v.alerta ? ' <span style="color:#DC2626">[ALERTA]</span>' : ''}`;
      break;
    }
    case 'alimentacao':
      details = `Aceitação: ${r.aceitacao}% · Via: ${r.consistencia}`;
      break;
    case 'atividade':
      details = `Categoria: ${r.categoria}`;
      break;
    case 'intercorrencia':
      details = `<b>${r.tipoIncidente}</b> · Gravidade: ${r.gravidade}${r.descricao ? ` · ${r.descricao}` : ''}`;
      break;
    case 'foto':
      details = `${r.fotoClinica ? '[Foto clínica] ' : ''}Registro fotográfico`;
      break;
    default:
      details = '';
  }

  return `
    <tr>
      <td style="white-space:nowrap;color:#6B7280;font-size:12px;padding:8px 12px;border-bottom:1px solid #E5E7EB;">
        ${fmtDateTime(r.timestamp)}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;">
        <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;color:#fff;background:${color}">
          ${label}
        </span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;font-size:13px;">
        ${details}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;">
        ${r.profissionalNome}
      </td>
    </tr>`;
};

// ════════════════════════════════════════════
// Main builder
// ════════════════════════════════════════════

interface BuildHtmlOptions {
  patient: Patient;
  records: CareRecord[];
  startDate: Date;
  endDate: Date;
  empresaNome?: string;
}

export const buildReportHtml = ({
  patient,
  records,
  startDate,
  endDate,
  empresaNome,
}: BuildHtmlOptions): string => {
  const periodLabel = `${fmtDate(startDate)} a ${fmtDate(endDate)}`;

  // Count per type
  const counts: Record<string, number> = {};
  for (const r of records) {
    counts[r.type] = (counts[r.type] ?? 0) + 1;
  }

  const summaryItems = Object.entries(counts)
    .map(
      ([type, count]) =>
        `<div style="text-align:center;padding:8px 16px">
          <div style="font-size:24px;font-weight:700;color:${TYPE_COLORS[type] ?? '#6B7280'}">${count}</div>
          <div style="font-size:11px;color:#6B7280">${TYPE_LABELS[type] ?? type}</div>
        </div>`
    )
    .join('');

  const recordRows = records.map(renderRecord).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; color:#1F2937; line-height:1.5; padding:32px; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; padding-bottom:16px; border-bottom:2px solid #2563EB; }
    .logo-area h1 { font-size:20px; color:#2563EB; margin-bottom:4px; }
    .logo-area p { font-size:12px; color:#6B7280; }
    .patient-card { background:#F9FAFB; border:1px solid #E5E7EB; border-radius:8px; padding:16px; margin-bottom:24px; }
    .patient-card h2 { font-size:18px; margin-bottom:8px; }
    .patient-meta { display:flex; gap:24px; flex-wrap:wrap; font-size:13px; color:#6B7280; }
    .summary-row { display:flex; gap:16px; flex-wrap:wrap; margin-bottom:24px; background:#F9FAFB; border-radius:8px; padding:12px; justify-content:center; border:1px solid #E5E7EB; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th { text-align:left; padding:10px 12px; background:#F3F4F6; font-size:11px; font-weight:700; color:#6B7280; text-transform:uppercase; letter-spacing:0.5px; border-bottom:2px solid #E5E7EB; }
    .footer { margin-top:32px; padding-top:12px; border-top:1px solid #E5E7EB; font-size:11px; color:#9CA3AF; text-align:center; }
    @media print { body { padding:16px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo-area">
      <h1>Benevita</h1>
      <p>Relatório de Cuidados</p>
    </div>
    <div style="text-align:right;font-size:12px;color:#6B7280">
      ${empresaNome ? `<div>${empresaNome}</div>` : ''}
      <div>Período: ${periodLabel}</div>
      <div>Gerado em: ${fmtDateTime(new Date())}</div>
    </div>
  </div>

  <div class="patient-card">
    <h2>${patient.nome}</h2>
    <div class="patient-meta">
      <span>${calcAge(patient.dataNascimento)} anos</span>
      <span>CPF: ${patient.cpf}</span>
      <span>Tipo: ${patient.tipoAtendimento}</span>
      <span>Status: ${patient.status.toUpperCase()}</span>
    </div>
    ${patient.diagnosticos.length > 0 ? `<div style="margin-top:8px;font-size:13px"><b>Diagnósticos:</b> ${patient.diagnosticos.join(', ')}</div>` : ''}
    ${patient.alergias.length > 0 ? `<div style="margin-top:4px;font-size:13px;color:#DC2626"><b>Alergias:</b> ${patient.alergias.join(', ')}</div>` : ''}
  </div>

  <div class="summary-row">${summaryItems}</div>

  ${records.length > 0 ? `
  <table>
    <thead>
      <tr>
        <th>Data / Hora</th>
        <th>Tipo</th>
        <th>Detalhes</th>
        <th>Profissional</th>
      </tr>
    </thead>
    <tbody>
      ${recordRows}
    </tbody>
  </table>
  ` : '<p style="text-align:center;color:#6B7280;padding:40px 0">Nenhum registro encontrado neste período.</p>'}

  <div class="footer">
    Benevita App · Relatório gerado automaticamente · ${fmtDate(new Date())}
  </div>
</body>
</html>`;
};
