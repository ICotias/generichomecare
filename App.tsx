import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './src/core/navigation/RootNavigator';
import { useAuthStore } from './src/core/hooks/useAuth';
import { startQueueProcessor, stopQueueProcessor } from './src/core/services/offlineQueue';
import { setupNotificationChannel, setupNotificationHandlers } from './src/core/services/notificationService';

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    const unsubscribe = initialize();
    return unsubscribe;
  }, [initialize]);

  // Start offline queue processor
  useEffect(() => {
    startQueueProcessor();
    return () => stopQueueProcessor();
  }, []);

  // Setup push notifications
  useEffect(() => {
    setupNotificationChannel();
    const cleanup = setupNotificationHandlers();
    return cleanup;
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <RootNavigator />
    </SafeAreaProvider>
  );
}
