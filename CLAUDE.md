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

### 4. Telas novas — checklist visual
- Usar componentes do design system (`ScreenHeader`, `ChipSelector`, `FormInput`, `PrimaryButton`, `PatientDropdown`, `SectionLabel`)
- Ícones: sempre Ionicons (nunca emoji)
- Cor primária: `colors.primary` (#6C63FF), nunca hardcoded
- Títulos: duas linhas (preto + colorido) quando aplicável
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
