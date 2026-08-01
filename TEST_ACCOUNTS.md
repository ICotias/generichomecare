# Contas de teste (Benevita)

Referência para testes manuais. **Não é usado pelo app** e não deve guardar senhas reais.

> Este arquivo envelhece rápido. Para ver o que existe de fato no banco agora, rode:
>
> ```bash
> node scripts/listContas.js
> ```
>
> Ele cruza o Firebase Auth com os perfis do Firestore e mostra papel, tenant, status,
> contas órfãs e os pacientes de cada empresa.

## Contas criadas pelo seed mínimo

Geradas por `node scripts/seedMinimo.js`. Senha de todas: `Demo@123`, sem troca obrigatória.

| Papel | E-mail | Observação |
| --- | --- | --- |
| Admin | admin@benevita.test | dono da empresa `clinica-benevita-demo` |
| Cuidador | enfermeiro@benevita.test | autorizado na paciente Dona Teste |
| Família | familia@benevita.test | titular, vinculada à Dona Teste |

Paciente: **Dona Teste**, cadastro completo e ativo.

## Contas criadas manualmente durante os testes

Contas que você criar pelo aplicativo (cadastro de família, convite de profissional ou de
parente) não aparecem aqui. Use o `listContas.js` para vê-las.

Convidados nascem com senha temporária e `mustChangePassword: true`. No aparelho real a
senha vai na mensagem de WhatsApp; no simulador a mensagem não é enviada, então defina uma
senha conhecida:

```bash
node scripts/resetTestPassword.js <email>       # usa Demo@123
```

## Recomeçar do zero

```bash
node scripts/resetApp.js            # dry-run, só mostra o que apagaria
node scripts/resetApp.js --yes      # apaga Firestore + Auth
node scripts/seedMinimo.js          # recria admin, cuidador, família e paciente
```

## Identificadores do projeto

| Item | Valor |
| --- | --- |
| Bundle ID (iOS) e package (Android) | `com.benevita.app` |
| Projeto Firebase | `generichomecare` (imutável) |
| Admin de simulação | `iago.admin@test.com` (único que pode simular papéis) |
