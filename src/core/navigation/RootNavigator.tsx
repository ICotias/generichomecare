import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useState, useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../hooks/useAuth';
import { useIsTenantOwner } from '../hooks/useIsTenantOwner';
import * as shiftService from '../services/shiftService';
import { colors } from '../theme/theme';
import { SimulationBanner } from '../../shared/components/SimulationBanner';
import { LgpdConsentScreen } from '../../shared/screens/LgpdConsentScreen';

// ── Auth ──
import { LoginScreen } from '../../features/nurse/screens/LoginScreen';
import { SignUpScreen } from '../../shared/screens/SignUpScreen';
import { SetupEmpresaScreen } from '../../features/admin/screens/SetupEmpresaScreen';
import { ChangePasswordScreen } from '../../shared/screens/ChangePasswordScreen';
import { FamilyOnboardingScreen } from '../../features/family/screens/FamilyOnboardingScreen';
import { FamilyWaitingScreen } from '../../features/family/screens/FamilyWaitingScreen';

// ── Nurse screens ──
import { NurseHomeScreen } from '../../features/nurse/screens/NurseHomeScreen';
import { ShiftCheckinScreen } from '../../features/nurse/screens/ShiftCheckinScreen';
import { QuickRegisterScreen } from '../../features/nurse/screens/QuickRegisterScreen';
import { NurseProfileScreen } from '../../features/nurse/screens/NurseProfileScreen';
import { PatientDetailScreen } from '../../features/nurse/screens/PatientDetailScreen';
import { SoloPatientListScreen } from '../../features/nurse/screens/SoloPatientListScreen';
import { SoloCreatePatientScreen } from '../../features/nurse/screens/SoloCreatePatientScreen';
import { RegisterMedicationScreen } from '../../features/nurse/screens/RegisterMedicationScreen';
import { RegisterVitalsScreen } from '../../features/nurse/screens/RegisterVitalsScreen';
import { RegisterFeedingScreen } from '../../features/nurse/screens/RegisterFeedingScreen';
import { RegisterActivityScreen } from '../../features/nurse/screens/RegisterActivityScreen';
import { RegisterIncidentScreen } from '../../features/nurse/screens/RegisterIncidentScreen';
import { RegisterPhotoScreen } from '../../features/nurse/screens/RegisterPhotoScreen';
import { ShiftEvolutionScreen } from '../../features/nurse/screens/ShiftEvolutionScreen';
import { ExportReportScreen } from '../../features/nurse/screens/ExportReportScreen';

// ── Family screens ──
import { FamilyTimelineScreen } from '../../features/family/screens/FamilyTimelineScreen';
import { PatientInfoScreen } from '../../features/family/screens/PatientInfoScreen';
import { VitalsChartScreen } from '../../features/family/screens/VitalsChartScreen';
import { HistoryFilterScreen } from '../../features/family/screens/HistoryFilterScreen';
import { FamilyProfileScreen } from '../../features/family/screens/FamilyProfileScreen';
import { FamilyNurseScreen } from '../../features/family/screens/FamilyNurseScreen';
import { FamilyRelativesScreen } from '../../features/family/screens/FamilyRelativesScreen';

// ── Admin screens ──
import { AdminDashboardScreen } from '../../features/admin/screens/AdminDashboardScreen';
import { PatientListScreen } from '../../features/admin/screens/PatientListScreen';
import { CreatePatientScreen } from '../../features/admin/screens/CreatePatientScreen';
import { AdminPatientDetailScreen } from '../../features/admin/screens/AdminPatientDetailScreen';
import { LinkFamilyScreen } from '../../features/admin/screens/LinkFamilyScreen';
import { InviteFamilyScreen } from '../../features/admin/screens/InviteFamilyScreen';
import { TeamListScreen } from '../../features/admin/screens/TeamListScreen';
import { CreateNurseScreen } from '../../features/admin/screens/CreateNurseScreen';
import { NurseDetailScreen } from '../../features/admin/screens/NurseDetailScreen';
import { ScheduleScreen } from '../../features/admin/screens/ScheduleScreen';
import { AdminProfileScreen } from '../../features/admin/screens/AdminProfileScreen';
import { EditEmpresaScreen } from '../../features/admin/screens/EditEmpresaScreen';
import { FinancialScreen } from '../../features/admin/screens/FinancialScreen';

// ── Family extra screens ──
import { LinkedPatientScreen } from '../../features/family/screens/LinkedPatientScreen';

// ── Shared screens ──
import { EditProfileScreen } from '../../shared/screens/EditProfileScreen';
import { HelpScreen } from '../../shared/screens/HelpScreen';
import { ShiftHistoryScreen } from '../../features/nurse/screens/ShiftHistoryScreen';

// ════════════════════════════════════════════
// Param Lists
// ════════════════════════════════════════════

export type RootStackParamList = {
  Login: undefined;
  SetupEmpresa: undefined;
  NurseTabs: undefined;
  FamilyTabs: undefined;
  FamilyWaiting: undefined;
  CompletePatient: { patientId: string };
  AdminTabs: undefined;
};

// ── Nurse ──
export type NurseTabParamList = {
  NurseHomeStack: undefined;
  /** Só existe para o cuidador autônomo, dono do próprio tenant */
  SoloStack: undefined;
  RegisterStack: undefined;
  ShiftStack: undefined;
  NurseProfileStack: undefined;
};

export type NurseProfileStackParamList = {
  NurseProfile: undefined;
  EditProfile: undefined;
  Help: undefined;
  ShiftHistory: undefined;
  /** Cuidador autônomo: o financeiro do tenant é dele */
  Financial: undefined;
};

export type NurseHomeStackParamList = {
  NurseHome: undefined;
  PatientDetail: { patientId?: string };
  ExportReport: { patientId?: string };
  /**
   * As duas rotas abaixo só são alcançáveis pelo cuidador dono do tenant, mas
   * ficam registradas aqui também porque ele chega ao detalhe do paciente pelas
   * duas pilhas. Sem isso, a ação de dono quebraria vinda do Início.
   */
  CompletePatient: { patientId: string };
  InviteFamily: { patientId?: string } | undefined;
};

/**
 * Pilha do CUIDADOR AUTÔNOMO. Só existe para quem é dono do próprio tenant.
 * Sem equipe e sem escala: aqui ele administra apenas os pacientes dele.
 */
export type SoloStackParamList = {
  SoloPatientList: undefined;
  SoloCreatePatient: undefined;
  PatientDetail: { patientId?: string };
  CompletePatient: { patientId: string };
  InviteFamily: { patientId?: string } | undefined;
  ExportReport: { patientId?: string };
};

export type RegisterStackParamList = {
  QuickRegister: undefined;
  RegisterMedication: undefined;
  RegisterVitals: undefined;
  RegisterFeeding: undefined;
  RegisterActivity: undefined;
  RegisterIncident: undefined;
  RegisterPhoto: undefined;
};

export type ShiftStackParamList = {
  ShiftCheckin: undefined;
  ShiftEvolution: undefined;
};

// ── Family ──
export type FamilyTabParamList = {
  FamilyTimeline: undefined;
  PatientInfoStack: undefined;
  HistoryStack: undefined;
  FamilyProfileStack: undefined;
};

export type FamilyProfileStackParamList = {
  FamilyProfile: undefined;
  EditProfile: undefined;
  Help: undefined;
  LinkedPatient: undefined;
  FamilyNurse: undefined;
  FamilyRelatives: undefined;
};

export type PatientInfoStackParamList = {
  PatientInfo: undefined;
  VitalsChart: undefined;
};

export type HistoryStackParamList = {
  HistoryFilter: undefined;
};

// ── Admin ──
export type AdminTabParamList = {
  DashboardStack: undefined;
  PatientMgmtStack: undefined;
  TeamStack: undefined;
  AdminProfileStack: undefined;
};

export type DashboardStackParamList = {
  AdminDashboard: undefined;
  Financial: undefined;
};

export type PatientMgmtStackParamList = {
  PatientList: undefined;
  CreatePatient: undefined;
  AdminPatientDetail: { patientId?: string };
  LinkFamily: { patientId?: string };
  InviteFamily: { patientId?: string } | undefined;
  ExportReport: { patientId?: string };
  /** Assistente de cadastro clínico, o mesmo usado no modo familiar */
  CompletePatient: { patientId: string };
};

export type TeamStackParamList = {
  TeamList: undefined;
  CreateNurse: undefined;
  NurseDetail: { nurseId?: string };
  Schedule: undefined;
};

export type AdminProfileStackParamList = {
  AdminProfile: undefined;
  EditProfile: undefined;
  EditEmpresa: undefined;
  Help: undefined;
};

// ════════════════════════════════════════════
// Shared tab bar config
// ════════════════════════════════════════════

const tabBarStyle = {
  backgroundColor: colors.surface,
  borderTopColor: colors.border,
};

const tabBarLabelStyle = {
  fontSize: 11,
  fontWeight: '500' as const,
};

// ════════════════════════════════════════════
// Nurse Navigation
// ════════════════════════════════════════════

const NurseHomeStackNav = createNativeStackNavigator<NurseHomeStackParamList>();
const NurseHomeStack = () => (
  <NurseHomeStackNav.Navigator screenOptions={{ headerShown: false }}>
    <NurseHomeStackNav.Screen name="NurseHome" component={NurseHomeScreen} />
    <NurseHomeStackNav.Screen name="PatientDetail" component={PatientDetailScreen} />
    <NurseHomeStackNav.Screen name="ExportReport" component={ExportReportScreen} />
    {/* Só o cuidador dono do tenant alcança estas duas, mas ele chega ao
        detalhe do paciente também por aqui, então precisam existir nas duas
        pilhas. */}
    <NurseHomeStackNav.Screen name="CompletePatient" component={FamilyOnboardingScreen} options={{ presentation: 'modal' }} />
    <NurseHomeStackNav.Screen name="InviteFamily" component={InviteFamilyScreen} options={{ presentation: 'modal' }} />
  </NurseHomeStackNav.Navigator>
);

/**
 * Pilha do cuidador autônomo: os pacientes dele, do cadastro ao convite da
 * família. Reaproveita o detalhe do paciente e o assistente clínico, que já
 * servem os outros modos.
 */
const SoloStackNav = createNativeStackNavigator<SoloStackParamList>();
const SoloStack = () => (
  <SoloStackNav.Navigator screenOptions={{ headerShown: false }}>
    <SoloStackNav.Screen name="SoloPatientList" component={SoloPatientListScreen} />
    <SoloStackNav.Screen name="SoloCreatePatient" component={SoloCreatePatientScreen} options={{ presentation: 'modal' }} />
    <SoloStackNav.Screen name="PatientDetail" component={PatientDetailScreen} />
    <SoloStackNav.Screen name="CompletePatient" component={FamilyOnboardingScreen} options={{ presentation: 'modal' }} />
    <SoloStackNav.Screen name="InviteFamily" component={InviteFamilyScreen} options={{ presentation: 'modal' }} />
    <SoloStackNav.Screen name="ExportReport" component={ExportReportScreen} />
  </SoloStackNav.Navigator>
);

const RegisterStackNav = createNativeStackNavigator<RegisterStackParamList>();
const RegisterStack = () => (
  <RegisterStackNav.Navigator screenOptions={{ headerShown: false }}>
    <RegisterStackNav.Screen name="QuickRegister" component={QuickRegisterScreen} />
    <RegisterStackNav.Screen name="RegisterMedication" component={RegisterMedicationScreen} />
    <RegisterStackNav.Screen name="RegisterVitals" component={RegisterVitalsScreen} />
    <RegisterStackNav.Screen name="RegisterFeeding" component={RegisterFeedingScreen} />
    <RegisterStackNav.Screen name="RegisterActivity" component={RegisterActivityScreen} />
    <RegisterStackNav.Screen name="RegisterIncident" component={RegisterIncidentScreen} />
    <RegisterStackNav.Screen name="RegisterPhoto" component={RegisterPhotoScreen} />
  </RegisterStackNav.Navigator>
);

const ShiftStackNav = createNativeStackNavigator<ShiftStackParamList>();
const ShiftStack = () => (
  <ShiftStackNav.Navigator screenOptions={{ headerShown: false }}>
    <ShiftStackNav.Screen name="ShiftCheckin" component={ShiftCheckinScreen} />
    <ShiftStackNav.Screen name="ShiftEvolution" component={ShiftEvolutionScreen} />
  </ShiftStackNav.Navigator>
);

const NurseProfileStackNav = createNativeStackNavigator<NurseProfileStackParamList>();
const NurseProfileStack = () => (
  <NurseProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
    <NurseProfileStackNav.Screen name="NurseProfile" component={NurseProfileScreen} />
    <NurseProfileStackNav.Screen name="Financial" component={FinancialScreen} />
    <NurseProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <NurseProfileStackNav.Screen name="Help" component={HelpScreen} />
    <NurseProfileStackNav.Screen name="ShiftHistory" component={ShiftHistoryScreen} />
  </NurseProfileStackNav.Navigator>
);

const NurseTab = createBottomTabNavigator<NurseTabParamList>();
const NurseTabNavigator = () => {
  const { user, originalRole } = useAuthStore();
  const [hasActiveShift, setHasActiveShift] = useState(false);
  const { isOwner } = useIsTenantOwner();
  // Dono do próprio tenant e profissional de verdade. O originalRole evita que
  // a simulação do admin (que é dono da empresa) abra a aba do autônomo.
  const isSoloOwner = isOwner && originalRole === 'nurse';

  useEffect(() => {
    if (!user?.empresaId || !user?.uid) return;
    const check = () => {
      shiftService.getActiveShift(user.empresaId, user.uid)
        .then((shift) => setHasActiveShift(!!shift))
        .catch(() => setHasActiveShift(false));
    };
    check();
    // ponytail: polling simples a cada 30s só para alternar a aba "Registrar".
    // Teto: gera leituras ociosas no Firestore. Evolução: trocar por onSnapshot
    // do plantão ativo, ou revalidar via evento de checkin/checkout.
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [user?.empresaId, user?.uid]);

  return (
    <NurseTab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle,
        tabBarLabelStyle,
      }}
    >
      <NurseTab.Screen name="NurseHomeStack" component={NurseHomeStack} options={{ tabBarLabel: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} /> }} />
      {/* Só o cuidador autônomo administra pacientes. Quem foi contratado por
          empresa ou convidado por família não é dono do tenant e não vê a aba. */}
      {isSoloOwner && (
        <NurseTab.Screen name="SoloStack" component={SoloStack} options={{ tabBarLabel: 'Pacientes', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
      )}
      {hasActiveShift && (
        <NurseTab.Screen name="RegisterStack" component={RegisterStack} options={{ tabBarLabel: 'Registrar', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} /> }} />
      )}
      <NurseTab.Screen name="ShiftStack" component={ShiftStack} options={{ tabBarLabel: 'Plantão', tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }} />
      <NurseTab.Screen name="NurseProfileStack" component={NurseProfileStack} options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
    </NurseTab.Navigator>
  );
};

// ════════════════════════════════════════════
// Family Navigation
// ════════════════════════════════════════════

const PatientInfoStackNav = createNativeStackNavigator<PatientInfoStackParamList>();
const PatientInfoStack = () => (
  <PatientInfoStackNav.Navigator screenOptions={{ headerShown: false }}>
    <PatientInfoStackNav.Screen name="PatientInfo" component={PatientInfoScreen} />
    <PatientInfoStackNav.Screen name="VitalsChart" component={VitalsChartScreen} />
  </PatientInfoStackNav.Navigator>
);

const HistoryStackNav = createNativeStackNavigator<HistoryStackParamList>();
const HistoryStack = () => (
  <HistoryStackNav.Navigator screenOptions={{ headerShown: false }}>
    <HistoryStackNav.Screen name="HistoryFilter" component={HistoryFilterScreen} />
  </HistoryStackNav.Navigator>
);

const FamilyProfileStackNav = createNativeStackNavigator<FamilyProfileStackParamList>();
const FamilyProfileStack = () => (
  <FamilyProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
    <FamilyProfileStackNav.Screen name="FamilyProfile" component={FamilyProfileScreen} />
    <FamilyProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <FamilyProfileStackNav.Screen name="Help" component={HelpScreen} />
    <FamilyProfileStackNav.Screen name="LinkedPatient" component={LinkedPatientScreen} />
    <FamilyProfileStackNav.Screen name="FamilyNurse" component={FamilyNurseScreen} />
    <FamilyProfileStackNav.Screen name="FamilyRelatives" component={FamilyRelativesScreen} />
  </FamilyProfileStackNav.Navigator>
);

const FamilyTab = createBottomTabNavigator<FamilyTabParamList>();
const FamilyTabNavigator = () => (
  <FamilyTab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.family,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle,
      tabBarLabelStyle,
    }}
  >
    <FamilyTab.Screen name="FamilyTimeline" component={FamilyTimelineScreen} options={{ tabBarLabel: 'Timeline', tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} /> }} />
    <FamilyTab.Screen name="PatientInfoStack" component={PatientInfoStack} options={{ tabBarLabel: 'Paciente', tabBarIcon: ({ color, size }) => <Ionicons name="heart-outline" size={size} color={color} /> }} />
    <FamilyTab.Screen name="HistoryStack" component={HistoryStack} options={{ tabBarLabel: 'Histórico', tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} /> }} />
    <FamilyTab.Screen name="FamilyProfileStack" component={FamilyProfileStack} options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
  </FamilyTab.Navigator>
);

// ════════════════════════════════════════════
// Admin Navigation
// ════════════════════════════════════════════

const DashboardStackNav = createNativeStackNavigator<DashboardStackParamList>();
const DashboardStack = () => (
  <DashboardStackNav.Navigator screenOptions={{ headerShown: false }}>
    <DashboardStackNav.Screen name="AdminDashboard" component={AdminDashboardScreen} />
    <DashboardStackNav.Screen name="Financial" component={FinancialScreen} />
  </DashboardStackNav.Navigator>
);

const PatientMgmtStackNav = createNativeStackNavigator<PatientMgmtStackParamList>();
const PatientMgmtStack = () => (
  <PatientMgmtStackNav.Navigator screenOptions={{ headerShown: false }}>
    <PatientMgmtStackNav.Screen name="PatientList" component={PatientListScreen} />
    <PatientMgmtStackNav.Screen name="CreatePatient" component={CreatePatientScreen} options={{ presentation: 'modal' }} />
    <PatientMgmtStackNav.Screen name="AdminPatientDetail" component={AdminPatientDetailScreen} />
    <PatientMgmtStackNav.Screen name="LinkFamily" component={LinkFamilyScreen} options={{ presentation: 'modal' }} />
    <PatientMgmtStackNav.Screen name="InviteFamily" component={InviteFamilyScreen} options={{ presentation: 'modal' }} />
    <PatientMgmtStackNav.Screen name="ExportReport" component={ExportReportScreen} />
    {/* Mesmo assistente do modo familiar. Quem cadastra os dados clínicos no
        modo empresa é o admin, então ele precisa da tela aqui também. */}
    <PatientMgmtStackNav.Screen
      name="CompletePatient"
      component={FamilyOnboardingScreen}
      options={{ presentation: 'modal' }}
    />
  </PatientMgmtStackNav.Navigator>
);

const TeamStackNav = createNativeStackNavigator<TeamStackParamList>();
const TeamStack = () => (
  <TeamStackNav.Navigator screenOptions={{ headerShown: false }}>
    <TeamStackNav.Screen name="TeamList" component={TeamListScreen} />
    <TeamStackNav.Screen name="CreateNurse" component={CreateNurseScreen} options={{ presentation: 'modal' }} />
    <TeamStackNav.Screen name="NurseDetail" component={NurseDetailScreen} />
    <TeamStackNav.Screen name="Schedule" component={ScheduleScreen} />
  </TeamStackNav.Navigator>
);

const AdminProfileStackNav = createNativeStackNavigator<AdminProfileStackParamList>();
const AdminProfileStack = () => (
  <AdminProfileStackNav.Navigator screenOptions={{ headerShown: false }}>
    <AdminProfileStackNav.Screen name="AdminProfile" component={AdminProfileScreen} />
    <AdminProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <AdminProfileStackNav.Screen name="EditEmpresa" component={EditEmpresaScreen} />
    <AdminProfileStackNav.Screen name="Help" component={HelpScreen} />
  </AdminProfileStackNav.Navigator>
);

const AdminTab = createBottomTabNavigator<AdminTabParamList>();
const AdminTabNavigator = () => (
  <AdminTab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.admin,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle,
      tabBarLabelStyle,
    }}
  >
    <AdminTab.Screen name="DashboardStack" component={DashboardStack} options={{ tabBarLabel: 'Dashboard', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" size={size} color={color} /> }} />
    <AdminTab.Screen name="PatientMgmtStack" component={PatientMgmtStack} options={{ tabBarLabel: 'Pacientes', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" size={size} color={color} /> }} />
    <AdminTab.Screen name="TeamStack" component={TeamStack} options={{ tabBarLabel: 'Equipe', tabBarIcon: ({ color, size }) => <Ionicons name="medkit-outline" size={size} color={color} /> }} />
    <AdminTab.Screen name="AdminProfileStack" component={AdminProfileStack} options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} /> }} />
  </AdminTab.Navigator>
);

// ════════════════════════════════════════════
// Root
// ════════════════════════════════════════════

const RootStack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator = () => {
  const { isLoading, isAuthenticated, role, user, originalRole, isSimulating } = useAuthStore();
  const [showSignUp, setShowSignUp] = useState(false);

  // Conta sem tenant → Setup. O cuidador convidado tem empresaId, então não
  // cai aqui. A exclusão antiga (`originalRole !== 'nurse'`) prendia numa tela
  // vazia a conta-fantasma que o inferRoleFromEmail cria como 'nurse' sem
  // empresa: sem tenant, ela precisa passar pelo Setup como qualquer outra.
  const needsEmpresaSetup = isAuthenticated && !user?.empresaId;

  // Troca de senha obrigatória (conta criada pelo admin com senha temporária)
  const needsPasswordChange =
    isAuthenticated && !needsEmpresaSetup && !isSimulating && user?.mustChangePassword === true;

  // Família sem paciente vinculado. O destino depende de quem é o dono do
  // tenant, e são dois mundos diferentes:
  //
  //   modo empresa  → a família ESPERA: o admin cria e vincula o paciente.
  //   modo familiar → a família CADASTRA: ela é a dona, não há admin nenhum
  //                   para esperar, e mandá-la para a tela de espera seria
  //                   prendê-la para sempre aguardando uma clínica que não existe.
  const { isOwner, isLoading: isLoadingOwner } = useIsTenantOwner();

  const familyWithoutPatient =
    isAuthenticated &&
    !needsEmpresaSetup &&
    !isSimulating &&
    !needsPasswordChange &&
    originalRole === 'family' &&
    !user?.pacienteId;

  const familyWaitingForPatient = familyWithoutPatient && !isOwner;
  const familyNeedsToRegisterPatient = familyWithoutPatient && isOwner;

  // LGPD consent check — user must accept before using app
  const needsLgpd = isAuthenticated && !needsEmpresaSetup && !user?.lgpdConsentAt;
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const showLgpd = needsLgpd && !lgpdAccepted;

  // Reset lgpdAccepted quando trocar de conta
  useEffect(() => {
    setLgpdAccepted(false);
  }, [user?.uid]);

  // Não decidir o destino da família enquanto não se sabe quem é o dono do
  // tenant: adivinhar aqui faz a tela de espera piscar antes do cadastro.
  if (isLoading || (familyWithoutPatient && isLoadingOwner)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showLgpd) {
    return <LgpdConsentScreen onAccepted={() => setLgpdAccepted(true)} />;
  }

  if (needsPasswordChange) {
    return <ChangePasswordScreen />;
  }

  return (
    <View style={styles.root}>
      <SimulationBanner />
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <RootStack.Screen name="Login">
              {() =>
                showSignUp ? (
                  <SignUpScreen onBack={() => setShowSignUp(false)} />
                ) : (
                  <LoginScreen onSignUp={() => setShowSignUp(true)} />
                )
              }
            </RootStack.Screen>
          ) : needsEmpresaSetup ? (
            <RootStack.Screen name="SetupEmpresa" component={SetupEmpresaScreen} />
          ) : familyWaitingForPatient ? (
            <RootStack.Screen name="FamilyWaiting" component={FamilyWaitingScreen} />
          ) : familyNeedsToRegisterPatient ? (
            // Modo familiar: ela é a dona do tenant, então cadastra o paciente
            // agora. Sem params, o wizard cria do zero (createPatientByFamily).
            <RootStack.Screen name="CompletePatient" component={FamilyOnboardingScreen} />
          ) : (
            <>
              {role === 'nurse' && (
                <RootStack.Screen name="NurseTabs" component={NurseTabNavigator} />
              )}
              {role === 'family' && (
                <>
                  <RootStack.Screen name="FamilyTabs" component={FamilyTabNavigator} />
                  <RootStack.Screen
                    name="CompletePatient"
                    component={FamilyOnboardingScreen}
                    options={{ presentation: 'modal' }}
                  />
                </>
              )}
              {role === 'admin' && (
                <RootStack.Screen name="AdminTabs" component={AdminTabNavigator} />
              )}
            </>
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
