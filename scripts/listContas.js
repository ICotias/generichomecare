/**
 * Lista todas as contas existentes: Firebase Auth cruzado com o perfil no Firestore.
 *
 * Mostra e-mail, papel, empresa (tenant), status e se o perfil está órfão
 * (conta no Auth sem documento em `usuarios`, ou o contrário).
 *
 * COMO RODAR:
 *   node scripts/listContas.js
 *
 * Pré-requisito: service-account.json na raiz.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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

const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

(async () => {
  // Empresas (para mostrar o nome em vez do id cru)
  const empresas = {};
  for (const d of (await db.collection('empresas').get()).docs) {
    empresas[d.id] = d.data().nome || d.id;
  }

  // Perfis no Firestore
  const perfis = {};
  for (const d of (await db.collection('usuarios').get()).docs) perfis[d.id] = d.data();

  // Contas no Auth
  const authUsers = [];
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    authUsers.push(...res.users);
    pageToken = res.pageToken;
  } while (pageToken);

  console.log(`\nEmpresas (${Object.keys(empresas).length}):`);
  for (const [id, nome] of Object.entries(empresas)) console.log(`  ${pad(id, 32)} ${nome}`);

  console.log(`\nContas no Auth: ${authUsers.length} | perfis no Firestore: ${Object.keys(perfis).length}\n`);
  console.log(pad('E-MAIL', 34), pad('PAPEL', 9), pad('EMPRESA', 26), pad('STATUS', 9), 'OBS');
  console.log('-'.repeat(100));

  const semPerfil = [];
  for (const u of authUsers.sort((a, b) => (a.email || '').localeCompare(b.email || ''))) {
    const p = perfis[u.uid];
    if (!p) {
      semPerfil.push(u.email || u.uid);
      console.log(pad(u.email || '(sem e-mail)', 34), pad('—', 9), pad('—', 26), pad('—', 9), 'SEM PERFIL no Firestore');
      continue;
    }
    const obs = [];
    if (p.mustChangePassword) obs.push('troca senha no 1º acesso');
    if (p.role === 'family' && p.familiaTitular === false) obs.push('acompanhante');
    if (p.role === 'family' && !p.pacienteId) obs.push('sem paciente');
    if (!p.empresaId) obs.push('SEM TENANT');
    console.log(
      pad(u.email || p.email, 34),
      pad(p.role, 9),
      pad(empresas[p.empresaId] || p.empresaId || '—', 26),
      pad(p.status || 'ativo', 9),
      obs.join(', ')
    );
  }

  // Perfis órfãos (documento sem conta no Auth)
  const uidsAuth = new Set(authUsers.map((u) => u.uid));
  const orfaos = Object.keys(perfis).filter((uid) => !uidsAuth.has(uid));
  if (orfaos.length) {
    console.log('\nPerfis no Firestore sem conta no Auth (órfãos):');
    for (const uid of orfaos) console.log(`  ${uid}  ${perfis[uid].email || ''}`);
  }
  if (semPerfil.length) {
    console.log(`\nContas no Auth sem perfil: ${semPerfil.length}. Elas caem no Setup ao entrar.`);
  }

  // Pacientes por empresa
  console.log('\nPacientes por empresa:');
  for (const id of Object.keys(empresas)) {
    const snap = await db.collection(`empresas/${id}/pacientes`).get();
    const linhas = snap.docs.map((d) => {
      const n = (d.data().enfermeirosAutorizados || []).length;
      return `${d.data().nome} (${n} enfermeiro${n === 1 ? '' : 's'} autorizado${n === 1 ? '' : 's'})`;
    });
    console.log(`  ${empresas[id]}: ${linhas.length ? linhas.join(', ') : 'nenhum'}`);
  }

  console.log('');
  process.exit(0);
})().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
