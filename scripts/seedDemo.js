/**
 * Seed COMPLETO de demonstração — uma semana de funcionamento.
 *
 * Cria (na empresa alvo):
 *   - 5 enfermeiros (contas Auth + perfil), senha padrão
 *   - 10 pacientes (cadastro completo), divididos entre os enfermeiros (2 cada)
 *   - 2 familiares por paciente (20 contas Auth + perfil), vinculados
 *   - Escalas: os 5 enfermeiros escalados HOJE + em dias variados
 *   - ~7 dias de registros por paciente: sinais vitais (alimentam o gráfico),
 *     alimentação, medicação, atividade e algumas intercorrências
 *   - Plantões (check-in/checkout) ao longo da semana
 *
 * Idempotente: reusa contas por e-mail e remove os dados demo anteriores
 * (pacientes com demoSeed=true + escalas + plantões) antes de recriar.
 * NÃO mexe em pacientes que você criou manualmente (sem demoSeed).
 *
 * Pré-requisitos: firebase-admin + service-account.json.
 * Uso:  node scripts/seedDemo.js [empresaId]
 *       (padrão: clinica-generica-94hdol)   Senha de todas as contas: Demo@123
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

const empresaId = process.argv[2] || 'clinica-generica-94hdol';
const PASSWORD = 'Demo@123';

const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');
let serviceAccount;
try { serviceAccount = require(keyPath); }
catch { console.error('service-account.json não encontrado em: ' + keyPath); process.exit(1); }

initializeApp({ credential: cert(serviceAccount) });
const auth = getAuth();
const db = getFirestore();

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[rand(0, arr.length - 1)];
const chance = (p) => Math.random() < p;

const NURSES = [
  { nome: 'Ana Paula Costa', coren: 'COREN-SP 100001' },
  { nome: 'Bruno Santos', coren: 'COREN-SP 100002' },
  { nome: 'Carla Oliveira', coren: 'COREN-SP 100003' },
  { nome: 'Diego Lima', coren: 'COREN-SP 100004' },
  { nome: 'Elaine Ferreira', coren: 'COREN-SP 100005' },
];

const PATIENTS = [
  { nome: 'Maria Souza', genero: 'feminino', idade: 78, diag: ['Hipertensão', 'Diabetes tipo 2'], alergias: ['Dipirona'] },
  { nome: 'João Silva', genero: 'masculino', idade: 82, diag: ['Alzheimer'], alergias: [] },
  { nome: 'Antônia Ferreira', genero: 'feminino', idade: 90, diag: ['Demência senil', 'Osteoporose'], alergias: ['Penicilina'] },
  { nome: 'Carlos Mendes', genero: 'masculino', idade: 71, diag: ['DPOC'], alergias: [] },
  { nome: 'Rosa Almeida', genero: 'feminino', idade: 85, diag: ['AVC prévio', 'Hipertensão'], alergias: [] },
  { nome: 'José Pereira', genero: 'masculino', idade: 68, diag: ['Insuficiência cardíaca'], alergias: ['AAS'] },
  { nome: 'Lúcia Ramos', genero: 'feminino', idade: 79, diag: ['Parkinson'], alergias: [] },
  { nome: 'Pedro Gomes', genero: 'masculino', idade: 74, diag: ['Diabetes tipo 2', 'Retinopatia'], alergias: [] },
  { nome: 'Terezinha Dias', genero: 'feminino', idade: 88, diag: ['Fratura de fêmur (pós-op)'], alergias: ['Sulfa'] },
  { nome: 'Manuel Rocha', genero: 'masculino', idade: 76, diag: ['Hipertensão'], alergias: [] },
];

const BASE_RANGE = {
  paSistolicaMin: 100, paSistolicaMax: 140,
  paDiastolicaMin: 60, paDiastolicaMax: 90,
  fcMin: 55, fcMax: 95, frMin: 12, frMax: 20,
  tempMin: 35.8, tempMax: 37.5, satO2Min: 92,
};

const REFEICOES = ['cafe', 'almoco', 'jantar'];
const ATIVIDADES = ['banho', 'higiene_oral', 'mobilidade', 'fisioterapia'];
const INTERCORR = ['queda', 'febre', 'dispneia', 'agitacao', 'outro'];
const GRAVIDADES = ['leve', 'moderado', 'grave'];
const VIAS = ['oral', 'sublingual', 'intramuscular'];
const MEDS = [
  { medicamento: 'Losartana', dosagem: '50mg' },
  { medicamento: 'Metformina', dosagem: '850mg' },
  { medicamento: 'AAS', dosagem: '100mg' },
  { medicamento: 'Omeprazol', dosagem: '20mg' },
];

// Batcher (limite 450 por commit)
function makeBatcher() {
  let batch = db.batch();
  let n = 0;
  let total = 0;
  return {
    set: async (ref, data) => {
      batch.set(ref, data);
      n++; total++;
      if (n >= 450) { await batch.commit(); batch = db.batch(); n = 0; }
    },
    flush: async () => { if (n > 0) { await batch.commit(); n = 0; } return total; },
  };
}

async function upsertAuthUser(email, nome) {
  try {
    const u = await auth.createUser({ email, password: PASSWORD, displayName: nome });
    return u.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') return (await auth.getUserByEmail(email)).uid;
    throw e;
  }
}

(async () => {
  console.log('Empresa:', empresaId, '| senha das contas:', PASSWORD, '\n');

  // ── Limpa dados demo anteriores ──
  const escalasCol = db.collection('empresas').doc(empresaId).collection('escalas');
  const plantoesCol = db.collection('empresas').doc(empresaId).collection('plantoes');
  const patsCol = db.collection('empresas').doc(empresaId).collection('pacientes');
  const financeiroCol = db.collection('empresas').doc(empresaId).collection('financeiro');

  for (const d of (await escalasCol.get()).docs) await d.ref.delete();
  for (const d of (await plantoesCol.get()).docs) await d.ref.delete();
  for (const d of (await financeiroCol.get()).docs) await d.ref.delete();
  const oldDemoPats = (await patsCol.where('demoSeed', '==', true).get()).docs;
  for (const p of oldDemoPats) {
    for (const r of (await p.ref.collection('registros').get()).docs) await r.ref.delete();
    await p.ref.delete();
  }
  console.log(`Limpeza: ${oldDemoPats.length} paciente(s) demo removido(s).\n`);

  const now = Timestamp.now();

  // ── 1. Enfermeiros ──
  const nurses = [];
  for (let i = 0; i < NURSES.length; i++) {
    const email = `enfermeiro${i + 1}@demo.com`;
    const uid = await upsertAuthUser(email, NURSES[i].nome);
    await db.collection('usuarios').doc(uid).set({
      email, nome: NURSES[i].nome, role: 'nurse', empresaId,
      telefone: '', coren: NURSES[i].coren, status: 'ativo', ativo: true,
      mustChangePassword: false, createdAt: now, updatedAt: now,
    }, { merge: true });
    nurses.push({ uid, ...NURSES[i], email });
    console.log(`Enfermeiro: ${email}  (${NURSES[i].nome})`);
  }

  // ── 2. Pacientes (2 por enfermeiro) ──
  const patients = [];
  for (let i = 0; i < PATIENTS.length; i++) {
    const p = PATIENTS[i];
    const nurse = nurses[i % nurses.length];
    const birth = new Date();
    birth.setFullYear(birth.getFullYear() - p.idade);
    const ref = patsCol.doc();
    await ref.set({
      empresaId, nome: p.nome,
      dataNascimento: Timestamp.fromDate(birth),
      cpf: '', genero: p.genero,
      endereco: { rua: 'Rua Demo', numero: String(100 + i), bairro: 'Centro', cidade: 'São Paulo', estado: 'SP', cep: '01000-000' },
      contatoEmergencia: { nome: 'Contato ' + p.nome, parentesco: 'Familiar', telefone: '(11) 90000-0000' },
      diagnosticos: p.diag, alergias: p.alergias,
      tipoAtendimento: 'integral', status: 'ativo',
      faixaSinaisVitais: BASE_RANGE,
      origemDados: 'equipe', validadoPorEquipe: true, cadastroCompleto: true,
      criadoPorUid: nurse.uid, demoSeed: true,
      enfermeiroResponsavelId: nurse.uid,
      createdAt: now, updatedAt: now,
    });
    patients.push({ id: ref.id, nurse, ...p });
  }
  console.log(`\n${patients.length} pacientes criados (2 por enfermeiro).`);

  // ── 3. Familiares (2 por paciente) ──
  const parentescos = ['Filho(a)', 'Cônjuge', 'Neto(a)', 'Irmão(ã)'];
  for (let i = 0; i < patients.length; i++) {
    for (const suf of ['a', 'b']) {
      const email = `familia${i + 1}${suf}@demo.com`;
      const nome = `Familiar ${suf.toUpperCase()} de ${patients[i].nome.split(' ')[0]}`;
      const uid = await upsertAuthUser(email, nome);
      await db.collection('usuarios').doc(uid).set({
        email, nome, role: 'family', empresaId,
        telefone: '', pacienteId: patients[i].id, parentesco: pick(parentescos),
        status: 'ativo', mustChangePassword: false, createdAt: now, updatedAt: now,
      }, { merge: true });
    }
  }
  console.log(`${patients.length * 2} familiares criados (2 por paciente).`);

  // ── 4. Escalas: todos HOJE + dias variados ──
  const today = new Date().getDay();
  for (let i = 0; i < patients.length; i++) {
    const pt = patients[i];
    const dia = i < nurses.length ? today : (today + i) % 7; // primeiros garantem "todos hoje"
    await escalasCol.add({
      empresaId, profissionalId: pt.nurse.uid, profissionalNome: pt.nurse.nome,
      pacienteId: pt.id, pacienteNome: pt.nome,
      diaSemana: dia, horaInicio: i % 2 ? '13:00' : '07:00', horaFim: i % 2 ? '19:00' : '13:00',
      ativo: true, createdAt: now,
    });
  }
  console.log('Escalas criadas (os 5 enfermeiros escalados para hoje + dias variados).');

  // ── 5. Registros da semana + plantões ──
  const batcher = makeBatcher();
  let plantaoCount = 0;
  for (const pt of patients) {
    const regCol = patsCol.doc(pt.id).collection('registros');
    for (let d = 6; d >= 0; d--) {
      const day = new Date(); day.setDate(day.getDate() - d);

      // Plantão do dia (finalizado; o de hoje fica em andamento p/ alguns)
      const checkin = new Date(day); checkin.setHours(7, rand(0, 20), 0, 0);
      const plantaoData = {
        empresaId, pacienteId: pt.id, pacienteNome: pt.nome,
        profissionalId: pt.nurse.uid, profissionalNome: pt.nurse.nome,
        checkinAt: Timestamp.fromDate(checkin),
        checkinLat: -23.55, checkinLng: -46.63,
        status: d === 0 && chance(0.5) ? 'em_andamento' : 'finalizado',
      };
      if (plantaoData.status === 'finalizado') {
        const out = new Date(day); out.setHours(13, rand(0, 40), 0, 0);
        plantaoData.checkoutAt = Timestamp.fromDate(out);
        plantaoData.checkoutLat = -23.55; plantaoData.checkoutLng = -46.63;
      }
      await batcher.set(plantoesCol.doc(), plantaoData);
      plantaoCount++;

      const base = { empresaId, pacienteId: pt.id, profissionalId: pt.nurse.uid, profissionalNome: pt.nurse.nome, visibleToFamily: true, syncStatus: 'synced' };

      // Sinais vitais (2x/dia) — alimenta o gráfico
      for (const hour of [8, 20]) {
        const ts = new Date(day); ts.setHours(hour, rand(0, 59), 0, 0);
        const out = chance(0.15); // ~15% fora da faixa (alerta)
        await batcher.set(regCol.doc(), {
          ...base, type: 'sinaisVitais', timestamp: Timestamp.fromDate(ts),
          paSistolica: out ? rand(150, 175) : rand(105, 135),
          paDiastolica: out ? rand(95, 105) : rand(65, 85),
          fc: out ? rand(100, 120) : rand(60, 88),
          fr: rand(13, 19),
          temperatura: out ? +(38 + Math.random()).toFixed(1) : +(36 + Math.random() * 1.3).toFixed(1),
          satO2: out ? rand(85, 91) : rand(94, 99),
          alerta: out,
        });
      }

      // Alimentação (3x)
      for (const ref of REFEICOES) {
        const ts = new Date(day); ts.setHours(ref === 'cafe' ? 8 : ref === 'almoco' ? 12 : 19, rand(0, 40), 0, 0);
        await batcher.set(regCol.doc(), {
          ...base, type: 'alimentacao', timestamp: Timestamp.fromDate(ts),
          tipoRefeicao: ref, aceitacao: pick([100, 100, 75, 50, 0]),
          consistencia: 'normal', hidratacaoMl: rand(100, 250),
        });
      }

      // Medicação (2x)
      for (const hour of [9, 21]) {
        const ts = new Date(day); ts.setHours(hour, rand(0, 40), 0, 0);
        const m = pick(MEDS);
        await batcher.set(regCol.doc(), {
          ...base, type: 'medicamento', timestamp: Timestamp.fromDate(ts),
          medicamento: m.medicamento, dosagem: m.dosagem, via: pick(VIAS),
          prescricaoId: '', recusado: chance(0.08),
        });
      }

      // Atividade (1x)
      const at = new Date(day); at.setHours(10, rand(0, 40), 0, 0);
      await batcher.set(regCol.doc(), {
        ...base, type: 'atividade', timestamp: Timestamp.fromDate(at),
        categoria: pick(ATIVIDADES), participacao: pick(['ativo', 'assistido', 'passivo']),
        duracaoMinutos: rand(15, 45),
      });

      // Intercorrência (~18% dos dias)
      if (chance(0.18)) {
        const it = new Date(day); it.setHours(rand(6, 22), rand(0, 59), 0, 0);
        const grav = pick(GRAVIDADES);
        await batcher.set(regCol.doc(), {
          ...base, type: 'intercorrencia', timestamp: Timestamp.fromDate(it),
          tipoIncidente: pick(INTERCORR), gravidade: grav,
          descricao: 'Intercorrência registrada durante o plantão.',
          medidasTomadas: 'Paciente avaliado e monitorado.',
          notificouFamilia: grav !== 'leve',
        });
      }
    }
  }
  const totalRegs = await batcher.flush();
  console.log(`\nRegistros + plantões gravados: ${totalRegs} docs (~${plantaoCount} plantões).`);

  console.log('\n✓ Seed concluído! Contas: enfermeiro1..5@demo.com e familia1a/1b..10a/10b@demo.com — senha ' + PASSWORD);
  process.exit(0);
})().catch((e) => { console.error('Erro:', e.message || e); process.exit(1); });
