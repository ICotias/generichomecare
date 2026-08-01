# HomeCare App — Checklist de Deploy

## 1. Firebase (fazer agora)

```bash
# Na pasta do projeto
firebase login
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

Se der erro de login/projeto, confirme que `.firebaserc` aponta para `generichomecare`.

---

## 2. Google Services: não é necessário

O app usa o **Firebase JS SDK**, que se conecta pelo objeto de configuração em
`src/core/config/firebase.ts` (`projectId`, `authDomain`). Não são necessários o
`google-services.json` (Android) nem o `GoogleService-Info.plist` (iOS), e o app
não depende do bundle identifier para falar com o Firebase.

Identificadores atuais, para referência:

| Item | Valor |
| --- | --- |
| Bundle ID (iOS) e package (Android) | `com.benevita.app` |
| Projeto Firebase | `generichomecare` (não pode ser alterado) |

Só volte a precisar dos arquivos nativos se um dia adotar o React Native Firebase,
push notifications ou login social.

---

## 3. EAS (Expo Application Services)

```bash
# Instalar EAS CLI (se não tiver)
npm install -g eas-cli

# Login na conta Expo
eas login

# Configurar projeto (gera o projectId)
eas build:configure
```

Depois de rodar `eas build:configure`, ele vai gerar um projectId. Substitua nos arquivos:

- **app.json** → `extra.eas.projectId` e `updates.url` (trocar `your-eas-project-id`)
- **src/core/services/notificationService.ts** → linha com `projectId: 'your-eas-project-id'`

---

## 4. Criar ícone de notificação

Crie um PNG 96×96px, fundo transparente, ícone branco (padrão Android).
Salve em: `assets/notification-icon.png`

> Pode usar qualquer gerador online de notification icon. Se não quiser agora, comente a linha do plugin `expo-notifications` no `app.json`.

---

## 5. Primeiro build (desenvolvimento)

```bash
# Build de desenvolvimento (iOS simulator)
eas build --profile development --platform ios

# Build de desenvolvimento (Android emulator)
eas build --profile development --platform android

# OU rodar local com Expo Go (limitado — não tem native modules)
npx expo start
```

---

## 6. Build de preview (teste em device real)

```bash
# Gera um .apk/.ipa para instalar direto no celular
eas build --profile preview --platform all
```

O link de download aparece no terminal quando terminar.

---

## 7. Para publicar nas stores (quando estiver pronto)

### App Store (iOS)
1. Conta Apple Developer **paga** ($99/ano)
2. No `eas.json`, substitua:
   - `appleId` → seu email do Apple Developer
   - `ascAppId` → ID do app no App Store Connect
   - `appleTeamId` → Team ID (aparece no Apple Developer Portal)
3. Rode:
```bash
eas build --profile production --platform ios
eas submit --platform ios
```

### Google Play (Android)
1. Conta Google Play Console ($25 único)
2. Crie uma service account no Google Cloud Console
3. Baixe o JSON e coloque em `google-play-service-account.json`
4. Rode:
```bash
eas build --profile production --platform android
eas submit --platform android
```

---

## 8. Coisas que funcionam sem configuração extra

- ✅ Login/cadastro (Firebase Auth)
- ✅ CRUD de pacientes
- ✅ Todos os registros de cuidados (6 tipos)
- ✅ Passagem de plantão (SBAR)
- ✅ Check-in/checkout com GPS
- ✅ Timeline da família
- ✅ Gráficos de sinais vitais
- ✅ Dashboard admin com métricas
- ✅ Gestão de equipe
- ✅ Financeiro
- ✅ Exportar PDF (relatório + financeiro)
- ✅ Tela LGPD
- ✅ Fila offline (salva local, sincroniza ao reconectar)
- ✅ Mock data como fallback em todas as listas

---

## 9. Coisas que precisam de infra adicional (futuro)

| Feature | O que precisa |
|---------|--------------|
| Push notifications | Apple Developer pago + `yarn add expo-notifications` |
| Upload de fotos reais | Firebase Storage (já tem bucket configurado, falta implementar upload) |
| Audit log no Firestore | Cloud Function (código client-side já está pronto, grava em memória) |
| Relatório financeiro real | Integração com dados reais na collection `financeiro` |

---

## Resumo rápido (copie e cole)

```bash
# 1. Firebase
firebase deploy --only firestore:rules,firestore:indexes

# 2. EAS
npm install -g eas-cli
eas login
eas build:configure

# 3. Primeiro build
eas build --profile development --platform ios
```
