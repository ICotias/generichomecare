/**
 * Seed focado no paciente "Teste" — simula 7 dias de uso do app.
 *
 * Gera, para o paciente cujo nome é "Teste" (na empresa alvo):
 *   - Sinais vitais 2x/dia (alimentam o gráfico), com situações variadas
 *   - Alimentação (café, almoço, jantar) com aceitação/hidratação variáveis
 *   - Medicação (2x/dia), às vezes recusada ou com reação
 *   - Atividades (banho, higiene, mobilidade, fisioterapia, curativo)
 *   - Intercorrências em alguns dias (queda, febre, dispneia...)
 *   - Um plantão por dia (check-in/checkout)
 *
 * Cada dia tem um "cenário" diferente para variar valores e situações:
 *   estável, pico hipertensivo, febre, recuperação, queda, dessaturação, hoje.
 *
 * Idempotente: apaga só o que este script criou antes (marca seedTeste=true).
 * Não mexe em registros criados manualmente.
 *
 * Uso:  node scripts/seedPacienteTeste.js [empresaId] ["Nome do Paciente"]
 *       padrão: empresa clinica-generica-94hdol, paciente "Teste"
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const empresaId = process.argv[2] || 'clinica-generica-94hdol';
const nomePaciente = process.argv[3] || 'Teste';

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');
let serviceAccount;
try { serviceAccount = require(keyPath); }
catch { console.error('service-account.json não encontrado em: ' + keyPath); process.exit(1); }

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const chance = (p) => Math.random() < p;
const round1 = (n) => +n.toFixed(1);

const MEDS = [
  { medicamento: 'Losartana', dosagem: '50mg', via: 'oral' },
  { medicamento: 'Metformina', dosagem: '850mg', via: 'oral' },
  { medicamento: 'AAS', dosagem: '100mg', via: 'oral' },
  { medicamento: 'Omeprazol', dosagem: '20mg', via: 'oral' },
];
const ANTITERMICO = { medicamento: 'Dipirona', dosagem: '1g', via: 'oral' };

// Cenário por dia (do mais antigo para hoje)
const SCENARIOS = [
  { label: 'estável', vitals: 'normal', feed: 'boa', incident: null, extraAtiv: ['fisioterapia'] },
  { label: 'pico hipertensivo', vitals: 'hipertensao', feed: 'boa',
    incident: { tipo: 'dispneia', grav: 'leve', desc: 'Queixa de falta de ar leve ao esforço, melhora em repouso.', med: 'Cabeceira elevada e monitorização da pressão.' }, extraAtiv: [] },
  { label: 'febre', vitals: 'febre', feed: 'ruim',
    incident: { tipo: 'febre', grav: 'moderado', desc: 'Pico febril de 38.8 no fim da tarde, calafrios.', med: 'Antitérmico administrado e hidratação reforçada.' }, extraAtiv: ['higiene_oral'] },
  { label: 'recuperação', vitals: 'normal', feed: 'boa', incident: null, extraAtiv: ['fisioterapia', 'mobilidade'] },
  { label: 'queda', vitals: 'normal', feed: 'media',
    incident: { tipo: 'queda', grav: 'moderado', desc: 'Queda da própria altura ao levantar, sem perda de consciência.', med: 'Avaliado, sem sinais de fratura, orientado repouso.' }, extraAtiv: ['curativo'] },
  { label: 'dessaturação', vitals: 'hipoxemia', feed: 'media',
    incident: { tipo: 'dispneia', grav: 'grave', desc: 'Saturação caiu para 88 por cento com desconforto respiratório.', med: 'Oxigênio suplementar e contato com a equipe médica.' }, extraAtiv: [] },
  { label: 'hoje (estável)', vitals: 'normal', feed: 'boa', incident: null, extraAtiv: [], today: true },
];

function vitals(kind, isEvening) {
  // manhã tende a ser mais amena; o cenário aparece mais forte à noite
  const soft = !isEvening;
  if (kind === 'hipertensao' && !soft) {
    return { paSistolica: rand(150, 172), paDiastolica: rand(96, 106), fc: rand(88, 104),
      fr: rand(16, 20), temperatura: round1(36.3 + Math.random()), satO2: rand(93, 97), alerta: true };
  }
  if (kind === 'febre') {
    return { paSistolica: rand(112, 134), paDiastolica: rand(70, 86), fc: rand(94, 114),
      fr: rand(18, 23), temperatura: round1((soft ? 37.6 : 38.2) + Math.random() * (soft ? 0.5 : 1.0)),
      satO2: rand(92, 96), alerta: true };
  }
  if (kind === 'hipoxemia' && !soft) {
    return { paSistolica: rand(118, 138), paDiastolica: rand(72, 88), fc: rand(96, 116),
      fr: rand(20, 25), temperatura: round1(36.4 + Math.random()), satO2: rand(85, 91), alerta: true };
  }
  // normal
  return { paSistolica: rand(106, 134), paDiastolica: rand(66, 85), fc: rand(60, 88),
    fr: rand(13, 18), temperatura: round1(36.0 + Math.random() * 1.1), satO2: rand(95, 99), alerta: false };
}

const FEED = {
  boa: [100, 100, 75], media: [75, 50, 50], ruim: [50, 25, 0],
};
const REFS = [
  { ref: 'cafe', hora: 8 }, { ref: 'almoco', hora: 12 }, { ref: 'jantar', hora: 19 },
];

async function findNurse() {
  // tenta pela escala do paciente; senão, qualquer enfermeiro; senão, genérico
  try {
    const q = await db.collection('usuarios').where('role', '==', 'enfermeiro').limit(1).get();
    if (!q.empty) {
      const d = q.docs[0].data();
      return { uid: q.docs[0].id, nome: d.nome || 'Enfermeiro' };
    }
  } catch { /* ignore */ }
  return { uid: 'seed-teste', nome: 'Enfermeiro' };
}

(async () => {
  console.log('Empresa:', empresaId, '| paciente:', nomePaciente, '\n');
  const patsCol = db.collection('empresas').doc(empresaId).collection('pacientes');
  const plantoesCol = db.collection('empresas').doc(empresaId).collection('plantoes');

  const q = await patsCol.where('nome', '==', nomePaciente).limit(1).get();
  if (q.empty) { console.error(`Paciente "${nomePaciente}" não encontrado na empresa ${empresaId}.`); process.exit(1); }
  const pid = q.docs[0].id;
  console.log('Paciente encontrado:', pid);

  const nurse = await findNurse();
  console.log('Profissional dos registros:', nurse.nome, '\n');

  const regCol = patsCol.doc(pid).collection('registros');

  // ── Limpa apenas o que este script criou antes ──
  let apagados = 0;
  for (const d of (await regCol.where('seedTeste', '==', true).get()).docs) { await d.ref.delete(); apagados++; }
  for (const d of (await plantoesCol.where('pacienteId', '==', pid).where('seedTeste', '==', true).get()).docs) { await d.ref.delete(); apagados++; }
  if (apagados) console.log('Removidos', apagados, 'registros/plantões de um seed anterior.\n');

  const base = {
    empresaId, pacienteId: pid,
    profissionalId: nurse.uid, profissionalNome: nurse.nome,
    visibleToFamily: true, syncStatus: 'synced', seedTeste: true,
  };

  let batch = db.batch(); let nBatch = 0; let total = 0;
  const put = async (data) => {
    batch.set(regCol.doc(), data); nBatch++; total++;
    if (nBatch >= 400) { await batch.commit(); batch = db.batch(); nBatch = 0; }
  };

  for (let i = 0; i < 7; i++) {
    const d = 6 - i; // 6 dias atrás -> hoje
    const sc = SCENARIOS[i];
    const day = new Date(); day.setDate(day.getDate() - d);
    const at = (h, m) => { const t = new Date(day); t.setHours(h, m != null ? m : rand(0, 55), 0, 0); return Timestamp.fromDate(t); };

    // Plantão do dia
    const plantao = {
      empresaId, pacienteId: pid, pacienteNome: nomePaciente,
      profissionalId: nurse.uid, profissionalNome: nurse.nome,
      checkinAt: at(7, rand(0, 20)), checkinLat: -23.55, checkinLng: -46.63,
      status: sc.today && chance(0.5) ? 'em_andamento' : 'finalizado',
      seedTeste: true,
    };
    if (plantao.status === 'finalizado') {
      plantao.checkoutAt = at(13, rand(0, 40)); plantao.checkoutLat = -23.55; plantao.checkoutLng = -46.63;
    }
    await plantoesCol.add(plantao);

    // Sinais vitais 2x (manhã e noite; à noite aparece o cenário)
    for (const [h, evening] of [[8, false], [20, true]]) {
      if (sc.today && evening) continue; // hoje ainda não teve a medição da noite
      await put({ ...base, type: 'sinaisVitais', timestamp: at(h), ...vitals(sc.vitals, evening) });
    }

    // Alimentação 3x
    const aceit = FEED[sc.feed];
    for (let r = 0; r < REFS.length; r++) {
      if (sc.today && REFS[r].hora >= 14) continue; // hoje só até o almoço
      await put({
        ...base, type: 'alimentacao', timestamp: at(REFS[r].hora),
        tipoRefeicao: REFS[r].ref, aceitacao: aceit[r],
        consistencia: sc.feed === 'ruim' ? pick(['pastosa', 'normal']) : 'normal',
        hidratacaoMl: sc.feed === 'ruim' ? rand(60, 140) : rand(120, 260),
        ...(aceit[r] <= 25 ? { observacoes: 'Baixa aceitação, ofertado novamente mais tarde.' } : {}),
      });
    }

    // Medicação 2x (+ antitérmico em dia de febre)
    const meds = [{ h: 9, m: MEDS[0] }, { h: 21, m: MEDS[1] }];
    if (sc.vitals === 'febre') meds.push({ h: 17, m: ANTITERMICO });
    for (const mm of meds) {
      if (sc.today && mm.h >= 14) continue;
      const recusado = chance(0.07);
      await put({
        ...base, type: 'medicamento', timestamp: at(mm.h),
        medicamento: mm.m.medicamento, dosagem: mm.m.dosagem, via: mm.m.via,
        prescricaoId: '', recusado,
        ...(recusado ? { observacoes: 'Paciente recusou, será reofertado.' }
                     : (chance(0.1) ? { reacao: 'Leve sonolência após a dose.' } : {})),
      });
    }

    // Atividades (banho + higiene sempre; extras do cenário)
    const ativs = ['banho', 'higiene_oral', ...sc.extraAtiv];
    for (let a = 0; a < ativs.length; a++) {
      if (sc.today && a >= 2) continue;
      await put({ ...base, type: 'atividade', timestamp: at(10 + a), categoria: ativs[a] });
    }

    // Intercorrência do cenário
    if (sc.incident && !sc.today) {
      await put({
        ...base, type: 'intercorrencia', timestamp: at(rand(14, 21)),
        tipoIncidente: sc.incident.tipo, gravidade: sc.incident.grav,
        descricao: sc.incident.desc, medidasTomadas: sc.incident.med,
        notificouFamilia: sc.incident.grav !== 'leve',
      });
    }

    console.log(`Dia ${day.toLocaleDateString('pt-BR')}: ${sc.label}`);
  }

  if (nBatch > 0) await batch.commit();
  console.log(`\n✓ Pronto. ${total} registros criados para "${nomePaciente}" ao longo de 7 dias.`);
  process.exit(0);
})().catch((e) => { console.error('Erro:', e.message || e); process.exit(1); });
