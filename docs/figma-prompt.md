# HomeCare App — Figma Design Prompt

## Visão geral

App mobile de **home care para idosos no Brasil**. Três perfis de usuário (Profissional, Família, Admin) com navegação por bottom tabs (4 abas cada). Estética **Apple HIG** — limpo, espaçoso, tipografia clara, sem poluição visual. Plataforma: iOS e Android (React Native).

---

## Design System

### Cores

| Token | Hex | Uso |
|-------|-----|-----|
| Primary | `#2563EB` | CTAs, links, inputs focados |
| Primary Light | `#60A5FA` | Hovers, badges leves |
| Primary Dark | `#1D4ED8` | Pressed states |
| Success | `#22C55E` | Status ativo, confirmações |
| Warning | `#F59E0B` | Alertas, alergias |
| Error | `#EF4444` | Erros, botão logout |
| Background | `#F8FAFC` | Fundo geral (off-white) |
| Surface | `#FFFFFF` | Cards, inputs |
| Border | `#E2E8F0` | Bordas de cards e inputs |
| Text Primary | `#1E293B` | Títulos, corpo |
| Text Secondary | `#64748B` | Subtítulos, labels |
| Text Muted | `#94A3B8` | Placeholders, hints |
| Nurse (perfil) | `#8B5CF6` | Roxo — cor temática profissional |
| Family (perfil) | `#06B6D4` | Ciano — cor temática família |
| Admin (perfil) | `#F97316` | Laranja — cor temática admin |

### Tipografia

- Title: 34px, weight 700, letter-spacing 0.35
- XXL: 28px
- XL: 22px
- LG: 18px
- MD: 16px (corpo)
- SM: 14px (labels, meta)
- XS: 12px (badges, hints)
- Font: SF Pro (iOS) / Roboto (Android) — system default

### Espaçamento

- XS: 4px | SM: 8px | MD: 16px | LG: 24px | XL: 32px | XXL: 48px

### Border Radius

- SM: 6px | MD: 12px | LG: 16px | XL: 24px | Full: 9999px (pills)

### Componentes base

- **Input**: height 52px, border 1px border color, border-radius MD, padding-horizontal MD, fundo Surface. Focado: border Primary. Erro: border Error.
- **Button primário**: height 56px, border-radius LG, fundo Primary, texto white 18px weight 600. Disabled: opacity 0.6.
- **Button destrutivo**: mesmo mas fundo Error.
- **Card**: fundo Surface, border 1px border color, border-radius MD, padding MD, shadow iOS (0,1 opacity 0.04 radius 4).
- **Chip selector**: padding H-MD V-SM+2, border-radius LG, border 1px. Ativo: fundo Primary, texto white.
- **Section title**: 14px, weight 600, text-secondary, uppercase, letter-spacing 0.8.
- **Status badge**: pill com dot 6px + texto XS weight 600. Fundo: cor do status com 10% opacidade.
- **Avatar placeholder**: círculo com inicial do nome, fundo cor-do-perfil com 10% opacidade, texto cor-do-perfil weight 700.
- **Empty state**: centralizado, título XL weight 600, subtítulo MD text-secondary, CTA opcional.
- **Alert card (alergias)**: fundo warning 5% opacidade, border warning 20%, tags warning pill.

---

## Estrutura de Telas

### Perfil: Profissional (cor: roxo #8B5CF6)

**Bottom Tabs**: Início | Registrar | Plantão | Perfil

#### Tab: Início
1. **NurseHomeScreen** — Saudação contextual ("Bom dia, Maria"), contador de pacientes ativos, lista de cards de pacientes (avatar inicial, nome, idade, tipo atendimento, diagnósticos, badge de alergia amarelo com "!").
2. **PatientDetailScreen** — Header com avatar + nome + idade + tipo. Grid 3x2 de ações rápidas (Medicamento roxo, Sinais vitais vermelho, Alimentação amarelo, Atividade verde, Intercorrência vermelho escuro, Foto azul). Seção de alergias em destaque (card amarelo). Seções: Diagnósticos (tags), Medicamentos em uso (tags), Faixas de sinais vitais (info rows), Dados pessoais, Contato de emergência, Observações.

#### Tab: Registrar
3. **QuickRegisterScreen** — Grid de ações rápidas (mesmo do detalhe) + seletor de paciente.
4. **RegisterMedicationScreen** — Form: paciente (selector), medicamento, dosagem, via (chip selector: oral/sublingual/tópica/IM/SC/IV/retal/inalatória), horário, observações. Botão "Registrar".
5. **RegisterVitalsScreen** — Form: PA sistólica, PA diastólica, FC, FR, Temperatura, SpO₂, Glicemia (opcional), Dor (escala 0-10 slider), observações. Indicadores visuais de fora-da-faixa (vermelho).
6. **RegisterFeedingScreen** — Form: tipo de refeição (chip: café/almoço/lanche/jantar/ceia/outro), aceitação (chip: total/parcial/recusa), volume aproximado, via (oral/sonda), observações.
7. **RegisterActivityScreen** — Form: tipo (chip: banho/higiene/mobilização/exercício/lazer/outro), duração, participação (chip: ativo/assistido/passivo), observações.
8. **RegisterIncidentScreen** — Form: tipo (chip: queda/erro-med/agitação/dispneia/febre/outro), gravidade (chip: leve/moderado/grave), descrição detalhada (multiline), medidas tomadas, notificou família? (toggle).
9. **RegisterPhotoScreen** — Captura/seleção de foto, legenda, categoria (chip: ferida/medicamento/geral).

#### Tab: Plantão
10. **ShiftCheckinScreen** — Já implementada. Tela com botão grande para checkin/checkout com GPS. Mostra status atual (em andamento/finalizado), horário de entrada, paciente vinculado.
11. **ShiftEvolutionScreen** — Resumo do plantão: lista cronológica de todos os registros feitos durante o turno. Botão para assinar evolução com texto livre.

#### Tab: Perfil
12. **NurseProfileScreen** — Card com avatar + nome + email + "Profissional". Seção "Informações" (nome, email, telefone, COREN). Botão logout vermelho.

---

### Perfil: Família (cor: ciano #06B6D4)

**Bottom Tabs**: Timeline | Paciente | Histórico | Perfil

#### Tab: Timeline
13. **FamilyTimelineScreen** — Feed cronológico de registros do paciente vinculado. Cards por tipo (medicamento, sinais vitais, alimentação, etc.) com ícone colorido, horário, profissional responsável, dados resumidos. Pull-to-refresh.

#### Tab: Paciente
14. **PatientInfoScreen** — Dados do paciente read-only (mesmo layout do PatientDetailScreen do profissional, mas sem ações de registro). Nome, idade, diagnósticos, alergias, medicamentos, faixas de sinais vitais.
15. **VitalsChartScreen** — Gráficos de sinais vitais ao longo do tempo (linhas). Filtro por período (7d/30d/90d). PA, FC, temperatura, SpO₂. Faixas normais sombreadas em verde.

#### Tab: Histórico
16. **HistoryFilterScreen** — Filtros: tipo de registro (multi-select chips), período (date range), profissional. Lista de resultados filtrados.

#### Tab: Perfil
17. **FamilyProfileScreen** — Card com avatar + nome + email + "Familiar". Info: nome, email, telefone, parentesco, paciente vinculado. Botão logout.

---

### Perfil: Admin (cor: laranja #F97316)

**Bottom Tabs**: Dashboard | Pacientes | Equipe | Perfil

#### Tab: Dashboard
18. **AdminDashboardScreen** — Cards de métricas: pacientes ativos, cuidadores ativos, plantões hoje, registros hoje. Lista de atividade recente (últimos registros).

#### Tab: Pacientes
19. **PatientListScreen** — Header "Pacientes" + botão "+ Novo". Search bar. Lista de cards (nome, idade, tipo, diagnósticos, badge de status ativo/inativo/alta). Tap → detalhe.
20. **CreatePatientScreen** — Modal. Header com "Cancelar" + "Novo paciente". Form longo com seções: Dados pessoais (nome, data nascimento DD/MM/AAAA, CPF com máscara, gênero chips), Endereço (rua, nº + complemento em row, bairro, cidade + UF em row, CEP), Contato de emergência (nome, parentesco, telefone), Dados clínicos (tipo atendimento chips 24h/Diurno/Noturno/Visita, diagnósticos CSV, alergias CSV, medicamentos CSV, observações multiline). Botão fixo inferior "Cadastrar paciente".
21. **AdminPatientDetailScreen** — Header com "← Pacientes" + "Vincular família". Nome grande + badge status. Seções: Dados pessoais, Endereço, Contato emergência, Diagnósticos (tags), Alergias (tags), Medicamentos (tags), Faixas sinais vitais, Observações. Seção "Alterar status" com 3 chips (Ativo/Inativo/Alta).
22. **LinkFamilyScreen** — Modal. Form para vincular conta de familiar a um paciente. Email do familiar + botão vincular.

#### Tab: Equipe
23. **TeamListScreen** — Header "Equipe" + botão "+ Novo". Lista de cuidadores (avatar, nome, COREN, status). Tap → detalhe.
24. **CreateNurseScreen** — Modal. Form: nome, email, telefone, COREN (opcional), senha temporária (input com toggle mostrar/ocultar). Botão "Criar conta".
25. **NurseDetailScreen** — Dados do cuidador, plantões recentes, métricas.
26. **ScheduleScreen** — Escala de plantões: calendário semanal com cuidadores × pacientes.

#### Tab: Perfil
27. **AdminProfileScreen** — Card avatar + nome + email + "Administrador". Menu: Financeiro →. Seção "Simular perfil" (3 chips: Profissional/Família/Admin com dots coloridos, chip ativo com borda da cor). Botão logout.
28. **FinancialScreen** — Resumo financeiro da empresa.

---

### Telas de Auth (sem tabs)
29. **LoginScreen** — Logo/título "HomeCare" centralizado. Inputs: email + senha (com toggle). Botão "Entrar". Link "Esqueci a senha".
30. **SetupEmpresaScreen** — Onboarding para admin sem empresa. Form: nome da empresa, CNPJ (opcional), cidade (opcional). Botão "Criar empresa".

### Componente global
31. **SimulationBanner** — Banner laranja fixo no topo (acima das tabs) quando admin está simulando outro perfil. Texto: "Simulando: Profissional" + tap para voltar.

---

## Diretrizes de Design

- **Apple HIG** rigoroso: respeitar safe areas, hit targets mínimos de 48px, sem ruído visual
- Sombras sutis nos cards (iOS style)
- Inputs com estados claros: default, focused (border primary), error (border error + texto error abaixo)
- Pull-to-refresh em todas as listas
- Empty states amigáveis com CTA quando aplicável
- Cores do perfil usadas consistentemente (tab bar tint, avatares, acentos)
- Formulários longos com ScrollView e botão fixo inferior sobre border-top hairline
- Hierarquia visual clara: título 34px → seção uppercase 14px → conteúdo
- Transições suaves entre telas (push nativo)
- Modais para criação (CreatePatient, CreateNurse, LinkFamily)
