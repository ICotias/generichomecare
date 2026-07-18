/**
 * Define uma senha CONHECIDA para uma conta, pelo e-mail.
 *
 * PARA QUE SERVE: contas convidadas (enfermeiro, família, parente) nascem com
 * senha temporária que só aparece na mensagem de WhatsApp. No simulador o
 * WhatsApp não abre, então a senha se perde e não dá para logar. Este script
 * define uma senha conhecida para você conseguir entrar e testar. Como a conta
 * tem mustChangePassword, o app pede a troca no 1º acesso mesmo assim.
 *
 * USO EXCLUSIVO DE TESTE. Não use isto para contas reais.
 *
 * COMO RODAR:
 *   node scripts/resetTestPassword.js <email> [senha]
 *   # exemplos:
 *   node scripts/resetTestPassword.js gabriel.nurse@ghx.com
 *   node scripts/resetTestPassword.js irmaoghx@ghx.com Teste@123
 *
 * Sem o 2º argumento, usa Demo@123 (a mesma dos seeds).
 * Pré-requisito: service-account.json na raiz (igual aos outros scripts).
 */
const { initializeApp, cert } = require('firebase-admin/app');
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

const email = process.argv[2];
const senha = process.argv[3] || 'Demo@123';

if (!email) {
  console.error('Uso: node scripts/resetTestPassword.js <email> [senha]');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

(async () => {
  try {
    const user = await getAuth().getUserByEmail(email);
    await getAuth().updateUser(user.uid, { password: senha });
    console.log(`OK. Senha de ${email} definida como: ${senha}`);
    console.log('O app vai pedir troca de senha no 1º acesso (mustChangePassword).');
    process.exit(0);
  } catch (err) {
    console.error('Falhou:', err.message || err);
    process.exit(1);
  }
})();
