/**
 * Mostra o perfil de um usuário pelo e-mail: uid, role e empresaId.
 * Útil para descobrir a qual empresa uma conta está vinculada.
 *
 * Pré-requisitos: firebase-admin + service-account.json (igual ao createAdmin.js).
 *
 * Uso:
 *   node scripts/findUser.js <email>
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const email = (process.argv[2] || '').trim().toLowerCase();
if (!email) {
  console.error('Uso: node scripts/findUser.js <email>');
  process.exit(1);
}

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

(async () => {
  const auth = getAuth();
  const db = getFirestore();

  let uid;
  try {
    uid = (await auth.getUserByEmail(email)).uid;
  } catch {
    console.log('Nenhum usuário no Auth com o e-mail:', email);
    process.exit(0);
  }

  const doc = await db.collection('usuarios').doc(uid).get();
  console.log('uid:      ' + uid);
  if (!doc.exists) {
    console.log('Perfil (usuarios/' + uid + ') NÃO existe no Firestore.');
    process.exit(0);
  }
  const d = doc.data();
  console.log('nome:      ' + (d.nome || '—'));
  console.log('role:      ' + (d.role || '—'));
  console.log('empresaId: ' + (d.empresaId || '(vazio)'));
  console.log('pacienteId:' + (d.pacienteId || '—'));
  process.exit(0);
})().catch((e) => {
  console.error('Erro:', e.message || e);
  process.exit(1);
});
