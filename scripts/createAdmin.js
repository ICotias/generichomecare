/**
 * Cria (ou atualiza) uma conta de ADMIN no HomeCare:
 *   1. usuário no Firebase Auth (e-mail + senha)
 *   2. documento usuarios/{uid} com role: 'admin'
 *
 * Usa o Firebase Admin SDK (ignora as security rules — por isso só roda
 * localmente, com a sua chave de service account; nunca no app/cliente).
 *
 * ── Pré-requisitos ──
 *   1. yarn add -D firebase-admin
 *   2. Gerar a chave de service account:
 *        Firebase Console > Configurações do projeto > Contas de serviço
 *        > "Gerar nova chave privada" → salve como  service-account.json  na raiz do projeto.
 *      (já está no .gitignore — NÃO comite essa chave)
 *
 * ── Uso ──
 *   node scripts/createAdmin.js <email> <senha> "<nome>" [empresaId]
 *
 *   - empresaId vazio  → o app abre a tela "Setup Empresa" no 1º login (cria empresa nova)
 *   - empresaId preenchido → o admin já entra na empresa existente (ID da coleção `empresas`)
 *
 * Exemplo:
 *   node scripts/createAdmin.js novo.admin@clinica.com Senha123 "Maria Gestora"
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const [email, senha, nome, empresaId = ''] = process.argv.slice(2);

if (!email || !senha || !nome) {
  console.error('Uso: node scripts/createAdmin.js <email> <senha> "<nome>" [empresaId]');
  process.exit(1);
}
if (senha.length < 6) {
  console.error('A senha precisa ter pelo menos 6 caracteres (exigência do Firebase Auth).');
  process.exit(1);
}

// ── Credencial (service account) ──
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch {
  console.error(
    'Chave de service account não encontrada em:\n  ' + keyPath +
    '\nGere em: Firebase Console > Configurações do projeto > Contas de serviço > Gerar nova chave privada\n' +
    'e salve como service-account.json na raiz do projeto (ou defina GOOGLE_APPLICATION_CREDENTIALS).'
  );
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

(async () => {
  const auth = getAuth();
  const db = getFirestore();
  const emailNorm = email.trim().toLowerCase();

  // 1. cria ou recupera o usuário no Auth
  let uid;
  try {
    const u = await auth.createUser({ email: emailNorm, password: senha, displayName: nome });
    uid = u.uid;
    console.log('✓ Auth: usuário criado —', uid);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const u = await auth.getUserByEmail(emailNorm);
      uid = u.uid;
      console.log('• Auth: usuário já existia, reaproveitando —', uid);
    } else {
      throw e;
    }
  }

  // 2. grava o perfil no Firestore (merge: não apaga campos existentes)
  const now = FieldValue.serverTimestamp();
  await db.collection('usuarios').doc(uid).set(
    {
      email: emailNorm,
      nome,
      role: 'admin',
      empresaId,
      telefone: '',
      updatedAt: now,
      createdAt: now,
    },
    { merge: true }
  );

  console.log('✓ Firestore: perfil admin gravado em usuarios/' + uid);
  console.log(
    'Pronto! Faça login no app com esse e-mail/senha.\n  empresaId =',
    empresaId || '(vazio → o app abrirá o Setup Empresa)'
  );
  process.exit(0);
})().catch((e) => {
  console.error('Erro:', e.message || e);
  process.exit(1);
});
