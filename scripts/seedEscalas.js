/**
 * Popula ALGUMAS escalas REAIS para apresentação (não muitas).
 * Vincula um enfermeiro real a pacientes reais da empresa, em alguns dias
 * da semana — incluindo HOJE (pra demonstrar o card "Minha escala" e o
 * check-in restrito à escala do dia).
 *
 * ⚠️ Limpa as escalas existentes da empresa antes de criar (deixa o conjunto
 * enxuto para a demo).
 *
 * Pré-requisitos: firebase-admin + service-account.json (como nos outros scripts).
 *
 * Uso:
 *   node scripts/seedEscalas.js [empresaId]
 *   (empresaId padrão: clinica-generica-94hdol)
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const empresaId = process.argv[2] || 'clinica-generica-94hdol';

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch {
  console.error('service-account.json não encontrado em: ' + keyPath);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

(async () => {
  // 1. Enfermeiros ativos da empresa
  const nursesSnap = await db
    .collection('usuarios')
    .where('empresaId', '==', empresaId)
    .where('role', '==', 'nurse')
    .get();
  const nurses = nursesSnap.docs
    .map((d) => ({ uid: d.id, ...d.data() }))
    .filter((n) => n.ativo !== false && n.status !== 'inativo' && n.status !== 'excluido');

  if (nurses.length === 0) {
    console.error('Nenhum enfermeiro ativo na empresa ' + empresaId + '. Cadastre um profissional antes.');
    process.exit(1);
  }

  // 2. Pacientes ativos da empresa
  const patSnap = await db.collection('empresas').doc(empresaId).collection('pacientes').get();
  const patients = patSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((p) => p.status === 'ativo');

  if (patients.length === 0) {
    console.error('Nenhum paciente ativo na empresa. Cadastre um paciente antes.');
    process.exit(1);
  }

  const nurse = nurses[0];
  const escalasRef = db.collection('empresas').doc(empresaId).collection('escalas');

  // 3. Limpa escalas existentes (demo enxuta)
  const existing = await escalasRef.get();
  for (const d of existing.docs) await d.ref.delete();
  console.log('Removidas ' + existing.size + ' escala(s) anterior(es).');

  // 4. Cria algumas escalas: HOJE + mais dois dias
  const today = new Date().getDay();
  const plan = [
    { dia: today, pac: patients[0], ini: '07:00', fim: '13:00' },
    { dia: (today + 2) % 7, pac: patients[1 % patients.length], ini: '13:00', fim: '19:00' },
    { dia: (today + 4) % 7, pac: patients[0], ini: '07:00', fim: '13:00' },
  ];

  for (const p of plan) {
    await escalasRef.add({
      empresaId,
      profissionalId: nurse.uid,
      profissionalNome: nurse.nome ?? 'Profissional',
      pacienteId: p.pac.id,
      pacienteNome: p.pac.nome ?? 'Paciente',
      diaSemana: p.dia,
      horaInicio: p.ini,
      horaFim: p.fim,
      ativo: true,
      createdAt: Timestamp.now(),
    });
    console.log(`✓ ${WEEKDAYS[p.dia]} ${p.ini}-${p.fim} — ${nurse.nome} × ${p.pac.nome}`);
  }

  console.log('\nPronto! ' + plan.length + ' escalas criadas (uma para HOJE).');
  process.exit(0);
})().catch((e) => {
  console.error('Erro:', e.message || e);
  process.exit(1);
});
