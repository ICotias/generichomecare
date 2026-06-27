import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useState } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuthStore } from '../hooks/useAuth';
import { colors } from '../theme/theme';
import { SimulationBanner } from '../../shared/components/SimulationBanner';
import { LgpdConsentScreen } from '../../shared/screens/LgpdConsentScreen';

// ── Auth ──
import { LoginScreen } from '../../features/nurse/screens/LoginScreen';
import { SetupEmpresaScreen } from '../../features/admin/screens/SetupEmpresaScreen';

// ── Nurse screens ──
import { NurseHomeScreen } from '../../features/nurse/screens/NurseHomeScreen';
import { ShiftCheckinScreen } from '../../features/nurse/screens/ShiftCheckinScreen';
import { QuickRegisterScreen } from '../../features/nurse/screens/QuickRegisterScreen';
import { NurseProfileScreen } from '../../features/nurse/screens/NurseProfileScreen';
import { PatientDetailScreen } from '../../features/nurse/screens/PatientDetailScreen';
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

// ── Admin screens ──
import { AdminDashboardScreen } from '../../features/admin/screens/AdminDashboardScreen';
import { PatientListScreen } from '../../features/admin/screens/PatientListScreen';
import { CreatePatientScreen } from '../../features/admin/screens/CreatePatientScreen';
import { AdminPatientDetailScreen } from '../../features/admin/screens/AdminPatientDetailScreen';
import { LinkFamilyScreen } from '../../features/admin/screens/LinkFamilyScreen';
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
  AdminTabs: undefined;
};

// ── Nurse ──
export type NurseTabParamList = {
  NurseHomeStack: undefined;
  RegisterStack: undefined;
  ShiftStack: undefined;
  NurseProfileStack: undefined;
};

export type NurseProfileStackParamList = {
  NurseProfile: undefined;
  EditProfile: undefined;
  Help: undefined;
  ShiftHistory: undefined;
};

export type NurseHomeStackParamList = {
  NurseHome: undefined;
  PatientDetail: { patientId?: string };
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
  ExportReport: { patientId?: string };
};

export type PatientMgmtStackParamList = {
  PatientList: undefined;
  CreatePatient: undefined;
  AdminPatientDetail: { patientId?: string };
  LinkFamily: { patientId?: string };
  ExportReport: { patientId?: string };
};

export type TeamStackParamList = {
  TeamList: undefined;
  CreateNurse: undefined;
  NurseDetail: { nurseId?: string };
  Schedule: undefined;
};

export type AdminProfileStackParamList = {
  AdminProfile: undefined;
  Financial: undefined;
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
  </NurseHomeStackNav.Navigator>
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
    <NurseProfileStackNav.Screen name="EditProfile" component={EditProfileScreen} />
    <NurseProfileStackNav.Screen name="Help" component={HelpScreen} />
    <NurseProfileStackNav.Screen name="ShiftHistory" component={ShiftHistoryScreen} />
  </NurseProfileStackNav.Navigator>
);

const NurseTab = createBottomTabNavigator<NurseTabParamList>();
const NurseTabNavigator = () => (
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
    <NurseTab.Screen name="RegisterStack" component={RegisterStack} options={{ tabBarLabel: 'Registrar', tabBarIcon: ({ color, size }) => <Ionicons name="add-circle-outline" size={size} color={color} /> }} />
    <NurseTab.Screen name="ShiftStack" component={ShiftStack} options={{ tabBarLabel: 'Plantão', tabBarIcon: ({ color, size }) => <Ionicons name="time-outline" size={size} color={color} /> }} />
    <NurseTab.Screen name="NurseProfileStack" component={NurseProfileStack} options={{ tabBarLabel: 'Perfil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
  </NurseTab.Navigator>
);

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
    <DashboardStackNav.Screen name="ExportReport" component={ExportReportScreen} />
  </DashboardStackNav.Navigator>
);

const PatientMgmtStackNav = createNativeStackNavigator<PatientMgmtStackParamList>();
const PatientMgmtStack = () => (
  <PatientMgmtStackNav.Navigator screenOptions={{ headerShown: false }}>
    <PatientMgmtStackNav.Screen name="PatientList" component={PatientListScreen} />
    <PatientMgmtStackNav.Screen name="CreatePatient" component={CreatePatientScreen} options={{ presentation: 'modal' }} />
    <PatientMgmtStackNav.Screen name="AdminPatientDetail" component={AdminPatientDetailScreen} />
    <PatientMgmtStackNav.Screen name="LinkFamily" component={LinkFamilyScreen} options={{ presentation: 'modal' }} />
    <PatientMgmtStackNav.Screen name="ExportReport" component={ExportReportScreen} />
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
    <AdminProfileStackNav.Screen name="Financial" component={FinancialScreen} />
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
  const { isLoading, isAuthenticated, role, user, originalRole } = useAuthStore();
  const needsEmpresaSetup = originalRole === 'admin' && !user?.empresaId;

  // LGPD consent check — user must accept before using app
  const typedUser = user as typeof user & { lgpdConsentAt?: unknown };
  const needsLgpd = isAuthenticated && !needsEmpresaSetup && !typedUser?.lgpdConsentAt;
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const showLgpd = needsLgpd && !lgpdAccepted;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (showLgpd) {
    return <LgpdConsentScreen onAccepted={() => setLgpdAccepted(true)} />;
  }

  return (
    <View style={styles.root}>
      <SimulationBanner />
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <RootStack.Screen name="Login" component={LoginScreen} />
          ) : needsEmpresaSetup ? (
            <RootStack.Screen name="SetupEmpresa" component={SetupEmpresaScreen} />
          ) : (
            <>
              {role === 'nurse' && (
                <RootStack.Screen name="NurseTabs" component={NurseTabNavigator} />
              )}
              {role === 'family' && (
                <RootStack.Screen name="FamilyTabs" component={FamilyTabNavigator} />
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
