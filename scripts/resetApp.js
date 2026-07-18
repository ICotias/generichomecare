/**
 * ZERA o app: apaga TODOS os dados do Firestore e TODAS as contas do Auth.
 *
 * ⚠️  DESTRUTIVO E IRREVERSÍVEL. Apaga empresas, pacientes, prontuários,
 * escalas, plantões, financeiro, usuários e o log de auditoria, além de todas
 * as contas de login. Use só para começar do zero em ambiente de teste.
 *
 * SEGURANÇA: sem a flag --yes, ele só MOSTRA o que apagaria e não escreve nada.
 *
 * COMO RODAR:
 *   node scripts/resetApp.js            # dry-run: lista o que existe hoje
 *   node scripts/resetApp.js --yes      # apaga de verdade
 *
 * Depois de zerar, rode `node scripts/seedMinimo.js` para recriar uma conta
 * de cada papel.
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

const CONFIRM = process.argv.includes('--yes');

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();
const auth = getAuth();

const TOP_COLLECTIONS = ['empresas', 'usuarios', 'auditLog'];

async function countAuthUsers() {
  let count = 0;
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    count += res.users.length;
    pageToken = res.pageToken;
  } while (pageToken);
  return count;
}

async function wipeAuth() {
  let total = 0;
  let pageToken;
  do {
    const res = await auth.listUsers(1000, pageToken);
    const uids = res.users.map((u) => u.uid);
    if (uids.length) {
      await auth.deleteUsers(uids);
      total += uids.length;
      console.log(`   contas Auth apagadas: ${total}`);
    }
    pageToken = res.pageToken;
  } while (pageToken);
  return total;
}

(async () => {
  // Diagnóstico do que existe hoje
  const authCount = await countAuthUsers();
  console.log('Estado atual:');
  for (const col of TOP_COLLECTIONS) {
    const snap = await db.collection(col).get();
    console.log(`   ${col}: ${snap.size} documento(s) no topo (subcoleções contam à parte)`);
  }
  console.log(`   contas Auth: ${authCount}`);

  if (!CONFIRM) {
    console.log('\nDRY-RUN. Nada foi apagado.');
    console.log('Para apagar de verdade: node scripts/resetApp.js --yes');
    process.exit(0);
  }

  console.log('\n--yes recebido. Apagando TUDO...\n');

  // Firestore: recursiveDelete apaga a coleção e todas as subcoleções.
  for (const col of TOP_COLLECTIONS) {
    await db.recursiveDelete(db.collection(col));
    console.log('   Firestore apagado:', col);
  }

  // Auth
  await wipeAuth();

  console.log('\n✓ App zerado. Rode `node scripts/seedMinimo.js` para recriar as contas.');
  process.exit(0);
})().catch((err) => {
  console.error('Erro no reset:', err);
  process.exit(1);
});
