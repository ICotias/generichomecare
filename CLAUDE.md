# HomeCare App — Regras de Desenvolvimento

## Projeto
App React Native (Expo SDK 54, dev-client) com Firebase JS SDK (Auth, Firestore, Storage), Zustand, React Navigation v7, TypeScript strict.

## Regras Gerais
- Sempre usar **yarn** (nunca npm)
- Avisar sobre necessidade de deploy Firebase quando alterar rules/indexes
- Sempre fornecer código Firebase (rules, indexes) quando modificar estrutura Firestore
- Push notifications bloqueadas até conta paga Apple Developer
- O desenvolvedor é **Iago** (não Kai)

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

### 5. Zero placeholders — Nenhum elemento de UI sem funcionalidade
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
