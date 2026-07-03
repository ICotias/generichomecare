/**
 * Mostra qual enfermeiro é responsável por um paciente (pela escala).
 *
 * Uso:  node scripts/quemCuida.js ["Nome do Paciente"] [empresaId]
 *       padrão: paciente "Teste", empresa clinica-generica-94hdol
 *
 * Pré-requisito: service-account.json na raiz do projeto.
 */
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const nomePaciente = process.argv[2] || 'Teste';
const empresaArg = process.argv[3] || null;

const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  path.resolve(__dirname, '..', 'service-account.json');
let sa;
try { sa = require(keyPath); }
catch { console.error('service-account.json não encontrado em: ' + keyPath); process.exit(1); }

initializeApp({ credential: cert(sa) });
const db = getFirestore();
const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

(async () => {
  const empresas = empresaArg
    ? [await db.collection('empresas').doc(empresaArg).get()]
    : (await db.collection('empresas').get()).docs;

  let achou = false;
  for (const emp of empresas) {
    if (!emp.exists) continue;
    const pats = await emp.ref.collection('pacientes').where('nome', '==', nomePaciente).get();
    for (const p of pats.docs) {
      achou = true;
      console.log(`\nPaciente: ${nomePaciente}  (empresa ${emp.id})`);
      const esc = await emp.ref.collection('escalas').where('pacienteId', '==', p.id).get();
      if (esc.empty) { console.log('  Nenhum enfermeiro escalado para este paciente ainda.'); continue; }
      const nurses = {};
      for (const e of esc.docs) {
        const ed = e.data();
        const key = ed.profissionalId || '(sem id)';
        nurses[key] = nurses[key] || { nome: ed.profissionalNome, dias: [] };
        if (ed.diaSemana != null) nurses[key].dias.push(DIAS[ed.diaSemana]);
      }
      for (const [uid, info] of Object.entries(nurses)) {
        let nome = info.nome;
        if (!nome && uid !== '(sem id)') {
          const u = await db.collection('usuarios').doc(uid).get();
          nome = u.exists ? u.data().nome : uid;
        }
        console.log(`  Responsável: ${nome || uid}  |  dias: ${info.dias.join(', ') || '(sem dia definido)'}`);
      }
    }
  }
  if (!achou) console.log(`Paciente "${nomePaciente}" não encontrado.`);
  process.exit(0);
})().catch(e => { console.error('Erro:', e.message || e); process.exit(1); });
