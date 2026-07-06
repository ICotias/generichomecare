# HomeCare App — Regras de Desenvolvimento

## Projeto
App React Native (Expo SDK 54, dev-client) com Firebase JS SDK (Auth, Firestore, Storage), Zustand, React Navigation v7, TypeScript strict.

## Contexto do projeto
HomeCare é um app de gestão de cuidado domiciliar com três perfis: empresa (admin), enfermeiro e família. O enfermeiro registra o plantão pelo celular, com funcionamento offline. A família acompanha o cuidado em tempo real. A gestão administra pacientes, equipe, escalas e financeiro.

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

## Comandos
- Rodar no device: `npx expo run:ios --device` / `npx expo run:android --device` (dev-client). Metro: `npx expo start --dev-client`.
- Build na nuvem: `npx eas build -p android --profile preview` (gera APK). iPhone físico via cabo com Xcode (conta gratuita, validade de 7 dias).
- Checagem de tipos: `yarn typecheck` (`tsc --noEmit`)
- Lint: `yarn lint` (ESLint, `--max-warnings 0`)
- Seed de dados: `yarn seed:all`, `yarn seed:teste`, `yarn seed:escalas`
- Diagnóstico Expo: `npx expo-doctor`
- Deploy de regras: `firebase deploy --only firestore:rules`

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

### 4. Apple HIG — Design obrigatório (CRÍTICO)
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

### 5. Telas novas — checklist visual
- Seguir obrigatoriamente as regras Apple HIG da seção 4 acima
- Usar componentes do design system (`ScreenHeader`, `FormInput`, `PrimaryButton`, `PatientDropdown`, `SectionLabel`)
- Ícones: sempre Ionicons (nunca emoji)
- Cor primária: `colors.primary` (#6C63FF), nunca hardcoded
- Loading states em todos os botões de ação
- Safe area insets via `useSafeAreaInsets()`

### 6. Zero placeholders — Nenhum elemento de UI sem funcionalidade
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
