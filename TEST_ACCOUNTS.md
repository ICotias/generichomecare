# Contas de teste (Benivita)

Arquivo de referência para testes manuais. **Não é usado pelo app.** Não versionar senhas reais aqui.

Empresa/tenant de teste principal: `clinica-generica-94hdol`
Tenant familiar de teste (modo família): `familia-gabriel-k09b5b`

## Contas do modo família (tenant familia-gabriel-k09b5b)

| Papel | Nome | E-mail | Detalhe | Senha |
| --- | --- | --- | --- | --- |
| Enfermeiro (convidado) | GhxNurse | gabriel.nurse@ghx.com | COREN-BA 456678976857-ENF | temporária, não capturada (ver nota) |
| Acompanhante (convidado) | Irmao Do Ghx | irmaoghx@ghx.com | Sobrinho(a), só leitura | temporária, não capturada (ver nota) |
| Titular da família | Gabriel | (e-mail do cadastro) | dona do tenant | a que você definiu no cadastro |

Nota: os convidados nascem com senha temporária + `mustChangePassword: true`. No device real a senha vai na mensagem de WhatsApp. No simulador a mensagem não é enviada, então use o script `resetTestPassword` para definir uma senha conhecida e entrar (o app vai pedir troca no 1º acesso de qualquer forma).

## Contas do seed (empresa clinica-generica-94hdol)

Senha de todas: `Demo@123`

| Papel | E-mail |
| --- | --- |
| Enfermeiros | enfermeiro1@demo.com ... enfermeiro5@demo.com |
| Famílias | familia1a@demo.com, familia1b@demo.com ... familia10a/10b@demo.com |

## Outras contas de teste avulsas

| Papel | E-mail | Observação |
| --- | --- | --- |
| Enfermeiro | enfermeiro.test@test.com | usada no teste de isolamento |
| Enfermeiro | iago.nurse@test.com | `empresaId` ajustado à mão no Console |
| Admin de simulação | iago.admin@test.com | único e-mail que pode simular papéis (ver `SIMULATION_ADMIN_EMAIL`) |
