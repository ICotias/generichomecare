# HomeCare App — Mapa de Telas e Navegação

> Documento de referência para a arquitetura de informação (IA) do app.
> Atualizado em: 14/04/2026
> Status: Em validação (GEN-75)

---

## Princípios de Design

1. **Reduzir carga cognitiva** — enfermeiros trabalham sob pressão; cada tela tem 1 objetivo claro.
2. **Design para interrupção** — autosave em formulários, rascunhos persistidos, recovery path.
3. **Workflow real** — a navegação espelha o turno: chegou → viu paciente → registrou → passou plantão → saiu.
4. **Apple HIG** — large titles, bottom tabs (max 5), botões primários no rodapé, inline errors.
5. **3-5 tabs por perfil** — mantém a barra de navegação limpa e alcançável com o polegar.

---

## Visão Geral — Navegação por Perfil

```
RootNavigator (Stack)
├── LoginScreen
├── SetupEmpresaScreen          (admin sem empresaId)
├── NurseTabs (BottomTab)       (role = nurse)
├── FamilyTabs (BottomTab)      (role = family)
└── AdminTabs (BottomTab)       (role = admin)
```

O `SimulationBanner` fica acima do `NavigationContainer` (já implementado).

---

## 1. Enfermeiro (NurseTabs)

### Tabs (4)

| Tab        | Tela raiz       | Ícone sugerido | Descrição                        |
|------------|-----------------|----------------|----------------------------------|
| Início     | NurseHome       | house           | Resumo do dia + pacientes       |
| Registrar  | QuickRegister   | plus.circle     | Acesso rápido aos formulários   |
| Plantão    | ShiftCheckin    | clock           | Checkin/checkout + evolução     |
| Perfil     | NurseProfile    | person.circle   | Dados pessoais + config         |

### Fluxo de telas (Stacks dentro de cada Tab)

```
NurseTabs
├── Tab: Início
│   └── NurseHomeScreen (lista pacientes do dia + status plantão)
│       └── → PatientDetailScreen (push)
│           ├── Informações do paciente (ScrollView)
│           ├── Prescrições ativas
│           └── Últimos registros do paciente
│
├── Tab: Registrar
│   └── QuickRegisterScreen (grid de tipos de registro)
│       ├── → RegisterMedicationScreen (push)    ← GEN-47
│       ├── → RegisterVitalsScreen (push)        ← GEN-48
│       ├── → RegisterFeedingScreen (push)       ← GEN-49
│       ├── → RegisterActivityScreen (push)      ← GEN-52
│       ├── → RegisterIncidentScreen (push)      ← GEN-50
│       └── → RegisterPhotoScreen (push)         ← GEN-53
│
├── Tab: Plantão
│   └── ShiftCheckinScreen (já implementada)
│       └── → ShiftEvolutionScreen (push)        ← GEN-54
│           Formulário SBAR (Situação, Ocorrências, Pendências, Orientações)
│           Obrigatório antes do checkout
│
└── Tab: Perfil
    └── NurseProfileScreen
        ├── Dados pessoais (nome, email, telefone, COREN)
        ├── → NotificationSettingsScreen (push)
        └── Botão Sair
```

### Estados especiais

| Tela              | Estado vazio                                   | Estado de erro            |
|-------------------|------------------------------------------------|---------------------------|
| NurseHome         | "Nenhum paciente designado para hoje"          | "Erro ao carregar escala" |
| QuickRegister     | Desabilitado se não há plantão ativo           | —                         |
| PatientDetail     | —                                              | "Paciente não encontrado" |
| Registers (todos) | Form limpo, campos focáveis                    | Inline errors por campo   |
| ShiftCheckin      | "Nenhum plantão ativo" (já implementado)       | Alert com retry           |

---

## 2. Família (FamilyTabs)

### Tabs (4)

| Tab        | Tela raiz        | Ícone sugerido  | Descrição                              |
|------------|------------------|-----------------|----------------------------------------|
| Timeline   | FamilyTimeline   | list.bullet      | Registros do dia em tempo real         |
| Paciente   | PatientInfo      | heart.text       | Ficha completa (somente leitura)       |
| Histórico  | HistoryFilter    | calendar         | Navegar por datas + filtrar por tipo   |
| Perfil     | FamilyProfile    | person.circle    | Dados + config de notificações         |

### Fluxo de telas

```
FamilyTabs
├── Tab: Timeline
│   └── FamilyTimelineScreen (FlatList real-time via onSnapshot)  ← GEN-55
│       └── → RegisterDetailModal (modal)
│           Detalhes completos do registro (med., vitais, foto, etc.)
│
├── Tab: Paciente
│   └── PatientInfoScreen (ScrollView somente leitura)            ← GEN-57
│       ├── Dados pessoais, diagnósticos, alergias, medicamentos
│       └── → VitalsChartScreen (push)                            ← GEN-59
│           Gráfico de linha: PA, FC, Temp nos últimos 7 dias
│
├── Tab: Histórico
│   └── HistoryFilterScreen                                       ← GEN-58
│       ├── Calendário (seleção de data/período)
│       ├── Chips de filtro (medicamento, vitais, alimentação, etc.)
│       ├── FlatList de registros filtrados
│       ├── → RegisterDetailModal (modal) — mesmo componente
│       └── → ExportPDFModal (modal)                              ← GEN-60
│           Preview + botão compartilhar (react-native-share)
│
└── Tab: Perfil
    └── FamilyProfileScreen
        ├── Dados pessoais, parentesco
        ├── → NotificationSettingsScreen (push)                   ← GEN-56
        │   Toggles: intercorrência (sempre on), medicamento, refeição, checkin/checkout
        └── Botão Sair
```

### Estados especiais

| Tela             | Estado vazio                                      | Estado de erro              |
|------------------|---------------------------------------------------|-----------------------------|
| FamilyTimeline   | "Nenhum registro hoje. Seu enfermeiro atualizará." | "Erro de conexão" + retry  |
| PatientInfo      | —                                                 | "Paciente não encontrado"   |
| HistoryFilter    | "Nenhum registro no período selecionado"          | —                           |
| VitalsChart      | "Dados insuficientes para gerar gráfico"          | —                           |

---

## 3. Admin (AdminTabs)

### Tabs (4)

| Tab        | Tela raiz        | Ícone sugerido     | Descrição                            |
|------------|------------------|---------------------|--------------------------------------|
| Dashboard  | AdminDashboard   | chart.bar           | Visão operacional do dia             |
| Pacientes  | PatientList      | person.2            | CRUD de pacientes                    |
| Equipe     | TeamList         | person.3            | Profissionais + escalas              |
| Perfil     | AdminProfile     | gearshape           | Empresa, financeiro, config          |

### Fluxo de telas

```
AdminTabs
├── Tab: Dashboard
│   └── AdminDashboardScreen                                     ← GEN-65
│       ├── Cards: pacientes ativos, plantões do dia, alertas, profissionais
│       ├── → ShiftDetailScreen (push) — detalhes de um plantão
│       └── → AlertDetailScreen (push) — detalhes de um alerta
│
├── Tab: Pacientes
│   └── PatientListScreen (FlatList + busca)                     ← GEN-61
│       ├── → CreatePatientScreen (modal) — formulário completo
│       │   Dados pessoais, diagnósticos, alergias, medicamentos, prescrições
│       ├── → PatientDetailScreen (push) — view/edit
│       │   └── → LinkFamilyScreen (modal)                       ← GEN-63
│       │       Cadastro de familiar + convite por email
│       └── Swipe action: arquivar paciente
│
├── Tab: Equipe
│   └── TeamListScreen (FlatList profissionais)                  ← GEN-62
│       ├── → CreateNurseScreen (modal) — já implementada
│       ├── → NurseDetailScreen (push) — perfil completo + status
│       └── → ScheduleScreen (push)                              ← GEN-64
│           ├── Grade semanal (dias × pacientes)
│           ├── Selecionar profissional por slot
│           ├── Detecção de conflito (visual: vermelho)
│           └── → CreateScheduleModal (modal) — criar slot
│
└── Tab: Perfil
    └── AdminProfileScreen
        ├── Dados da empresa (nome, CNPJ, cidade)
        ├── Simulador de roles (já implementado, move para cá)
        ├── → FinancialScreen (push)                             ← GEN-66
        │   ├── Resumo mensal (receitas, despesas, resultado)
        │   └── → ExportFinancialModal (modal)                   ← GEN-67
        │       CSV/PDF + compartilhar
        ├── → NotificationSettingsScreen (push)
        └── Botão Sair
```

### Estados especiais

| Tela              | Estado vazio                                | Estado de erro            |
|-------------------|---------------------------------------------|---------------------------|
| AdminDashboard    | "Configure sua primeira escala para começar" | "Erro ao carregar dados" |
| PatientList       | "Nenhum paciente cadastrado ainda" + CTA    | —                         |
| TeamList          | "Cadastre seu primeiro enfermeiro" + CTA     | —                         |
| ScheduleScreen    | "Monte a escala da semana" + CTA             | Conflito highlight        |
| FinancialScreen   | "Sem dados financeiros este mês"             | —                         |

---

## Componentes Compartilhados (shared)

| Componente               | Usado por          | Descrição                                    |
|--------------------------|---------------------|----------------------------------------------|
| SimulationBanner         | Todos               | Banner laranja quando admin simula role       |
| PasswordInput            | Login, CreateNurse  | Input de senha com toggle mostrar/ocultar     |
| EmptyState               | Todos               | Ilustração + título + subtítulo + CTA         |
| LoadingScreen            | Todos               | Spinner centralizado                          |
| ErrorBanner              | Todos               | Banner inline de erro com retry               |
| RegisterDetailModal      | Família, Enfermeiro | Detalhes de um registro (medicamento, etc.)   |
| NotificationSettings     | Todos               | Toggles de preferência de push                |
| PatientDetailScreen      | Enfermeiro, Admin   | Ficha do paciente (shared, permissões variam) |

---

## Resumo de Telas por Perfil

| Perfil     | Telas total | Tabs | Stacks (push) | Modais |
|------------|-------------|------|----------------|--------|
| Enfermeiro | 13          | 4    | 7              | 0      |
| Família    | 8           | 4    | 2              | 2      |
| Admin      | 14          | 4    | 6              | 4      |
| Shared     | 6           | —    | —              | —      |
| **Total**  | **~35**     |      |                |        |

---

## Cruzamento com Issues

| Tela skeleton (Fase 1)       | Issue feature (Fase 2-4)     |
|------------------------------|------------------------------|
| T1-01 NurseHome              | GEN-46                       |
| T1-02 RegisterMedication     | GEN-47                       |
| T1-03 RegisterVitals         | GEN-48                       |
| T1-04 RegisterFeeding        | GEN-49                       |
| T1-05 RegisterIncident       | GEN-50                       |
| T1-06 RegisterActivity       | GEN-52                       |
| T1-07 RegisterPhoto          | GEN-53                       |
| T1-08 ShiftEvolution         | GEN-54                       |
| T1-09 FamilyTimeline         | GEN-55                       |
| T1-10 PatientInfo            | GEN-57                       |
| T1-11 HistoryFilter          | GEN-58                       |
| T1-12 VitalsChart            | GEN-59                       |
| T1-13 CreatePatient          | GEN-61                       |
| T1-14 CreateNurse (completo) | GEN-62                       |
| T1-15 LinkFamily             | GEN-63                       |
| T1-16 Schedule               | GEN-64                       |
| T1-17 AdminDashboard         | GEN-65                       |
| T1-18 Financial              | GEN-66                       |
| T1-19 ExportFinancial        | GEN-67                       |
| T1-20 Stacks/Tabs completos  | —                            |
