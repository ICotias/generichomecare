/**
 * Backfill do campo `visibleToFamily` nos registros já existentes.
 *
 * Por que via Admin SDK: os `registros` são imutáveis pelas Firestore rules
 * (update/delete: false), então o app não consegue corrigir os documentos
 * antigos. O Admin SDK ignora as rules.
 *
 * Regra aplicada: visibleToFamily = !(type === 'foto' && fotoClinica === true)
 * (todas as fotos clínicas ficam restritas; o resto é visível para a família).
 *
 * COMO RODAR:
 *   1. Baixe a chave de service account no Firebase Console
 *      (Configurações do projeto → Contas de serviço → Gerar nova chave privada)
 *   2. Salve como service-account.json na raiz (NÃO commite esse arquivo)
 *   3. yarn add -D firebase-admin   (se ainda não tiver)
 *   4. node scripts/backfillVisibleToFamily.js
 *
 * É idempotente: só toca em docs que ainda não têm o campo.
 */
const admin = require('firebase-admin');
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

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  console.log('Buscando todos os registros (collectionGroup)...');
  const snap = await db.collectionGroup('registros').get();
  console.log(`Encontrados ${snap.size} registros.`);

  let updated = 0;
  let skipped = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    // Já tem o campo → pula (idempotente)
    if (typeof data.visibleToFamily === 'boolean') {
      skipped += 1;
      continue;
    }

    const visibleToFamily = !(data.type === 'foto' && data.fotoClinica === true);
    batch.update(doc.ref, { visibleToFamily });
    opsInBatch += 1;
    updated += 1;

    // Firestore aceita até 500 ops por batch — commitamos a cada 400
    if (opsInBatch >= 400) {
      await batch.commit();
      console.log(`  ... ${updated} atualizados`);
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`\nConcluído. Atualizados: ${updated} | Já tinham o campo: ${skipped}`);
  process.exit(0);
}

run().catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
