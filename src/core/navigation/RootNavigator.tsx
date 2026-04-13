import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ActivityIndicator, View, StyleSheet } from 'react-native';

import { useAuthStore } from '../hooks/useAuth';
import { colors } from '../theme/theme';
import { SimulationBanner } from '../../shared/components/SimulationBanner';

import { LoginScreen } from '../../features/nurse/screens/LoginScreen';
import { NurseHomeScreen } from '../../features/nurse/screens/NurseHomeScreen';
import { ShiftCheckinScreen } from '../../features/nurse/screens/ShiftCheckinScreen';
import { FamilyHomeScreen } from '../../features/family/screens/FamilyHomeScreen';
import { AdminHomeScreen } from '../../features/admin/screens/AdminHomeScreen';
import { CreateNurseScreen } from '../../features/admin/screens/CreateNurseScreen';
import { SetupEmpresaScreen } from '../../features/admin/screens/SetupEmpresaScreen';

export type RootStackParamList = {
  Login: undefined;
  NurseTabs: undefined;
  FamilyHome: undefined;
  AdminHome: undefined;
  CreateNurse: undefined;
  SetupEmpresa: undefined;
};

export type NurseTabParamList = {
  NurseHome: undefined;
  ShiftCheckin: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const NurseTab = createBottomTabNavigator<NurseTabParamList>();

const NurseTabNavigator = () => (
  <NurseTab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.nurse,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
      },
      tabBarLabelStyle: {
        fontSize: 11,
        fontWeight: '500',
      },
    }}
  >
    <NurseTab.Screen
      name="NurseHome"
      component={NurseHomeScreen}
      options={{ tabBarLabel: 'Início' }}
    />
    <NurseTab.Screen
      name="ShiftCheckin"
      component={ShiftCheckinScreen}
      options={{ tabBarLabel: 'Plantão' }}
    />
  </NurseTab.Navigator>
);

export const RootNavigator = () => {
  const { isLoading, isAuthenticated, role, user, originalRole } = useAuthStore();
  // Admin precisa ter empresaId configurado. Se não tiver (primeiro login),
  // mostramos o fluxo de setup. Checamos pelo originalRole para que admins
  // simulando outros perfis ainda caiam neste fluxo quando necessário.
  const needsEmpresaSetup = originalRole === 'admin' && !user?.empresaId;

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <SimulationBanner />
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            <Stack.Screen name="Login" component={LoginScreen} />
          ) : needsEmpresaSetup ? (
            <Stack.Screen name="SetupEmpresa" component={SetupEmpresaScreen} />
          ) : (
            <>
              {role === 'nurse' && (
                <Stack.Screen name="NurseTabs" component={NurseTabNavigator} />
              )}
              {role === 'family' && (
                <Stack.Screen name="FamilyHome" component={FamilyHomeScreen} />
              )}
              {role === 'admin' && (
                <>
                  <Stack.Screen name="AdminHome" component={AdminHomeScreen} />
                  <Stack.Screen
                    name="CreateNurse"
                    component={CreateNurseScreen}
                    options={{ presentation: 'modal' }}
                  />
                </>
              )}
            </>
          )}
        </Stack.Navigator>
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
