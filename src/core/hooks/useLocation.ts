import { useState, useCallback } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';

interface LocationCoords {
  latitude: number;
  longitude: number;
}

interface UseLocationReturn {
  isLoading: boolean;
  getCurrentLocation: () => Promise<LocationCoords | null>;
}

/**
 * Hook para captura de localização GPS.
 * Pede permissão just-in-time (no momento do uso)
 * conforme Apple HIG — aumenta taxa de aceite.
 */
export const useLocation = (): UseLocationReturn => {
  const [isLoading, setIsLoading] = useState(false);

  const getCurrentLocation = useCallback(async (): Promise<LocationCoords | null> => {
    setIsLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert(
          'Localização necessária',
          'Precisamos da sua localização para registrar o checkin/checkout do plantão. Ative nas configurações do dispositivo.',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Abrir Configurações', onPress: () => Linking.openSettings() },
          ]
        );
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
    } catch (error) {
      console.error('Erro ao obter localização:', error);
      Alert.alert('Erro', 'Não foi possível obter sua localização. Tente novamente.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, getCurrentLocation };
};
