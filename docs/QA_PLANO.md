# Plano de QA do Benevita e auditoria do fluxo do profissional

Documento em duas metades. A primeira é o que encontrei auditando o fluxo do profissional
que atende em campo (`role: 'nurse'`), com o problema, onde ele mora e como reproduzir. A
segunda é a lógica de QA a seguir até publicar nas duas lojas.

Escopo da auditoria: navegação, telas, serviços, queries, regras do Firestore, fila offline
e criação de conta do papel `nurse`, nos dois modos (empresa e familiar).

Método: leitura de código e das regras. **Nada aqui foi testado em aparelho.** Onde eu digo
que algo falha, é conclusão de leitura, e o próprio plano da segunda metade existe para
transformar isso em teste executado.

---

## Parte 1 — O que encontrei

### 1. Cuidador autônomo: implantado, com uma exclusividade a respeitar

**Situação: resolvido. Este achado descrevia a ausência do modo, que passou a existir.**

O modo foi construído depois desta auditoria. O cuidador escolhe "Cuidador" no cadastro,
vira dono de um tenant `tipo: 'autonomo'` mantendo `role: 'nurse'`, e ganha uma aba de
pacientes. Ele cadastra quantos pacientes couberem na faixa, preenche o cadastro clínico
pelo mesmo assistente dos outros modos, e convida a família de cada paciente.

Três pontos que **precisam entrar no roteiro de teste**, porque nasceram com o recurso:

**A trava de faixa é do lado do cliente, não das regras.** `patientService.assertPatientQuota`
conta os pacientes ativos e barra antes de gravar. As regras não contam documentos, então
quem chamasse a API na mão passaria do limite. O teto é comercial, não de segurança, e o
isolamento entre tenants continua garantido pelas regras. Testar que a trava barra pela
interface é suficiente; não invente teste de burla.

**O plano é imutável para o próprio usuário.** As regras bloqueiam alterar `planoAutonomo`,
porque não existe pagamento dentro do aplicativo. Mudar de faixa é ato da operação, hoje
pelo Console. Isso precisa de um procedimento escrito, senão o primeiro cliente que pagar o
Essencial vai continuar travado em dois pacientes.

**Autônomo e convidado são mutuamente exclusivos para a mesma pessoa.** `inviteNurseAccount`
cria conta nova no Firebase Auth. Se o cuidador já se cadastrou como autônomo, o convite de
uma família falha com `auth/email-already-in-use`, e vice-versa.

Isso importa comercialmente: a página `/familia` promete "convide o cuidador que já atende".
Se esse cuidador for usuário autônomo do Benevita, o convite não passa. O caminho correto
nesse caso é ele cadastrar o paciente no tenant dele e convidar a família, invertendo quem
convida quem. A limitação de uma conta por tenant continua valendo e está no `CLAUDE.md`.

**Sobre a proposta comercial:** a `Benevita_Proposta_Cuidadores.pdf` já pode circular quanto
às faixas, que passaram a existir. O que não existe é a tela de "controlar quem acessa cada
paciente" citada nela: o cuidador convida a família, mas não há tela para revogar esse acesso
depois. Ou se constrói, ou se corrige a frase.

---

### 2. Registro de cuidado é apagado sozinho, em silêncio

**Gravidade: crítica. Perda de dado clínico.**

Em `src/core/services/offlineQueue.ts`:

```
L42   const MAX_RETRIES = 5;
L43   const PROCESS_INTERVAL_MS = 30_000;
L232  const filtered = updated.filter((q) => q.retries <= MAX_RETRIES);
L236  console.error(`[OfflineQueue] Dropped ${item.id} after ${MAX_RETRIES} retries: ${msg}`);
```

Um item que falhe cinco vezes seguidas é **removido da fila e perdido**, com um
`console.error` como único vestígio. Em produção ninguém lê console. São cinco tentativas a
cada trinta segundos: o registro desaparece em cerca de **dois minutos e meio**.

O gatilho não é hipotético. `processQueue` trata qualquer exceção como falha genérica, então
um `permission-denied` conta como tentativa. Basta o admin remover a última escala do par
enquanto houver registro na fila: a autorização é revogada, as regras passam a negar, e o
cuidado registrado em campo é descartado.

Isso contraria a regra 1 do próprio `CLAUDE.md`, "nunca falhar silenciosamente", e a linha
do ponytail que diz que nunca se corta "tratamento de erro que evita perda de dados".

**Como reproduzir:** profissional registra em modo avião, admin remove a escala, profissional
volta a ter sinal, espera três minutos. O registro some sem aviso.

---

### 3. A fila é invisível para quem registra

**Gravidade: crítica, e agrava o item 2.**

Nenhuma tela do profissional mostra que existem registros pendentes. Varri
`src/features/nurse/` inteiro e não há leitura de `getQueue`, nem contador, nem selo de
sincronização, nem estado por registro.

Quem trabalha em casa de paciente, sem sinal, não tem como saber se o que ele registrou
chegou. E o campo `lastError`, que a fila grava, não é lido em lugar nenhum da interface.

O aplicativo é vendido como "funciona offline". Funciona, mas sem prestar contas.

---

### 4. Desativar um profissional não o impede de entrar

**Gravidade: alta. A tela promete o que não entrega.**

`src/features/admin/screens/NurseDetailScreen.tsx:61` diz ao admin:

> "O profissional não poderá mais acessar o app."

O que a ação faz de fato (L70):

```ts
await updateDoc(doc(db, Collections.USUARIOS, nurseId), { ativo: false, status: 'inativo' });
// e revoga a autorização nos pacientes
```

Mas **nada bloqueia o acesso**:

- `useAuth` não lê `ativo` nem `status` em momento algum
- As regras do Firestore não consultam esses campos (as duas ocorrências de `ativo` em
  `firestore.rules` são um comentário e a criação de escala)
- A conta no Firebase Auth continua habilitada

Então o profissional desativado **faz login normalmente**, entra nas abas, e continua com
`empresaId` e `role: 'nurse'` válidos. O que ele não vê é paciente, porque a autorização foi
revogada. O mesmo vale para `status: 'excluido'`.

Na prática o isolamento por paciente segura o estrago, mas a afirmação da tela é falsa e a
conta segue viva dentro do tenant.

---

### 5. O modo é adivinhado por heurística

**Gravidade: média. Funciona hoje, quebra em silêncio se a premissa mudar.**

`src/features/nurse/screens/ShiftCheckinScreen.tsx`:

```ts
const available = escala.length === 0 ? list : list.filter((p) => scheduledIds.has(p.id));
```

A regra é "sem nenhuma escala, é modo familiar, então pode atender qualquer paciente
autorizado". Hoje se sustenta, porque no modo empresa a autorização nasce da escala e some
com ela.

O que a torna frágil é depender de uma coincidência, não de um fato. Se algum dia existir
cuidador autorizado sem escala no modo empresa (um script de manutenção, um backfill, uma
tela futura de autorização manual), ele passa a poder iniciar plantão em **qualquer** paciente
autorizado, em **qualquer** dia. O certo é decidir pelo modo do tenant, que o
`useIsTenantOwner` já sabe responder, e não pelo tamanho de uma lista.

---

### 6. Permissões declaradas que o aplicativo não usa

**Gravidade: média. Risco de reprovação e de dado de privacidade errado.**

`app.json` declara para Android:

```
ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION, CAMERA,
READ_EXTERNAL_STORAGE, WRITE_EXTERNAL_STORAGE,
RECEIVE_BOOT_COMPLETED, VIBRATE, RECORD_AUDIO
```

Cruzando com o código:

| Permissão | Usada? | Onde |
| --- | --- | --- |
| Localização | Sim | `useLocation`, check-in e evolução |
| Câmera | Sim | `RegisterPhotoScreen` (`expo-image-picker`) |
| `RECORD_AUDIO` | **Não** | Não há código de áudio nem `expo-av` instalado |
| `RECEIVE_BOOT_COMPLETED` | **Não** | Push está fora do MVP, não há notificação |
| `VIBRATE` | **Não** | Sem uso encontrado |
| Storage legado | **Não** | `expo-image-picker` não precisa em Android moderno |

Pedir microfone em um aplicativo de saúde, sem usar, é o tipo de coisa que gera pergunta do
revisor, enche a ficha de Data safety de item indefensável e derruba conversão de instalação.

---

### 7. Nenhuma rede de segurança instalada

- Sem framework de teste. Não há `jest`, `detox` nem `maestro` no `package.json`, e não
  existe script `test`. O portão de qualidade hoje é `yarn typecheck` e `yarn lint`.
- Sem monitoramento de erro. Não há Sentry nem Crashlytics. Se quebrar na mão do usuário,
  você fica sabendo por reclamação.
- `version` está em `1.0.0`, `buildNumber` e `versionCode` em `1`. Nenhum incremento ainda.

---

### Resumo por prioridade

| # | Problema | Gravidade | Precisa antes da loja? |
| --- | --- | --- | --- |
| 2 | Registro clínico descartado em silêncio | Crítica | **Sim** |
| 3 | Fila offline invisível | Crítica | **Sim** |
| 7 | Sem monitoramento de erro em produção | Alta | **Sim** |
| 4 | Desativar não bloqueia acesso | Alta | **Sim** |
| 6 | Permissões sem uso | Média | **Sim**, é rápido |
| 5 | Modo adivinhado por heurística | Média | Não, mas documente |
| 1 | Cuidador autônomo | Resolvido | Testar o roteiro novo da Fase 2 |

Duas pendências operacionais nasceram com o modo autônomo e não são código:

- **Procedimento de mudança de faixa.** O `planoAutonomo` só muda pelo Console. Escreva o
  passo a passo antes do primeiro cliente pagante, senão ele fica travado no limite do Início.
- **Revisar a frase da proposta** sobre controlar quem acessa cada paciente, ou construir a
  tela que a sustenta.

---

## Parte 2 — A lógica de QA, e de onde ela vem

### 2.1 A pirâmide, e por que ela é diferente em mobile

O Google publicou duas divisões, em épocas diferentes, e vale citar com a data:

- **2015, 70/20/10.** Setenta por cento de teste unitário, vinte de integração, dez de ponta
  a ponta. O mesmo texto batiza os antipadrões: a pirâmide invertida, o "casquinha de
  sorvete", e a ampulheta.
- **2020, 80/15/5.** No livro de engenharia de software deles a mistura declarada é oitenta,
  quinze e cinco.

A documentação atual do Android abandonou o modelo de três camadas e descreve cinco: unit,
component, feature, application e release candidate.

**O que isso significa para o Benevita.** A recomendação padrão empurra para muito teste
unitário. Só que a maior parte do risco deste aplicativo não está em função pura: está em
regra do Firestore, em sincronização e em navegação condicional. Teste unitário de um
`formatCoren` não protege contra nada do que a Parte 1 encontrou.

Por isso a divisão que faz sentido aqui é diferente da genérica:

| Camada | Peso aqui | Por quê |
| --- | --- | --- |
| Regras do Firestore | **O maior** | É onde mora o isolamento entre pacientes e entre tenants. Testável sem aparelho, rápido, determinístico |
| Unitário de lógica pura | Médio | Fila offline, cálculo de faixas, formatação, validação de COREN |
| Integração de serviço | Médio | `patientService`, `scheduleService` contra o emulador |
| Ponta a ponta em aparelho | **O menor**, e manual | Caro, lento e instável. Cobrir só os caminhos que, se quebrarem, quebram o produto |

### 2.2 Por que o E2E automatizado fica de fora agora

Teste de ponta a ponta em dispositivo é o mais caro de escrever e o mais frágil de manter:
depende de tempo de animação, de rede, de estado do aparelho. Em time de uma pessoa, uma
suíte E2E instável vira ruído que você aprende a ignorar, e aí ela não protege nada.

A troca honesta é: **automatizar as regras do Firestore**, que é onde está o risco de
segurança, e **manter o E2E como roteiro manual escrito**, que é a Parte 3.

### 2.3 Portões de qualidade que a loja mede por você

O Google Play publica limiares de "bad behavior" em Android vitals. Passar deles prejudica a
descoberta do aplicativo e pode gerar aviso na ficha da loja:

| Métrica | Limiar geral | Limiar por modelo de aparelho |
| --- | --- | --- |
| Taxa de travamento percebido pelo usuário | 1,09% dos usuários diários | 8% |
| Taxa de ANR percebido pelo usuário | 0,47% dos usuários diários | 8% |

Adote esses números como o seu portão, não como o teto aceitável. Sem Crashlytics ou Sentry
instalado, você não tem como medir nenhum dos dois hoje, e é por isso que observabilidade
entrou como bloqueante na tabela da Parte 1.

### 2.4 Práticas que valem para um time de uma pessoa

Nem tudo que empresa grande faz cabe aqui. O que cabe:

- **Rollout escalonado.** O Play permite liberar para uma fração dos usuários e ampliar. Com
  aplicativo de saúde, comece baixo e só amplie olhando a taxa de travamento.
- **Dogfooding.** Use o aplicativo com dado real seu antes de qualquer cliente. Você já fez
  isso ao testar os fluxos com contas de teste; formalize como etapa.
- **Kill switch.** Um sinalizador remoto simples, lido do Firestore no boot, que permita
  desligar um recurso quebrado sem publicar versão nova. Publicação leva dias; um documento
  leva segundos.
- **Release candidate congelado.** Nada de "só mais um ajuste" depois que o build foi para
  teste. Se mudou, é build novo e o roteiro roda de novo.

O que **não** cabe agora: canary por região, testes A/B de release, suíte E2E em fazenda de
dispositivos. Custo alto, retorno baixo no seu estágio.

---

## Parte 3 — O plano, na ordem de execução

### Fase 0 — Corrigir o que é bloqueante (antes de qualquer teste)

Não adianta testar um aplicativo que perde dado por desenho. Nesta ordem:

1. **A fila nunca descarta.** Item que estourou tentativa vai para um estado
   `falhou` e **fica**, em vez de sumir. Nenhum `filter` que remove.
2. **A fila fica visível.** Um selo na tela inicial do profissional com a contagem de
   pendentes, e uma tela simples listando o que falhou, com o motivo e um botão de tentar de
   novo. Enquanto houver pendência, ela aparece.
3. **Erro de permissão não conta como falha de rede.** Separar os dois: rede tenta de novo
   para sempre, permissão negada para na hora e avisa.
4. **Instalar Sentry ou Crashlytics.** Sem isso você publica cego.
5. **Desativação que desativa.** Escolha uma: as regras passam a exigir `ativo == true`, ou o
   `useAuth` derruba a sessão de conta inativa. E ajuste o texto do diálogo para o que a ação
   realmente faz.
6. **Limpar as permissões do `app.json`.** Remover `RECORD_AUDIO`,
   `RECEIVE_BOOT_COMPLETED`, `VIBRATE` e as de storage legado. Isso exige `npx expo prebuild`
   e build novo.

### Fase 1 — Rede de segurança automatizada

Duas coisas, nada além disso por enquanto.

**Testes das regras do Firestore**, com o emulador e
`@firebase/rules-unit-testing`. É o melhor retorno por hora investida do projeto inteiro. O
conjunto mínimo, todos como caso negativo esperado:

- Profissional lê paciente em que **não** está em `enfermeirosAutorizados` → negado
- Profissional faz consulta ampla de pacientes, sem `array-contains` → negada por inteiro
- Profissional lê escala de outro profissional → negado
- Profissional roda `collectionGroup('registros')` → negado
- Profissional edita o próprio `corenRegistro` → negado
- Profissional muda o próprio `status` para `ativo` → negado
- Família de outro tenant lê o paciente → negado
- Família em modo empresa edita paciente ou prescrição → negado
- Acompanhante (`familiaTitular: false`) edita qualquer coisa → negado
- Admin lê ou escreve em `empresas/{outra}` → negado
- Paciente criado por admin com `enfermeirosAutorizados` não vazio → negado

Do modo autônomo, que é o mais novo e por isso o menos exercitado:

- Cuidador **não dono** do tenant cria paciente → negado (é o caso do contratado por empresa)
- Cuidador dono cria paciente com a lista de autorizados vazia → negado
- Cuidador dono cria paciente com a lista contendo outro uid → negado
- Cuidador dono edita paciente de **outro** tenant → negado
- Cuidador dono altera o próprio `planoAutonomo` → negado
- Cuidador dono cria conta com `role: 'nurse'` (montar equipe) → negado
- Cuidador **não dono** lê o financeiro do tenant → negado
- Conta com `empresaId` preenchido tenta reivindicar outro tenant → negado

E os positivos correspondentes, senão você prova só que tudo está trancado. Do autônomo, no
mínimo: cria paciente com ele próprio na lista, edita esse paciente, cria prescrição, convida
família e lê o financeiro do próprio tenant.

**Teste unitário da fila offline.** Sem framework pesado: a lógica de enfileirar, tentar,
classificar erro e marcar como falho é função pura o suficiente. Casos: sucesso, erro de
rede, erro de permissão, estouro de tentativa (que agora **não** pode apagar).

### Fase 2 — Roteiro manual, o que rodar antes de cada build

Este é o E2E que fica manual. Escreva o resultado de cada linha, não confie na memória.

**Smoke, roda sempre, cerca de 15 minutos**

| # | Passo | Resultado esperado |
| --- | --- | --- |
| 1 | Abrir com conta nova, sem tenant | Cai no Setup com as duas opções |
| 2 | Escolher Empresa e preencher | Entra no painel, aba Dashboard |
| 3 | Criar paciente só com nome, nascimento e gênero | Cria e abre o assistente clínico direto |
| 4 | Sair do assistente no meio, voltar pela ficha | Aviso de cadastro pendente leva de volta |
| 5 | Ver a ficha do paciente recém-criado | Aviso de nenhum cuidador autorizado |
| 6 | Tocar o aviso | Vai para Equipe, Escalas |
| 7 | Criar cuidador sem COREN | Aceita e cria a conta |
| 8 | Criar escala do cuidador para o paciente, hoje | Paciente passa a aparecer para ele |
| 9 | Entrar como o cuidador | Pede troca de senha no 1º acesso |
| 10 | Ver a lista de pacientes | Só o autorizado, nenhum outro |
| 11 | Iniciar plantão | Check-in aceito, plantão aberto |
| 12 | Registrar sinais vitais | Aparece na timeline |
| 13 | Convidar família pela ficha do paciente | Conta criada já vinculada |
| 14 | Entrar como essa família | Vai direto à timeline, sem pedir cadastro |
| 15 | Tentar editar dados clínicos como família | Não há caminho, e a regra nega |

**Cuidador autônomo, roda sempre, cerca de 15 minutos**

| # | Passo | Resultado esperado |
| --- | --- | --- |
| 1 | Criar conta e escolher Cuidador no fork | Entra nas abas do profissional, com a aba Pacientes |
| 2 | Ver a aba Pacientes | Lista vazia, e o cabeçalho diz Plano Início, 0 de 2 |
| 3 | Cadastrar o 1º paciente | Cria e abre o assistente clínico direto |
| 4 | Completar o assistente | Paciente sai de pendente na lista |
| 5 | Ir para Plantão e iniciar | Deixa iniciar sem escala nenhuma |
| 6 | Registrar sinais vitais | Grava e aparece na timeline do paciente |
| 7 | Cadastrar o 2º paciente | Cria, e o cabeçalho passa a 2 de 2 |
| 8 | Tentar cadastrar o 3º | Botão Novo desabilitado e faixa avisando o limite |
| 9 | Mudar o plano para `essencial` no Console e reabrir | Cabeçalho vira 2 de 6 e o botão volta |
| 10 | Convidar a família de um paciente | Conta criada já vinculada àquele paciente |
| 11 | Entrar com essa família | Vai direto à timeline, sem pedir cadastro |
| 12 | Perfil, Financeiro | Abre e permite lançar receita |
| 13 | Entrar com um cuidador **contratado por empresa** | **Não** tem aba Pacientes nem Financeiro |

O passo 13 é o mais importante da tabela: é ele que prova que o modo autônomo não vazou para
quem é contratado.

**Offline, roda sempre, cerca de 10 minutos**

| # | Passo | Resultado esperado |
| --- | --- | --- |
| 1 | Modo avião, registrar três cuidados | Aceita e mostra pendente |
| 2 | Fechar o aplicativo pelo gerenciador | Ao reabrir, os três continuam na fila |
| 3 | Voltar a ter sinal | Sincroniza e o selo zera |
| 4 | Modo avião, registrar, admin remove a escala, voltar o sinal | O registro **não** some. Vira falha visível com motivo |
| 5 | Bateria fraca e tela apagada durante a fila | Nada é perdido |

**Regressão, roda antes de publicar, cerca de 40 minutos**

Smoke e offline completos, mais: modo familiar de ponta a ponta (família cria o tenant,
cadastra o paciente, convida o cuidador, convida um parente, o parente só lê); desativar e
reativar cuidador; simulação de papel pelo admin; exportação de relatório; e o fluxo de
recuperação de senha.

### Fase 3 — Matriz de aparelhos

Não persiga cobertura. Cubra as bordas que quebram interface, que são tela pequena, entalhe
e versão de sistema.

| Aparelho | Por que está na lista |
| --- | --- |
| iPhone com tela pequena (SE ou mini) | Onde o layout aperta e o teclado cobre campo |
| iPhone recente com Dynamic Island | Safe area, a regra do `useSafeAreaInsets()` |
| Android intermediário popular no Brasil (Samsung linha A ou Motorola G) | É o aparelho real do cuidador em campo |
| Android antigo, versão mínima que você suporta | Onde o desempenho e a permissão de storage divergem |

Teste também com fonte do sistema aumentada e com o aparelho em modo escuro, porque o tema é
claro fixo.

### Fase 4 — Submissão

**Comum às duas lojas**

- Política de privacidade publicada em endereço estável. Use `benevita.site/privacidade`
- Termos de uso acessíveis dentro do aplicativo, que já existem
- Subir `version` e incrementar `buildNumber` e `versionCode`
- Conta de demonstração criada, com dado fictício e paciente já cadastrado

**Apple**

- **Conta de demonstração é obrigatória.** A orientação de preparo para revisão exige dar ao
  revisor acesso completo, com conta ativa ou modo de demonstração funcional. Aplicativo com
  login e sem isso é reprovado em 2.1, App Completeness
- Aplicativo de saúde cai na 1.4.1 e na 5.1.3, Health and Health Research. Deixe claro no
  texto e dentro do aplicativo que o Benevita **registra e organiza** cuidado, e que não
  diagnostica nem recomenda conduta. A orientação de lembrar o usuário de procurar médico
  vale para nós
- A 5.1.3 também proíbe guardar informação pessoal de saúde no iCloud. Confira que nenhum
  backup automático leve dado clínico
- Preencher App Privacy com honestidade: localização, foto e dado de saúde são coletados
- Nas notas de revisão, explique em duas linhas o que é cada um dos três perfis, senão o
  revisor não encontra metade do aplicativo

**Google**

- **Conta pessoal criada depois de 13 de novembro de 2023 precisa de teste fechado com no
  mínimo 12 testadores inscritos por 14 dias seguidos** antes de pedir acesso à produção. Eram
  20 testadores até 11 de dezembro de 2024. Contas de organização são isentas. Se a sua conta
  for pessoal e nova, **este é o caminho crítico do cronograma**: comece a recrutar testador
  antes de terminar o desenvolvimento
- Preencher Data safety em coerência com as permissões que sobrarem depois da limpeza
- Dado de saúde tem política própria no Play. Declare o uso e não colete o que não usa
- Conferir o target API level exigido na janela em que você for publicar
- Publicar com rollout escalonado, não para cem por cento de uma vez

### Fase 5 — Depois de publicar

- Acompanhar travamento e ANR contra os limiares da seção 2.3, todo dia na primeira semana
- Só ampliar o rollout com a taxa estável
- Manter o kill switch testado. Um sinalizador que nunca foi acionado não é um sinalizador,
  é uma esperança

---

## Ordem sugerida

1. Fase 0, itens 1 a 4. É o que separa perder dado clínico de não perder
2. Fase 1, testes de regra. Uma tarde, e cobre o maior risco do produto
3. Fase 0, itens 5 e 6, junto com o `prebuild`
4. Fase 2 completo, com o resultado anotado
5. Se a conta do Play for pessoal e nova, abrir o teste fechado **agora**, porque são 14 dias
   de espera que correm em paralelo
6. Fase 3 e 4

---

## Fontes

- Google Testing Blog, 2015, divisão 70/20/10 e os antipadrões:
  https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html
- Software Engineering at Google, capítulo 11, divisão 80/15/5:
  https://abseil.io/resources/swe-book/html/ch11.html
- Android, estratégias de teste em cinco camadas:
  https://developer.android.com/training/testing/fundamentals/strategies
- Android vitals, limiares de bad behavior:
  https://support.google.com/googleplay/android-developer/answer/9844486
- Google, "Raising the bar on technical quality on Google Play":
  https://android-developers.googleblog.com/2022/10/raising-bar-on-technical-quality-on-google-play.html
- Play Console, exigência de teste para contas pessoais novas:
  https://support.google.com/googleplay/android-developer/answer/14151465
- App Store Review Guidelines, preparo para revisão, 1.4 Physical Harm, 2.1 App Completeness
  e 5.1.3 Health and Health Research:
  https://developer.apple.com/app-store/review/guidelines/
