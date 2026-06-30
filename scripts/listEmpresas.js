/**
 * Lista as empresas existentes (id + nome) — útil para pegar o empresaId
 * e vincular um admin a uma empresa já existente.
 *
 * Pré-requisitos: igual ao createAdmin.js (firebase-admin + service-account.json).
 *
 * Uso:
 *   node scripts/listEmpresas.js
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

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
  const db = getFirestore();
  const snap = await db.collection('empresas').get();
  if (snap.empty) {
    console.log('Nenhuma empresa encontrada.');
    process.exit(0);
  }
  console.log('Empresas:\n');
  snap.forEach((doc) => {
    const d = doc.data();
    console.log('  empresaId: ' + doc.id);
    console.log('  nome:      ' + (d.nome || '(sem nome)'));
    console.log('  ownerUid:  ' + (d.ownerUid || '—'));
    console.log('  ' + '-'.repeat(40));
  });
  process.exit(0);
})().catch((e) => {
  console.error('Erro:', e.message || e);
  process.exit(1);
});
