# Scripts do HomeCare

Referência dos scripts utilitários do projeto, todos na pasta `scripts/`.

## Antes de rodar

Todos os scripts usam o Firebase Admin SDK. Você precisa de:

1. O arquivo `service-account.json` na raiz do projeto (chave da conta de serviço do Firebase). Ele está no `.gitignore`, então nunca vai para o repositório.
2. As dependências instaladas com `yarn install`.

Empresa padrão da maioria dos scripts: `clinica-generica-94hdol`. Quando o script aceita `empresaId`, você pode passar outro por argumento.

---

## Seeds (populam dados de demonstração)

### seed:all
Cria a base completa de demonstração de uma semana: 5 cuidadores, 10 pacientes, 20 familiares, as escalas, os registros da semana e os plantões. É idempotente, ou seja, limpa os dados de seed anteriores antes de recriar e não toca no que você criou manualmente. A senha de todas as contas geradas é `Demo@123`.

```bash
yarn seed:all
# ou apontando outra empresa:
node scripts/seedDemo.js <empresaId>
```

### seed:teste
Simula 7 dias de uso apenas para o paciente Teste, com um cenário diferente por dia (estável, pico de pressão, febre, recuperação, queda e dessaturação). Gera sinais vitais, alimentação, medicação, atividades, intercorrências e um plantão por dia. Marca tudo com `seedTeste`, então pode rodar de novo que ele limpa só o que ele mesmo criou.

```bash
yarn seed:teste
# ou:
node scripts/seedPacienteTeste.js [empresaId] ["Nome do Paciente"]
```

### seed:escalas
Popula algumas escalas reais para apresentação, vinculando um cuidador a pacientes em alguns dias da semana, incluindo hoje, para demonstrar o card Minha escala.

```bash
yarn seed:escalas
# ou:
node scripts/seedEscalas.js [empresaId]
```

---

## Admin e consultas

### admin:create
Cria ou atualiza uma conta de admin. Cria o usuário no Firebase Auth e o documento em `usuarios/{uid}` com role admin.

```bash
node scripts/createAdmin.js <email> <senha> "<nome>" [empresaId]
```

### admin:list-empresas
Lista as empresas existentes com id e nome. Útil para descobrir o `empresaId`.

```bash
yarn admin:list-empresas
```

### admin:find-user
Mostra o perfil de um usuário pelo email: uid, role e a empresa a que ele pertence.

```bash
node scripts/findUser.js <email>
```

### quemCuida
Mostra qual cuidador é responsável por um paciente, com base na escala, e em quais dias.

```bash
node scripts/quemCuida.js ["Nome do Paciente"] [empresaId]
# exemplo:
node scripts/quemCuida.js "Teste"
```

---

## Manutenção

### backfillVisibleToFamily
Preenche o campo `visibleToFamily` nos registros antigos que não tinham esse campo. Roda pelo Admin SDK porque os registros são imutáveis pelas regras do Firestore. É uma correção pontual, você provavelmente não precisa rodar de novo.

```bash
node scripts/backfillVisibleToFamily.js
```

### backfillEnfermeirosAutorizados
Preenche o campo `enfermeirosAutorizados` nos pacientes antigos. **Rode uma vez, logo depois de publicar as regras do isolamento por profissional.**

A partir desta mudança, o profissional só lê o paciente se o uid dele estiver nessa lista. Os pacientes criados antes não têm a lista, então ficam invisíveis para a equipe até o backfill rodar. O script reconstrói a lista a partir das escalas ativas e dos plantões já realizados (quem tem vínculo real com o paciente).

Sempre confira com `--dry-run` antes de aplicar. Pacientes que aparecerem como "sem vínculo" continuam sem profissional autorizado: o admin precisa escalar alguém ou autorizar à mão no detalhe do paciente.

```bash
# confere o que faria, sem escrever
node scripts/backfillEnfermeirosAutorizados.js --dry-run

# aplica
node scripts/backfillEnfermeirosAutorizados.js

# corte mais rígido: ignora plantões, autoriza só quem está escalado
node scripts/backfillEnfermeirosAutorizados.js --somente-escalas
```

| Argumento | O que faz |
| --- | --- |
| `--dry-run` | Mostra as mudanças sem escrever nada |
| `--somente-escalas` | Ignora os plantões e considera só as escalas ativas |

### listContas
Mostra todas as contas existentes, cruzando o Firebase Auth com os perfis do Firestore: e-mail, papel, empresa, status e observações (troca de senha pendente, acompanhante, família sem paciente, conta sem tenant). Também aponta contas órfãs, nos dois sentidos, e lista os pacientes de cada empresa com quantos profissionais estão autorizados.

É o jeito confiável de saber o que existe no banco, em vez de confiar na memória ou no `TEST_ACCOUNTS.md`.

```bash
node scripts/listContas.js
```

### resetApp
**Zera o app inteiro.** Apaga todos os dados do Firestore (empresas, pacientes, prontuários, escalas, plantões, financeiro, usuários, auditoria) e todas as contas do Auth. ⚠️ Destrutivo e irreversível, só para testes.

Sem `--yes`, é dry-run: só mostra o que existe hoje, não apaga nada.

```bash
node scripts/resetApp.js          # dry-run
node scripts/resetApp.js --yes    # apaga de verdade
```

### seedMinimo
Cria o mínimo para testar depois do reset: 1 empresa, 1 admin, 1 cuidador, 1 família e 1 paciente, tudo amarrado. Senha de todas: `Demo@123`, sem troca obrigatória.

```bash
node scripts/seedMinimo.js
```

Contas geradas: `admin@benevita.test`, `enfermeiro@benevita.test`, `familia@benevita.test`.

### resetTestPassword
Define uma senha conhecida para uma conta, pelo e-mail. **Uso exclusivo de teste.**

Serve para logar em contas convidadas (profissional, família, parente) no simulador, onde a senha temporária não chega porque o WhatsApp não abre. A conta tem `mustChangePassword`, então o app pede a troca no 1º acesso mesmo assim.

```bash
node scripts/resetTestPassword.js <email> [senha]
# sem o 2º argumento, usa Demo@123
node scripts/resetTestPassword.js gabriel.nurse@ghx.com
```

---

## Comandos de desenvolvimento

Fora os scripts acima, o `package.json` tem os comandos do dia a dia:

| Comando | O que faz |
| --- | --- |
| `yarn start` | Sobe o Metro (empacotador) do Expo |
| `yarn android` | Builda e roda no Android |
| `yarn ios` | Builda e roda no iOS |
| `yarn web` | Roda a versão web |
| `yarn lint` | Verifica o código com o ESLint |
| `yarn typecheck` | Checa os tipos com o TypeScript |
