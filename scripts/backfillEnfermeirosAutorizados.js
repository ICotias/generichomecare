/**
 * Backfill do campo `enfermeirosAutorizados` nos pacientes já existentes.
 *
 * CONTEXTO: até esta mudança, qualquer enfermeiro da empresa lia qualquer
 * paciente dela. Agora as Firestore rules exigem que o uid do enfermeiro
 * esteja em `pacientes/{id}.enfermeirosAutorizados`. Sem este backfill, os
 * pacientes antigos ficam sem a lista e NENHUM enfermeiro os enxerga (o
 * default é fail-closed, de propósito).
 *
 * REGRA APLICADA: autoriza quem já tem vínculo real e comprovado com o
 * paciente, a partir de duas fontes:
 *   1. escalas ativas   (profissionalId escalado naquele paciente)
 *   2. plantões         (quem já fez checkin naquele paciente)
 *
 * A fonte 2 existe para não derrubar quem está atendendo hoje sem escala
 * cadastrada. Se preferir um corte mais rígido, rode com --somente-escalas.
 *
 * COMO RODAR:
 *   1. Baixe a chave de service account no Firebase Console
 *      (Configurações do projeto → Contas de serviço → Gerar nova chave privada)
 *   2. Salve como service-account.json na raiz (NÃO commite esse arquivo)
 *   3. node scripts/backfillEnfermeirosAutorizados.js --dry-run   (confere)
 *   4. node scripts/backfillEnfermeirosAutorizados.js             (aplica)
 *
 * ARGUMENTOS:
 *   --dry-run          mostra o que faria, sem escrever nada
 *   --somente-escalas  ignora os plantões, autoriza só quem está escalado
 *
 * É idempotente: recalcula a lista e só escreve quando ela muda de fato.
 */
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');

// Mesmo padrão dos outros scripts: service-account.json na raiz, ou o caminho
// em GOOGLE_APPLICATION_CREDENTIALS.
const keyPath =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');

let serviceAccount;
try {
  serviceAccount = require(keyPath);
} catch {
  console.error('service-account.json não encontrado em: ' + keyPath);
  console.error('Baixe em Firebase Console → Configurações → Contas de serviço → Gerar nova chave.');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });

const db = getFirestore();

const DRY_RUN = process.argv.includes('--dry-run');
const SOMENTE_ESCALAS = process.argv.includes('--somente-escalas');

/** Mesma lista, mesma ordem? (evita escrita à toa) */
const sameSet = (a, b) => {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
};

async function backfillEmpresa(empresaDoc) {
  const empresaId = empresaDoc.id;
  const nome = empresaDoc.data().nome ?? '(sem nome)';
  console.log(`\n── Empresa ${empresaId} (${nome})`);

  // pacienteId → Set(uid dos enfermeiros)
  const autorizados = new Map();
  const add = (pacienteId, uid) => {
    if (!pacienteId || !uid) return;
    if (!autorizados.has(pacienteId)) autorizados.set(pacienteId, new Set());
    autorizados.get(pacienteId).add(uid);
  };

  // Fonte 1: escalas ativas
  const escalas = await db.collection(`empresas/${empresaId}/escalas`).get();
  let fromEscalas = 0;
  escalas.forEach((d) => {
    const e = d.data();
    if (e.ativo === false) return;
    add(e.pacienteId, e.profissionalId);
    fromEscalas += 1;
  });
  console.log(`   escalas ativas: ${fromEscalas}`);

  // Fonte 2: plantões já realizados
  let fromPlantoes = 0;
  if (!SOMENTE_ESCALAS) {
    const plantoes = await db.collection(`empresas/${empresaId}/plantoes`).get();
    plantoes.forEach((d) => {
      const p = d.data();
      add(p.pacienteId, p.profissionalId);
      fromPlantoes += 1;
    });
    console.log(`   plantões: ${fromPlantoes}`);
  }

  // Aplica nos pacientes
  const pacientes = await db.collection(`empresas/${empresaId}/pacientes`).get();
  let updated = 0;
  let unchanged = 0;
  let semVinculo = 0;

  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of pacientes.docs) {
    const atual = doc.data().enfermeirosAutorizados;
    const novo = [...(autorizados.get(doc.id) ?? [])];

    if (Array.isArray(atual) && sameSet(atual, novo)) {
      unchanged += 1;
      continue;
    }

    if (novo.length === 0) {
      semVinculo += 1;
      console.log(`   ! ${doc.data().nome ?? doc.id}: nenhum enfermeiro com vínculo — fica sem acesso até o admin autorizar`);
    }

    console.log(`   → ${doc.data().nome ?? doc.id}: ${novo.length} enfermeiro(s)`);
    updated += 1;

    if (DRY_RUN) continue;

    batch.update(doc.ref, { enfermeirosAutorizados: novo });
    opsInBatch += 1;
    if (opsInBatch >= 400) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (!DRY_RUN && opsInBatch > 0) await batch.commit();

  console.log(
    `   resumo: ${updated} atualizados | ${unchanged} já corretos | ${semVinculo} sem vínculo`
  );
  return { updated, unchanged, semVinculo };
}

async function run() {
  if (DRY_RUN) console.log('MODO DRY-RUN: nada será escrito.\n');
  if (SOMENTE_ESCALAS) console.log('Ignorando plantões: só escalas ativas contam.\n');

  const empresas = await db.collection('empresas').get();
  console.log(`Encontradas ${empresas.size} empresa(s).`);

  const total = { updated: 0, unchanged: 0, semVinculo: 0 };
  for (const empresaDoc of empresas.docs) {
    const r = await backfillEmpresa(empresaDoc);
    total.updated += r.updated;
    total.unchanged += r.unchanged;
    total.semVinculo += r.semVinculo;
  }

  console.log(
    `\n${DRY_RUN ? '[dry-run] ' : ''}Concluído. ` +
      `Atualizados: ${total.updated} | Já corretos: ${total.unchanged} | Sem vínculo: ${total.semVinculo}`
  );
  if (total.semVinculo > 0) {
    console.log(
      'Atenção: os pacientes "sem vínculo" ficam invisíveis para os enfermeiros ' +
        'até que o admin escale alguém ou autorize à mão no detalhe do paciente.'
    );
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('Erro no backfill:', err);
  process.exit(1);
});
