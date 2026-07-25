# Benevita App — Regras de Desenvolvimento

## Projeto
App React Native (Expo SDK 54, dev-client) com Firebase JS SDK (Auth, Firestore, Storage), Zustand, React Navigation v7, TypeScript strict.

## Contexto do projeto
Benevita é um app de gestão de cuidado domiciliar com três perfis: empresa (admin), enfermeiro e família. O enfermeiro registra o plantão pelo celular, com funcionamento offline. A família acompanha o cuidado em tempo real. A gestão administra pacientes, equipe, escalas e financeiro.

**O produto é do Iago. É um único aplicativo (o Benevita), NÃO um app white-label.** Nunca escrever, em nenhum material (proposta, LP, documento, deck, copy do app), que o aplicativo é personalizado com a marca/identidade visual da empresa cliente, nem que é "entregue com a marca dela". As empresas são clientes que usam o Benevita, não donas de uma versão própria. A marca é sempre Benevita.

Pegadinhas conhecidas:
- Fotos são guardadas como base64 dentro do Firestore, não no Storage. O `getStorage`/`storageService`/`storage.rules` estão dormentes.
- No Android o `DateTimePicker` é um diálogo modal e precisa ser fechado no `onChange` (`if (Platform.OS === 'android') setShow...(false)`), senão reabre em loop.
- Push notifications estão fora do MVP (dependem de conta paga Apple).
- O app usa Firebase JS SDK no cliente; os scripts em `scripts/` usam o Admin SDK com `service-account.json` (nunca versionar).

## Regras Gerais
- **Gerenciador de pacotes: SOMENTE yarn.** Nunca `npm`/`pnpm` para instalar dependências — use `yarn`, `yarn add`, `yarn add -D`, `yarn remove`. (`npx <bin>` é aceitável só para executar binários, ex.: `npx expo`/`npx tsc`, nunca para instalar.) Bloqueio técnico: o script `preinstall` (`only-allow yarn`) faz `npm install`/`pnpm install` falharem.
- Avisar sobre necessidade de deploy Firebase quando alterar rules/indexes
- Sempre fornecer código Firebase (rules, indexes) quando modificar estrutura Firestore
- Push notifications bloqueadas até conta paga Apple Developer
- O desenvolvedor é **Iago** (não Kai)
- **Documentar scripts:** sempre que criar um novo script em `scripts/`, adicionar a entrada correspondente no `SCRIPTS.md` (o que faz, comando, argumentos), na seção certa.
- **Texto human friendly:** todo texto escrito para o usuário, seja no chat ou em entregáveis (LPs, documentos, apresentações, código voltado ao usuário), deve soar natural e humano. Nunca usar travessão (—), meia risca (–) nem hífen de estilo no meio de frases. Preferir frases curtas separadas, vírgulas, parênteses ou dois pontos.
- **Escrita profissional em documentos formais:** contratos, propostas comerciais, termos e documentos do gênero devem ter escrita profissional e formal. Evitar coloquialismos e abreviações informais (ex.: escrever "aplicativo" em vez de "app", "em um" em vez de "num"). Manter a regra human friendly (sem travessão) e o tom orientado a ganho, mas com vocabulário e construção de frases mais formais.
- **Incluído x incluso:** usar a forma certa do particípio. "Incluído" (regular) vai na voz ativa, sempre com os auxiliares ter ou haver (ex.: "tinham incluído o nome na lista"). "Incluso/inclusa" (irregular) vai com ser ou estar, ou como adjetivo (ex.: "o documento está incluso no e-mail", "a taxa foi inclusa na fatura"). Concordância de gênero e número sempre com o substantivo (inclusa, inclusos, inclusas).

## Comandos
- Rodar no device: `npx expo run:ios --device` / `npx expo run:android --device` (dev-client). Metro: `npx expo start --dev-client`.
- Build na nuvem: `npx eas build -p android --profile preview` (gera APK). iPhone físico via cabo com Xcode (conta gratuita, validade de 7 dias).
- Checagem de tipos: `yarn typecheck` (`tsc --noEmit`)
- Lint: `yarn lint` (ESLint, `--max-warnings 0`)
- Seed de dados: `yarn seed:all`, `yarn seed:teste`, `yarn seed:escalas`
- Diagnóstico Expo: `npx expo-doctor`
- Deploy de regras: `firebase deploy --only firestore:rules`

## Ponytail (modo dev preguiçoso, nível full)
Antes de escrever qualquer código, parar no primeiro degrau que resolve:

1. Isso precisa existir? Se não, não faça (YAGNI).
2. A stdlib já faz? Use.
3. Uma funcionalidade nativa da plataforma resolve? Use.
4. Uma dependência já instalada resolve? Use.
5. Dá para fazer em uma linha? Faça em uma linha.
6. Só então: escreva o mínimo que funciona.

Regras: nenhuma abstração que não foi pedida, nenhuma dependência nova evitável, nenhum boilerplate que ninguém pediu. Deletar em vez de adicionar, simples em vez de esperto, menos arquivos. Questionar pedidos complexos ("você precisa mesmo de X, ou Y já cobre?"). Marcar simplificações deliberadas com um comentário `ponytail:` que nomeia o teto (ex.: varredura O(n²), heurística ingênua) e o caminho de evolução.

Preguiçoso não é negligente. Nunca cortar: validação em fronteiras de confiança, tratamento de erro que evita perda de dados, segurança, acessibilidade, nem nada pedido explicitamente. Lógica não trivial deixa uma verificação executável mínima para trás, sem framework de teste.

## Workflow
- **Portão de qualidade:** após qualquer mudança, rodar `yarn typecheck` e `yarn lint` e corrigir as falhas antes de concluir a tarefa. Não há Jest configurado; typecheck e lint são o gate.
- Mudanças que toquem 3 ou mais arquivos: apresentar o plano e aguardar aprovação antes de editar.
- Instalar libs de Expo ou nativas com `npx expo install <lib>` (respeita o yarn por baixo e escolhe a versão compatível com o SDK). Libs puras de JS com `yarn add`. Nunca `npm` nem `pnpm` (o `preinstall` bloqueia).
- Ao usar a API de uma lib externa, conferir a doc da versão instalada, não confiar só na memória.

## Estrutura
- `src/features/{admin,nurse,family}/screens/` — telas por perfil
- `src/core/services/` — chamadas ao Firebase e lógica de negócio (ex.: `registroService`, `offlineQueue`, `scheduleService`, `shiftService`, `auditService`)
- `src/core/hooks/` — hooks (`useAuth`, `useOfflineSync`, `usePatientWithActiveShift`)
- `src/core/types/` — tipos compartilhados
- `src/core/navigation/` — `RootNavigator` (React Navigation v7: native-stack + bottom-tabs, renderização condicional por role)
- `src/core/theme/` — tokens de tema (`theme.ts`)
- `src/core/config/` — `firebase.ts`
- `src/shared/components/ui/` — design system (`ModalHeader`, `InsetGroupedSection`, `InsetRow`, `SelectionListModal`)
- `src/shared/constants/` — `firestore.ts` (paths das coleções)
- `scripts/` — scripts de admin e seed (Admin SDK); documentar no `SCRIPTS.md`

## Convenções
- Código e identificadores em inglês; copy visível ao usuário em português (ver regra de texto human friendly).
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`).
- Branches: `feat/nome-descritivo`, `fix/nome-descritivo`.
- Formulários com `react-hook-form` + `zod`; todo input com `keyboardType` correto.
- Estilos com `StyleSheet.create`, sem estilo inline solto.
- Safe area via `useSafeAreaInsets()` em toda tela nova.

## Não fazer
- Não usar `any`. Casos extremos usam `unknown` + type guard.
- Não instalar dependência nova sem consultar o Iago.
- Não editar `android/` e `ios/` à mão (gerados pelo prebuild). Regenerar com `npx expo prebuild`. Exceção: ajuste de assinatura no Xcode.
- Libs que exigem código nativo novo precisam de rebuild do dev-client, não bastam no Metro. Avisar quando for o caso.
- Nunca versionar `service-account.json`, `.env` nem qualquer segredo.

## Regras de Qualidade — Checklist Obrigatório

### 1. Auth ↔ Dados: Nunca falhar silenciosamente
**Padrão do erro:** Autenticação (Firebase Auth) funciona, mas dado dependente (documento Firestore, perfil, permissões) não existe → app falha silenciosamente sem feedback ao usuário.

**Regra:** Toda vez que construir um fluxo que depende de **autenticação + dado secundário**, SEMPRE implementar:
- **Fallback de criação automática** — se o dado não existe, criar com valores padrão sensatos
- **Feedback visual ao usuário** — nunca deixar o usuário sem saber o que aconteceu (loading, erro, toast)
- **Log de diagnóstico** — `console.warn` para casos inesperados, `console.error` para falhas

**Exemplo concreto (o bug que originou esta regra):**
```
onAuthStateChanged → user autenticado → getDoc('usuarios/{uid}') → doc não existe → setUser(null) → tela de login sem erro
```
**Fix correto:** auto-criar documento com `inferRoleFromEmail()` + `setDoc()`.

**Onde verificar:** qualquer `onAuthStateChanged`, `signIn`, `signUp`, ou listener que dependa de documentos Firestore pós-auth.

### 2. Mapeamento de erros Firebase
Toda interação com Firebase Auth deve ter:
- Mapeamento de códigos de erro (`auth/user-not-found`, `auth/wrong-password`, `auth/invalid-credential`, `auth/too-many-requests`, `auth/network-request-failed`, etc.)
- Mensagem amigável em português para o usuário
- Banner visual de erro (não apenas `console.log`)
- Fallback genérico para códigos não mapeados

### 3. Consistência de dados entre Auth e Firestore
Ao criar/modificar fluxos de usuário, sempre verificar:
- [ ] Usuário autenticado tem documento correspondente em `usuarios/{uid}`?
- [ ] Se não tem, o que acontece? (deve criar automaticamente ou mostrar tela de setup)
- [ ] O `role` do documento bate com o esperado?
- [ ] O `empresaId` está preenchido? (se não, admin vai para SetupEmpresa)
- [ ] Campos obrigatórios (`nome`, `email`, `role`) têm fallbacks?

### 4. Isolamento do enfermeiro (CRÍTICO, não regredir)

**O enfermeiro só acessa os pacientes em que foi autorizado.** Nunca todos os da empresa.

A autorização é a lista `enfermeirosAutorizados: string[]` no doc do paciente, e as `firestore.rules` exigem o uid do enfermeiro nela. A lista vive no paciente (denormalizada) porque as rules não conseguem consultar escalas.

- Quem mantém a lista é o **dono do tenant**: o admin da empresa (criar escala autoriza, remover a última escala do par revoga), ou a família no modo familiar.
- Nas telas do enfermeiro, use `listPatientsVisibleTo(empresaId, uid, originalRole)`. **Nunca `listPatients`**: ela varre a empresa e é negada para o enfermeiro.
- Passe sempre o `originalRole`, não o `role`. Na simulação admin → enfermeiro o uid continua sendo o do admin, que não está em lista nenhuma.
- Consultas do enfermeiro precisam vir restritas: `array-contains` em pacientes, `profissionalId == uid` em escalas e plantões. **Rules não são filtros**: consulta ampla é negada inteira, não filtrada.
- `collectionGroup('registros')` é **só admin**. Uma consulta collectionGroup não enxerga o paciente-pai, então não consegue provar a autorização.
- Paciente novo nasce com a lista vazia. Autorizar é ato explícito.

### 5. Papel do usuário vem da escolha, nunca do e-mail

O cadastro é aberto (`SignUpScreen`), então o papel é definido pela escolha explícita no `SetupEmpresaScreen` (Empresa ou Família). O `inferRoleFromEmail` no `useAuth` é só fallback de contas de teste criadas no Console: se ele decidisse, quem escrevesse "admin" no e-mail viraria admin.

A conta nasce com `empresaId: ''`, o que a torna inerte (toda regra de dado exige `belongsToCompany`). Para ativar, é preciso reivindicar um tenant, e as rules só aceitam tenant cujo `ownerUid` é o próprio usuário.

### 6. Vínculo família ↔ paciente nasce de quem tem autoridade, nunca do que o usuário digita

**Nenhum dado prova parentesco.** CPF, sobrenome, data de nascimento: o vizinho também sabe. Então o app **nunca oferece "escolher um paciente"**. Se ninguém pode reivindicar, não há o que verificar.

Os três caminhos válidos, todos ancorados em alguém que já tem autoridade:

- **Modo empresa:** o admin vincula. A âncora é humana e offline (a empresa conhece a família, tem contrato com ela).
- **Modo familiar:** a família cria o paciente. Criar é ser dono. As rules só deixam reivindicar `pacienteId` de paciente cujo `criadoPorUid` é você.
- **Parente extra:** a titular convida (`inviteRelativeAccount`), e o `pacienteId` vai preenchido por ela.

**Titular x acompanhante** (`familiaTitular`): a titular responde pelo cadastro (edita paciente, prescrições, gerencia enfermeiro, convida parentes). O acompanhante só lê. Campo ausente = titular, e o default nas rules é `true` para não trancar contas antigas fora.

No modo empresa a família **não** convida: a empresa é a cliente, é quem paga e é a controladora dos dados. Ela já tem `InviteFamilyScreen` e `LinkFamilyScreen`.

Cobrança por acesso extra (futuro) não precisa de campo novo: acessos por paciente = contar `usuarios` com `role: 'family'` e aquele `pacienteId`.

**Limitação conhecida (uma conta = um tenant):** cada usuário tem um só `empresaId`, e o e-mail é único no Firebase Auth. A conta do enfermeiro é dele (e-mail próprio + `mustChangePassword`), nunca compartilhada, então enfermeiro rotativo dentro de UMA família é seguro (uma conta por pessoa, cada ação com o uid dela). Mas o MESMO enfermeiro atendendo VÁRIAS famílias não cabe hoje: o segundo convite com o mesmo e-mail falha (`auth/email-already-exists`), porque a conta já pertence a outro tenant. Resolver de verdade exige participação multi-tenant (usuário pertencer a N tenants) ou identidade do enfermeiro recebendo acesso a pacientes de tenants diferentes. É mudança de arquitetura, adiada até o caso virar comum.

### 7. COREN é atestado pelo admin, e o enfermeiro não edita o próprio

`corenRegistro` é estruturado (UF, número, categoria) e guarda o atesto de quem conferiu no Cofen, com autor e data. O Cofen não tem API pública, então a conferência é assistida: botão que abre o Sigen e checkbox de confirmação.

O `corenRegistro` é **imutável para o próprio usuário** (rules). Se o enfermeiro pudesse editar o próprio número, o atesto não valeria nada. Isso não impede admin relapso, e não reverifica com o tempo: o que entrega é a trilha de auditoria.

### 8. Apple HIG — Design obrigatório (CRÍTICO)
**Este app DEVE seguir os padrões de design da Apple (Human Interface Guidelines).** Toda decisão de UI deve ser validada contra o que a Apple faria. Não usar padrões Material Design, Android, ou web.

#### Modais e Sheets
- **Header:** "Cancelar" (texto, esquerda) + Título (centro) + "OK"/"Salvar"/"Adicionar" (texto bold, direita, cor accent)
- **NUNCA usar ícone X** para fechar modais de criação/edição — X é padrão Material Design
- Apresentação: bottom sheet (não fullscreen), com grabber handle quando aplicável
- Modais de criação devem ter `maxHeight: '85%'` e scroll interno

#### Formulários
- **Inset Grouped style:** campos agrupados em seções com fundo `colors.surface`, cantos arredondados, separados por hairlines internas (`StyleSheet.hairlineWidth`)
- Labels à esquerda, valores/controles à direita na mesma row
- **NUNCA usar floating labels** dentro de inputs (padrão Material Design)
- Seções separadas por espaço vertical, com header label em uppercase acima

#### Seleção de itens (pessoas, categorias)
- **NUNCA usar chips** para seleção em formulários — chips são padrão Material Design / Web
- Usar **drill-down row:** label esquerda + valor selecionado em cinza à direita + chevron `>`
- Ao tocar, abrir lista de seleção (push ou sheet secundário) com checkmark no item selecionado
- Para seleção simples de 2-4 opções, segmented control é aceitável

#### Inputs de data/hora
- **NUNCA usar TextInput para horários ou datas** — anti-pattern no iOS
- Usar `@react-native-community/datetimepicker` com `display="spinner"` (wheel picker nativo)
- O picker deve expandir inline ao tocar na row do horário
- Formato: exibir valor formatado na row, picker aparece abaixo ao selecionar

#### Botões de ação
- Ação primária no **header à direita** como texto (não botão full-width no bottom)
- Botão desabilitado = texto com opacidade reduzida, mesmo estilo
- Se usar botão full-width no bottom (aceitável em telas de cadastro longas), deve ser com cantos arredondados grandes (`borderRadius.full`)

#### Navegação e feedback
- Voltar: seta + texto "Voltar" (ou título da tela anterior), cor accent
- Confirmação de ação: `Alert.alert` nativo do iOS (nunca toast custom ou snackbar)
- Destructive actions: texto vermelho, confirmação obrigatória via Alert

#### Referências de implementação
- Estudar: iOS Calendar "New Event", Contacts "New Contact", Reminders "New Reminder"
- Package para pickers: `@react-native-community/datetimepicker`
- Seguir: https://developer.apple.com/design/human-interface-guidelines/

### 9. Telas novas — checklist visual
- Seguir obrigatoriamente as regras Apple HIG da seção 8 acima
- Usar componentes do design system (`ScreenHeader`, `FormInput`, `PrimaryButton`, `InsetGroupedSection`, `InsetRow`, `SelectionListModal`, `SegmentedControl`)
- Ícones: sempre Ionicons (nunca emoji)
- Cor primária: `colors.primary` (#6C63FF), nunca hardcoded
- Loading states em todos os botões de ação
- Safe area insets via `useSafeAreaInsets()`

### 10. Zero placeholders — Nenhum elemento de UI sem funcionalidade
**Regra absoluta:** NUNCA criar um botão, link, menu ou qualquer elemento tocável sem funcionalidade real. Se a funcionalidade não pode ser implementada agora, NÃO crie o elemento visual.

**Proibido:**
- `TouchableOpacity` sem `onPress` ou com `onPress` vazio
- Botões decorativos que não fazem nada ao tocar
- Menus de perfil que são apenas visuais
- Dizer que o projeto está "pronto" ou "funcional" quando existem placeholders ou funcionalidades ausentes

**Se o elemento precisa existir no layout mas a feature não está pronta:**
- Implementar a funcionalidade mínima viável (ex: "Esqueci a senha" → chamar `sendPasswordResetEmail`)
- OU mostrar toast/alert informando "Em breve" com `onPress` real
- OU não criar o elemento até que a funcionalidade esteja implementada

**Ao reportar status do projeto:** Listar EXPLICITAMENTE o que falta, nunca dizer "pronto" com ressalvas escondidas.

## Estrutura de Cores
- Primary (purple): #6C63FF
- Admin (orange): #FF6B35  
- Family (cyan): #00BCD4
- Error: #EF4444
- Sempre usar tokens de `core/theme/theme.ts`, nunca valores hardcoded
