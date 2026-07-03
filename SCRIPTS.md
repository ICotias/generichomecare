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
Cria a base completa de demonstração de uma semana: 5 enfermeiros, 10 pacientes, 20 familiares, as escalas, os registros da semana e os plantões. É idempotente, ou seja, limpa os dados de seed anteriores antes de recriar e não toca no que você criou manualmente. A senha de todas as contas geradas é `Demo@123`.

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
Popula algumas escalas reais para apresentação, vinculando um enfermeiro a pacientes em alguns dias da semana, incluindo hoje, para demonstrar o card Minha escala.

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
Mostra qual enfermeiro é responsável por um paciente, com base na escala, e em quais dias.

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
