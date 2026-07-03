# Segurança do HomeCare

Relatório de segurança focado na nossa stack: React Native com Expo, Firebase pelo JS SDK do cliente (Authentication, Cloud Firestore, Cloud Storage), Zustand e TypeScript. Como o app lida com dados de saúde de pacientes, ele trata dados pessoais sensíveis sob a LGPD, o que eleva bastante a régua.

O resumo é direto: num app assim, quase toda a segurança dos dados mora nas regras do Firebase e no controle de acesso, não no aplicativo. O app roda no aparelho do usuário, ou seja, é território hostil. Qualquer pessoa pode inspecionar o tráfego, extrair a configuração e chamar o Firebase direto, sem passar pela sua interface. Então a pergunta certa não é "meu app está seguro", e sim "meu backend continua seguro quando alguém ignora o meu app".

---

## 1. Vazamentos de dados: como acontecem

A causa número um de vazamento em apps Firebase é regra de segurança permissiva. Quem souber o ID do projeto (que fica visível no app) consegue ler, alterar ou apagar os dados se as regras deixarem. Isso não é teoria: em setembro de 2025 um pesquisador mostrou cerca de 150 endpoints Firebase de apps populares acessíveis sem autenticação nenhuma, expondo bancos, buckets de storage e coleções inteiras. Casos famosos como o do app Tea expuseram selfies e documentos de milhões de pessoas por bucket mal configurado.

Os padrões de falha mais comuns são:

Regra de teste esquecida em produção. O modo de teste do Firebase nasce com `allow read, write: if true` e expira em 30 dias, mas muita gente estende ou esquece. Um estudo da Wiz em 2025 apontou que apps feitos com ajuda de IA sofrem muito disso, porque a IA gera a regra de início rápido e o dev publica sem revisar.

Autenticação sem autorização. A regra checa `request.auth != null` e para por aí. Isso libera o dado para qualquer usuário logado, inclusive de outra empresa. No nosso caso, seria o pior cenário: um familiar de um paciente conseguindo ler o prontuário de outro.

Falta de isolamento multi-tenant. Como temos várias empresas na mesma base (`empresas/{empresaId}/...`), a regra precisa amarrar cada leitura e escrita ao `empresaId` do usuário. Sem isso, uma empresa enxerga dados da outra.

Consultas client-side confiando no filtro do app. O app pode até filtrar a lista, mas o atacante consulta a coleção direto pela API. O filtro real tem que estar na regra, nunca só na query da tela.

Dados sensíveis em lugares errados. Nome de paciente ou id em URL, em query string, em log, em analytics ou em mensagem de erro também é vazamento.

---

## 2. Regras do Firestore e do Storage

Este é o coração da defesa. Princípios:

Negar por padrão. Comece bloqueando tudo e libere só o necessário, caminho por caminho. Nunca use um `match /{document=**}` aberto.

Menor privilégio. Cada perfil enxerga apenas o que precisa. Admin da empresa, enfermeiro escalado e familiar do paciente têm alcances diferentes.

Autorização por claim, não por leitura de documento. Hoje, se a regra lê o documento `usuarios/{uid}` para descobrir o papel, cada checagem custa uma leitura e depende de um dado que o cliente ajuda a manter. O padrão mais seguro e barato é colocar `role` e `empresaId` em custom claims, que só o Admin SDK define no servidor e o cliente não consegue forjar.

Validar o que entra. Na criação de um registro, valide campos obrigatórios, tipos e valores. Isso evita lixo e injeção de campos que não deveriam existir.

Imutabilidade onde faz sentido. Registros clínicos não devem ser editados nem apagados pelo cliente. Permita create e bloqueie update e delete.

Exigir App Check. Some `request.app != null` para recusar chamadas que não vêm do app legítimo.

Exemplo de regras alinhado ao nosso modelo (ilustrativo, ajuste aos campos reais):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helpers baseados em custom claims (definidos via Admin SDK)
    function signedIn()   { return request.auth != null; }
    function fromApp()     { return request.app != null; }            // App Check
    function empresa()     { return request.auth.token.empresaId; }
    function role()        { return request.auth.token.role; }
    function isAdmin()     { return role() == 'admin'; }
    function sameEmpresa(eid) { return signedIn() && empresa() == eid; }

    // Bloqueia tudo por padrão
    match /{document=**} { allow read, write: if false; }

    match /empresas/{empresaId} {

      // Só quem é da empresa e passou pelo App Check entra
      allow read: if fromApp() && sameEmpresa(empresaId);

      match /pacientes/{pacienteId} {
        // Admin vê todos da empresa; familiar vê só o paciente dele;
        // enfermeiro vê os pacientes que estão na escala dele.
        allow read: if fromApp() && sameEmpresa(empresaId) && (
          isAdmin() ||
          request.auth.token.pacienteId == pacienteId ||
          exists(/databases/$(database)/documents/empresas/$(empresaId)/escalas/$(request.auth.uid + '_' + pacienteId))
        );

        // Registros clínicos: criar sim, alterar ou apagar não
        match /registros/{registroId} {
          allow read: if fromApp() && sameEmpresa(empresaId) && (
            isAdmin() ||
            request.auth.uid == resource.data.profissionalId ||
            (request.auth.token.pacienteId == pacienteId && resource.data.visibleToFamily == true)
          );
          allow create: if fromApp() && sameEmpresa(empresaId)
            && request.resource.data.empresaId == empresaId
            && request.resource.data.pacienteId == pacienteId
            && request.resource.data.profissionalId == request.auth.uid
            && request.resource.data.type is string;
          allow update, delete: if false;
        }
      }

      match /financeiro/{doc} {
        allow read, write: if fromApp() && sameEmpresa(empresaId) && isAdmin();
      }
    }
  }
}
```

Para o Storage, a lógica é a mesma. Nunca deixe `allow read, write: if true`. Amarre o caminho ao dono ou à empresa e valide tipo e tamanho do arquivo:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /empresas/{empresaId}/pacientes/{pacienteId}/{arquivo} {
      allow read: if request.auth != null
        && request.auth.token.empresaId == empresaId;
      allow write: if request.auth != null
        && request.auth.token.empresaId == empresaId
        && request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Uma observação sobre o Storage: as regras de leitura protegem o acesso via SDK, mas uma URL de download assinada, uma vez gerada e vazada, pode ser aberta por qualquer um até expirar. Trate essas URLs como segredo e prefira gerar sob demanda.

Teste as regras antes de publicar. Use o emulador do Firebase com testes automatizados das regras, e o simulador de regras no console para conferências rápidas. Regra sem teste é regra que você acha que funciona.

Sempre que a estrutura do Firestore mudar, atualize e publique `firestore.rules` e os índices, e valide de novo.

---

## 3. Chaves e segredos

A apiKey do Firebase que fica no app não é um segredo. Ela só identifica o projeto. Pode estar no código sem problema, porque a segurança vem das regras e do App Check, não de esconder a chave. O risco aparece quando a chave está sozinha, sem regras firmes e sem App Check, porque aí ela permite chamar a API à vontade.

O que é segredo de verdade e nunca pode ir para o cliente nem para o git:

O `service-account.json`. Essa chave é do Admin SDK e ignora todas as regras de segurança. Quem tem ela tem acesso total ao projeto. Ela já está no nosso `.gitignore`, o que é correto. Reforce: nunca commitar, nunca colocar no app, guardar em local protegido.

Qualquer token, senha ou chave de API de terceiros. Esses ficam em variáveis de ambiente do build, por exemplo EAS Secrets, e nunca hardcoded.

No aparelho, separe o que é segredo do que é preferência. Segredo (token de sessão, credencial) vai no `expo-secure-store`, que usa o Keychain do iOS e o Keystore do Android. Preferência e estado comum podem ir no AsyncStorage. Ver o item 4.

---

## 4. Armazenamento local no dispositivo

O AsyncStorage guarda tudo em texto puro, sem criptografia, no sistema de arquivos do app. Em aparelho com root ou jailbreak, dá para ler. Então a regra prática é:

Segredos e dados sensíveis em `expo-secure-store`. Token de autenticação, credenciais e afins. O SecureStore é pequeno, serve para valores curtos, não é banco de dados.

Estado, cache e preferências no AsyncStorage ou no MMKV. É onde o Zustand costuma persistir. Só não coloque ali dado sensível de saúde nem token.

Cuidado com foto de paciente em base64. Guardar imagem clínica em base64 dentro de cache não criptografado é exposição. Se precisar de cache local dessas imagens, use armazenamento protegido e limpe quando não precisar mais.

Evite reter no aparelho mais do que o necessário. Quanto menos dado sensível ficar em cache local, menor o estrago se o aparelho for perdido ou comprometido.

---

## 5. Autenticação e autorização

Autenticar diz quem é a pessoa. Autorizar diz o que ela pode fazer. As duas moram no servidor, nunca só no app.

Nunca confie no cliente para autorização. Esconder um botão na tela não protege nada. A permissão real está na regra do Firestore e nas custom claims.

Use custom claims para papel e empresa. Defina `role` e `empresaId` via Admin SDK, do lado do servidor. O cliente não consegue alterar. As regras leem direto do token, sem custo de leitura extra e sem risco de adulteração.

Ligue o App Check e coloque em enforce. Ele garante que as chamadas ao Firestore, Storage e Functions venham do seu app de verdade, cortando bots e scripts. No console, em Segurança, App Check, você habilita por produto e clica em Enforce. Leva até 15 minutos para valer. Importante: só ligue o enforce depois que o app já estiver inicializando o App Check, senão você bloqueia usuários legítimos. Vale checar o suporte do App Check no seu setup de Expo antes, porque envolve provider nativo.

Verificação de e-mail e fluxos sãos. Confirme e-mail quando fizer sentido, trate os códigos de erro de auth com mensagens claras e evite vazar se um e-mail existe ou não. Proteja contra abuso de tentativas.

---

## 6. Transporte e entrada

Só HTTPS e TLS. Qualquer chamada de rede tem que ser criptografada em trânsito. O Firebase já usa, mas se você adicionar APIs próprias, mantenha o padrão e considere bloquear tráfego em texto puro no app.

Cuidado com deep links. Link que abre o app pode carregar parâmetros maliciosos. Valide e nunca confie cegamente no que vem por ali, principalmente se levar a alguma ação.

Valide e sane a entrada. Todo dado que entra, de formulário ou de link, deve ser validado por tipo e formato, tanto no app quanto na regra. Isso corta injeção e dado malformado.

Evite over-fetching. Traga só os campos e documentos necessários. Quanto menos dado sensível trafega e fica em cache, menor o risco.

---

## 7. Dependências e cadeia de suprimentos

Ataques via pacote npm estão em alta e miram justo quem usa React Native. Em março de 2026, dois pacotes populares de RN (`react-native-international-phone-number` e `react-native-country-select`) tiveram versões maliciosas com um hook de preinstall que executava código durante o `install`, antes de qualquer código do app rodar. O axios, com mais de 100 milhões de downloads por semana, também foi comprometido por sequestro de conta do mantenedor.

O que fazer:

Instale sempre a partir do lockfile. Em CI e em build, use instalação travada no lockfile (no nosso caso, `yarn install --frozen-lockfile`), nunca resolvendo versões novas na hora. Isso evita puxar uma versão comprometida de repente.

Fixe versões críticas. Para pacotes sensíveis, evite deixar tudo com `^`, que aceita minor e patch novos automaticamente. Atualize de forma deliberada e revisada.

Audite o lockfile, não só o package.json. Muitos ataques vêm por dependência transitiva, que só aparece no lockfile. Rode auditoria com frequência (`yarn audit` ou `npm audit` sobre o lockfile).

Ligue o Dependabot no GitHub. Ele abre PRs automáticos para vulnerabilidades e mantém a atualização como algo revisado, não silencioso. Para projeto pequeno, semanal está bom.

Atenção ao preinstall. Nós temos um `preinstall` com `only-allow yarn`, que é legítimo. Mas justamente por hooks de install serem um vetor de ataque, revise scripts de install de dependências novas antes de aceitar.

---

## 8. Observabilidade sem vazar PII

Log, analytics e monitor de erro são fontes silenciosas de vazamento. Se você loga o objeto do paciente para depurar, o dado sensível vai parar num serviço externo.

No Sentry, use o `beforeSend` e o `beforeBreadcrumb` para remover dados sensíveis antes de enviar, e configure scrubbing no lado do servidor do Sentry também. Lembre que breadcrumbs capturam logs anteriores e query strings, então não logue PII se usar esse recurso.

Regra geral: nunca logar informação confidencial. Nome de paciente, dado clínico, token e id sensível ficam fora de log, de analytics e de mensagem de erro. Em produção, reduza o nível de log e evite dumps de objeto inteiro.

---

## 9. LGPD e dados de saúde

Dado de saúde é dado pessoal sensível na LGPD, com proteção reforçada. Pontos que se aplicam ao HomeCare:

Base legal e consentimento. O tratamento de dado sensível de saúde exige autorização expressa e destacada do titular ou do representante legal, para finalidade específica. Vale ter um aceite claro no onboarding, registrando data e versão do termo.

Minimização. Colete e mostre só o mínimo necessário para o cuidado. Menos campo sensível, menos superfície de risco. Isso também vale para as telas: mostrar só o que aquele perfil precisa ver.

Controle de acesso por necessidade. Cada perfil acessa apenas o que lhe cabe, com registro de auditoria de quem acessou o quê. Nós já gravamos auditoria de login e logout, o que é um bom começo. Vale estender para acessos a dados sensíveis.

Retenção. A LGPD manda eliminar o dado quando acaba a finalidade, mas na saúde o prontuário tem regra própria e costuma ser guardado por 20 anos. Ou seja, defina uma política de retenção consciente, não apague por impulso o que a norma manda guardar, e elimine com segurança o que não precisa mais.

Criptografia em repouso e em trânsito. O Firebase já criptografa em repouso e em trânsito por padrão. Mantenha o TLS em qualquer integração própria.

Um alerta importante: o Firebase não é HIPAA nem automaticamente pronto para saúde em todos os produtos. No Brasil o paralelo é a LGPD. Não parta do princípio de que a plataforma resolve a conformidade sozinha. A responsabilidade pela configuração é sua.

---

## 10. Checklist prático

Regras e acesso
- [ ] Nenhuma regra com `if true` em Firestore ou Storage, e nada em modo de teste em produção
- [ ] Negar por padrão, liberar por caminho, com menor privilégio por perfil
- [ ] Isolamento por `empresaId` em toda leitura e escrita
- [ ] `role` e `empresaId` em custom claims, definidos só pelo Admin SDK
- [ ] Registros clínicos com create permitido e update e delete bloqueados
- [ ] Validação de campos e tipos na criação de documentos
- [ ] Regras testadas no emulador antes de publicar
- [ ] Storage amarrado a dono ou empresa, com limite de tamanho e tipo de arquivo

App Check e auth
- [ ] App Check habilitado e em enforce para Firestore, Storage e Functions
- [ ] Regras exigindo `request.app != null`
- [ ] Autorização sempre no servidor, nunca só na interface
- [ ] Mensagens de erro de login que não revelam se um e-mail existe

Segredos e dispositivo
- [ ] `service-account.json` fora do git e fora do app, sempre
- [ ] Segredos de build em EAS Secrets, nada hardcoded
- [ ] Token e credencial no `expo-secure-store`, não no AsyncStorage
- [ ] Sem dado sensível de saúde em cache local não protegido, incluindo fotos base64

Dependências
- [ ] Build e CI instalando com lockfile travado
- [ ] Auditoria de dependências rodando com frequência, sobre o lockfile
- [ ] Dependabot ligado no repositório
- [ ] Revisão de scripts de install ao adicionar dependência nova

Observabilidade e privacidade
- [ ] `beforeSend` e scrubbing no Sentry, sem PII em breadcrumb
- [ ] Nada de nome de paciente, dado clínico ou token em log e analytics
- [ ] Nada de dado sensível em URL ou query string

LGPD e saúde
- [ ] Aceite de termo destacado e registrado no onboarding
- [ ] Minimização de coleta e de exibição por perfil
- [ ] Auditoria de acesso a dados sensíveis
- [ ] Política de retenção consciente, respeitando a guarda do prontuário
- [ ] Rota de exclusão e de atendimento a pedidos do titular

---

## Fontes

- Firebase, Avoid insecure rules: https://firebase.google.com/docs/rules/insecure-rules
- Firebase, Security checklist: https://firebase.google.com/support/guides/security-checklist
- Firebase, API keys para Firebase: https://firebase.google.com/docs/projects/api-keys
- Firebase, Custom claims e security rules: https://firebase.google.com/docs/auth/admin/custom-claims
- Firebase, App Check: https://firebase.google.com/docs/app-check
- Firebase, Enable App Check enforcement: https://firebase.google.com/docs/app-check/enable-enforcement
- Firebase, Storage security: https://firebase.google.com/docs/storage/security
- Exploiting Firestore Database Rules (Medium, Sethu Satheesh): https://medium.com/@S3THU/exploiting-firestore-database-rules-a-pathway-to-data-breaches-aa945476cc16
- Hacking Firebase Projects, common misconfigurations (m1tz): https://blog.m1tz.com/posts/2025/07/hacking-firebase-projects-enumeration-and-common-misconfigurations/
- Firebase Security Rules, common mistakes: https://checkvibe.dev/blog/firebase-security-rules-guide
- Como tornar o Firebase compatível com saúde (officeconsumer): https://officeconsumer.com/how-to-make-firebase-hipaa-compliant-w-examples-faqs/
- React Native, Security (doc oficial): https://reactnative.dev/docs/security
- Expo SecureStore, LogRocket: https://blog.logrocket.com/encrypted-local-storage-in-react-native/
- Credential Security in React Native, OWASP Mobile Top 10 (Medium): https://medium.com/@bariskandemirx/credential-security-in-react-native-owasp-mobile-top-10-m1-5da9cb7666dd
- Malicious React Native npm releases (StepSecurity): https://www.stepsecurity.io/blog/malicious-npm-releases-found-in-popular-react-native-packages---130k-monthly-downloads-compromised
- Axios npm supply chain attack (Trend Micro): https://www.trendmicro.com/en_us/research/26/c/axios-npm-package-compromised.html
- GitHub Docs, Dependabot security updates: https://docs.github.com/en/code-security/concepts/supply-chain-security/about-dependabot-security-updates
- Sentry, Scrubbing sensitive data: https://docs.sentry.io/platforms/apple/guides/ios/data-management/sensitive-data/
- LGPD, tratamento de dados em saúde (Migalhas): https://www.migalhas.com.br/depeso/449916/tratamento-de-dados-em-saude-bases-legais-limites-e-boas-praticas
- LGPD, dados sensíveis (Serpro): https://www.serpro.gov.br/lgpd/menu/protecao-de-dados/dados-sensiveis-lgpd
