# Integridade e Segurança do HomeCare

Este documento reúne tudo o que foi feito no app para garantir a integridade dele: consistência dos dados, confiabilidade dos registros clínicos, trilha de auditoria, controle de acesso e proteção de segredos. A ideia é ter num lugar só o retrato de como o app se mantém correto e seguro, o que já está implementado e o que fica como próximo passo.

O app é React Native com Expo, usando o Firebase pelo JS SDK do cliente (Authentication, Cloud Firestore e Cloud Storage), estado com Zustand e TypeScript. Ele trata dados de saúde de pacientes, ou seja, dados pessoais sensíveis sob a LGPD, então a régua de cuidado é alta.

---

## 1. Consistência entre autenticação e dados

O erro clássico nesse tipo de app é a autenticação funcionar, mas o dado dependente não existir, e o app falhar em silêncio. O HomeCare trata isso de forma explícita.

Auto criação de perfil. No primeiro login, se o documento do usuário em `usuarios/{uid}` não existir, ele é criado automaticamente com valores padrão sensatos, inferindo o papel a partir do contexto, em vez de deixar o usuário numa tela vazia. A lógica fica em `src/core/hooks/useAuth.ts`.

Feedback e diagnóstico. Fluxos que dependem de autenticação mais um dado secundário sempre têm estado de carregamento, mensagem de erro e log de diagnóstico, para o usuário nunca ficar sem saber o que aconteceu.

Reconciliação de sessão. Existe um `refreshUser` que relê o perfil do usuário e atualiza o estado, usado quando algo muda por fora, por exemplo quando a família é vinculada a um paciente e a tela precisa avançar sozinha.

Vínculo único de paciente. O campo `pacienteId` do familiar é um vínculo único: só pode ser definido quando ainda está vazio e não pode ser repontado para outro paciente. Isso é garantido na própria regra do Firestore, não só na tela.

---

## 2. Integridade dos registros clínicos

Registros de cuidado são a parte mais sensível. Eles precisam ser confiáveis e não podem ser adulterados.

Imutabilidade. Registros de cuidado e evoluções permitem apenas criação. Atualização e exclusão são bloqueadas na regra (`allow update, delete: if false`). Um registro feito é um registro que fica, sem edição posterior pelo cliente.

Campos obrigatórios na criação. A regra valida que o registro tem tipo, paciente e profissional, e que o profissional é o próprio usuário autenticado, evitando registro em nome de outra pessoa.

Visibilidade controlada para a família. Cada registro carrega o campo denormalizado `visibleToFamily`. A família só lê o que é visível e a leitura precisa incluir esse filtro na consulta, senão é negada. Fotos clínicas ficam fora do alcance da família, inclusive no Storage, como defesa em profundidade.

Fila offline com sincronização. O profissional registra em campo, muitas vezes sem sinal. Os registros entram numa fila local (`src/core/services/offlineQueue.ts` e `src/core/hooks/useOfflineSync.ts`) com um `syncStatus`, e sincronizam sozinhos quando a conexão volta. Nada de cuidado se perde por falta de internet, e o estado de cada registro é rastreável.

---

## 3. Trilha de auditoria

O app mantém um registro de eventos em `auditLog` (`src/core/services/auditService.ts`), gravado a cada login e logout no `useAuth`. Esse log é create only: uma vez escrito, não pode ser alterado nem apagado pelo cliente, e o admin lê apenas os eventos da própria empresa. Quando houver Cloud Functions, a escrita deve migrar para o Admin SDK, para blindar ainda mais.

---

## 4. Controle de acesso (regras do Firebase)

Quase toda a segurança dos dados mora aqui, porque o app roda no aparelho do usuário e pode ser ignorado por quem chamar o Firebase direto. O modelo aplicado:

Negação por padrão. Tudo começa bloqueado. Uma regra final `match /{document=**} { allow read, write: if false; }` fecha qualquer caminho não previsto. O mesmo vale no Storage.

Isolamento por empresa. Toda leitura e escrita é amarrada ao `empresaId` do usuário, então uma empresa nunca enxerga dados de outra.

Menor privilégio por papel. Existem três papéis, nurse, family e admin, cada um com alcance próprio. O admin gerencia a empresa, o profissional atua nos pacientes, e a família vê apenas o seu paciente vinculado.

Proteção contra escalonamento de privilégio. Quando o usuário atualiza o próprio perfil, a regra impede que ele troque o próprio papel ou a própria empresa. Ninguém se promove a admin sozinho.

Validação de payload. Criações validam campos e valores esperados, cortando dado malformado e campos indevidos.

Sobre o Storage. O app não usa o Firebase Storage. As fotos são guardadas como base64 dentro do próprio registro no Firestore, então valem as mesmas regras dos registros. O arquivo `storage.rules`, o `storageService` e a inicialização `getStorage` são resquícios de uma abordagem antiga e estão dormentes. A recomendação é removê-los para não confundir e não abrir superfície desnecessária.

### Correções aplicadas nesta rodada de segurança

Escalas e plantões restritos à equipe. A leitura estava liberada para qualquer membro da empresa, o que deixava a família enxergar a agenda e os plantões de todos os pacientes. Passou a ser exclusiva de profissional e admin, que são os únicos que usam essas telas.

.gitignore endurecido. Passou a ignorar qualquer `.env`, o `serviceAccountKey.json` e keystores de release, além dos padrões que já existiam.

Dependabot ativado. Foi adicionado `.github/dependabot.yml` para monitorar vulnerabilidades das dependências e abrir correções revisáveis.

Qualquer mudança em regras exige `firebase deploy --only firestore:rules,storage` para valer em produção.

---

## 5. Segredos e chaves

Service account fora do git. A chave do Admin SDK, que ignora todas as regras, nunca foi versionada e está protegida pelo `.gitignore`. Ela vive apenas localmente e nunca vai para o app.

A apiKey do cliente não é segredo. A chave web do Firebase pode ficar no código. O que protege os dados são as regras e o App Check, não esconder a chave.

Segredos de build. Tokens e chaves de terceiros devem ficar em variáveis de ambiente do build, por exemplo EAS Secrets, nunca hardcoded.

No aparelho. Token e credencial devem usar `expo-secure-store`, que usa o Keychain no iOS e o Keystore no Android. O AsyncStorage é texto puro e serve só para estado e preferências, nunca para segredo ou dado sensível de saúde.

---

## 6. Qualidade e ausência de brechas de interface

A integridade também passa por não enganar o usuário com elementos que não funcionam.

Zero placeholders. Nenhum botão, link ou menu existe sem função real. Se a funcionalidade não está pronta, o elemento não é criado.

Padrões de design consistentes. A interface segue as diretrizes da Apple, com componentes do design system, estados de carregamento nos botões de ação e feedback claro de erro, o que reduz ação acidental e confusão.

---

## 7. Verificação

TypeScript no modo estrito e ESLint são rodados a cada mudança relevante (`yarn typecheck` e `yarn lint`).

As regras do Firebase devem ser testadas no emulador antes de publicar, e conferidas no simulador de regras do console. Regra sem teste é risco.

Há oito índices compostos definidos em `firestore.indexes.json`, necessários para as consultas do app funcionarem de forma previsível.

---

## 8. Recomendações e próximos passos

App Check. Ligar o App Check garante que as chamadas ao Firestore e ao Storage venham do app verdadeiro, cortando bots e uso do backend por fora do app. Precisa de provider nativo e de um rollout cuidadoso: configurar, subir uma versão com ele, acompanhar as métricas e só então ativar o enforce, para não bloquear usuários legítimos.

Custom claims. Migrar papel e empresa para custom claims, definidos pelo Admin SDK, deixa a autorização mais barata e ainda mais difícil de burlar. É otimização, não urgência, já que o modelo atual já protege contra troca de papel.

LGPD e retenção. Formalizar aceite de termo destacado no onboarding, política de retenção consciente (respeitando a guarda do prontuário), minimização de coleta e uma rota de atendimento a pedidos do titular.

Observabilidade sem PII. Se um monitor de erros for adotado, configurar remoção de dados sensíveis antes do envio e nunca logar nome de paciente, dado clínico ou token.

---

## Documentos relacionados

- `docs/SEGURANCA.md`: relatório detalhado de segurança, com exemplos de regras e checklist.
- `SCRIPTS.md`: referência dos scripts utilitários.
- `docs/CHECKLIST_DEPLOY.md`: checklist de deploy.
- `CLAUDE.md`: regras de desenvolvimento e qualidade do projeto.
