/**
 * Cria o mínimo para testar: 1 empresa, 1 admin, 1 enfermeiro, 1 família e
 * 1 paciente, tudo amarrado e coerente.
 *
 *   - admin@benevita.test    → dono da empresa
 *   - enfermeiro@benevita.test → autorizado no paciente (vê ele)
 *   - familia@benevita.test  → titular, vinculada ao paciente
 *   - paciente "Dona Teste"  → cadastro completo, ativo
 *
 * Senha de todas: Demo@123. Sem mustChangePassword, para logar direto.
 *
 * Idempotente: se a conta já existir no Auth, reaproveita e reescreve o perfil.
 * Rode depois do resetApp.js para um estado limpo.
 *
 * COMO RODAR:
 *   node scripts/seedMinimo.js
 *
 * Pré-requisito: service-account.json na raiz.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const path = require('path');

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
const auth = getAuth();

const PASSWORD = 'Demo@123';
const EMPRESA_ID = 'clinica-benevita-demo';

const VITAIS = {
  paSistolicaMin: 100, paSistolicaMax: 150,
  paDiastolicaMin: 60, paDiastolicaMax: 90,
  fcMin: 50, fcMax: 100,
  frMin: 12, frMax: 22,
  tempMin: 35.5, tempMax: 37.5,
  satO2Min: 92,
};

/** Cria a conta no Auth (ou reaproveita) e devolve o uid, com senha conhecida. */
async function upsertAuth(email, nome) {
  try {
    const u = await auth.createUser({ email, password: PASSWORD, displayName: nome });
    return u.uid;
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(email);
      await auth.updateUser(u.uid, { password: PASSWORD, displayName: nome });
      return u.uid;
    }
    throw e;
  }
}

(async () => {
  const now = Timestamp.now();

  // 1. Admin (precisa do uid antes, para ser ownerUid da empresa)
  const adminUid = await upsertAuth('admin@benevita.test', 'Admin Teste');

  // 2. Empresa (dona = admin)
  await db.collection('empresas').doc(EMPRESA_ID).set({
    nome: 'Clínica Benevita Demo',
    ownerUid: adminUid,
    tipo: 'empresa',
    createdAt: now,
    updatedAt: now,
  });

  await db.collection('usuarios').doc(adminUid).set({
    uid: adminUid,
    email: 'admin@benevita.test',
    nome: 'Admin Teste',
    role: 'admin',
    empresaId: EMPRESA_ID,
    telefone: '(75) 90000-0001',
    status: 'ativo',
    ativo: true,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  // 3. Enfermeiro
  const nurseUid = await upsertAuth('enfermeiro@benevita.test', 'Enfermeiro Teste');
  await db.collection('usuarios').doc(nurseUid).set({
    uid: nurseUid,
    email: 'enfermeiro@benevita.test',
    nome: 'Enfermeiro Teste',
    role: 'nurse',
    empresaId: EMPRESA_ID,
    telefone: '(75) 90000-0002',
    corenRegistro: {
      uf: 'BA', numero: '123456', categoria: 'enfermeiro',
      verificado: true, verificadoEm: now, verificadoPorUid: adminUid,
    },
    status: 'ativo',
    ativo: true,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  // 4. Paciente (autorizado ao enfermeiro, cadastro completo)
  const pacienteRef = await db.collection(`empresas/${EMPRESA_ID}/pacientes`).add({
    empresaId: EMPRESA_ID,
    nome: 'Dona Teste',
    dataNascimento: Timestamp.fromDate(new Date('1948-05-10')),
    cpf: '',
    genero: 'feminino',
    endereco: { rua: 'Rua Demo', numero: '100', bairro: 'Centro', cidade: 'Feira de Santana', estado: 'BA', cep: '44000-000' },
    contatoEmergencia: { nome: 'Família Teste', parentesco: 'Filho(a)', telefone: '(75) 90000-0003' },
    diagnosticos: ['Hipertensão'],
    alergias: [],
    tipoAtendimento: 'integral',
    status: 'ativo',
    faixaSinaisVitais: VITAIS,
    origemDados: 'equipe',
    validadoPorEquipe: true,
    cadastroCompleto: true,
    criadoPorUid: adminUid,
    enfermeirosAutorizados: [nurseUid],
    createdAt: now,
    updatedAt: now,
  });

  // 5. Família titular, vinculada ao paciente
  const familyUid = await upsertAuth('familia@benevita.test', 'Família Teste');
  await db.collection('usuarios').doc(familyUid).set({
    uid: familyUid,
    email: 'familia@benevita.test',
    nome: 'Família Teste',
    role: 'family',
    empresaId: EMPRESA_ID,
    telefone: '(75) 90000-0003',
    pacienteId: pacienteRef.id,
    parentesco: 'filho',
    familiaTitular: true,
    status: 'ativo',
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  });

  console.log('\n✓ Seed mínimo criado. Senha de todas: ' + PASSWORD + '\n');
  console.log('  Admin:      admin@benevita.test');
  console.log('  Enfermeiro: enfermeiro@benevita.test');
  console.log('  Família:    familia@benevita.test');
  console.log('  Paciente:   Dona Teste (' + pacienteRef.id + ')');
  console.log('  Empresa:    ' + EMPRESA_ID);
  process.exit(0);
})().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
