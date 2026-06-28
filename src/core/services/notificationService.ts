/**
 * Serviço de notificações push.
 *
 * Usa expo-notifications para:
 *   1. Registrar o push token do dispositivo
 *   2. Salvar o token no Firestore (usuarios/{uid}/pushToken)
 *   3. Configurar handlers para notificações recebidas
 *   4. Agendar notificações locais (lembretes de medicamento, etc)
 *
 * As notificações push reais serão enviadas via Cloud Functions
 * quando um evento relevante ocorrer (ex: intercorrência criada,
 * novo registro para família visualizar).
 *
 * IMPORTANTE: expo-notifications precisa ser instalado:
 *   yarn add expo-notifications
 *   npx pod-install
 */
import { Platform } from 'react-native';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';

import { db } from '../config/firebase';
import { Collections } from '../../shared/constants/firestore';

// ════════════════════════════════════════════
// Dynamic import (package may not be installed)
// ════════════════════════════════════════════

/* eslint-disable @typescript-eslint/no-explicit-any */
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch {
  // not installed yet
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ════════════════════════════════════════════
// Types
// ════════════════════════════════════════════

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

// ════════════════════════════════════════════
// Token registration
// ════════════════════════════════════════════

/**
 * Solicita permissão de push e registra o token no Firestore.
 * Deve ser chamado após login bem-sucedido.
 */
export const registerPushToken = async (userId: string): Promise<string | null> => {
  if (!Notifications) {
    if (__DEV__) console.warn('[Notifications] expo-notifications not installed');
    return null;
  }

  try {
    // Request permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      if (__DEV__) console.warn('[Notifications] Permission not granted');
      return null;
    }

    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id', // Match app.json extra.eas.projectId
    });
    const token = tokenData.data;

    // Save to Firestore
    await updateDoc(doc(db, Collections.USUARIOS, userId), {
      pushToken: token,
      pushTokenUpdatedAt: Timestamp.now(),
      pushPlatform: Platform.OS,
    });

    if (__DEV__) console.warn(`[Notifications] Token registered: ${token.slice(0, 20)}...`);

    return token;
  } catch (err) {
    console.error('[Notifications] Registration failed:', err);
    return null;
  }
};

// ════════════════════════════════════════════
// Notification channel (Android)
// ════════════════════════════════════════════

/**
 * Configura o canal de notificação para Android.
 * Deve ser chamado no bootstrap do app.
 */
export const setupNotificationChannel = async (): Promise<void> => {
  if (!Notifications || Platform.OS !== 'android') return;

  try {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'HomeCare',
      importance: Notifications.AndroidImportance?.MAX ?? 4,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2563EB',
    });

    await Notifications.setNotificationChannelAsync('intercorrencias', {
      name: 'Intercorrências',
      importance: Notifications.AndroidImportance?.MAX ?? 4,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#DC2626',
      sound: 'default',
    });
  } catch (err) {
    console.error('[Notifications] Channel setup failed:', err);
  }
};

// ════════════════════════════════════════════
// Notification handlers
// ════════════════════════════════════════════

/**
 * Configura os handlers de notificação.
 * Retorna cleanup function.
 */
export const setupNotificationHandlers = (
  onNotificationReceived?: (notification: NotificationPayload) => void,
  onNotificationTapped?: (data: Record<string, unknown>) => void
): (() => void) => {
  if (!Notifications) return () => {};

  // How to display when app is in foreground
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  // Listener for received notifications
  const receivedSub = Notifications.addNotificationReceivedListener(
    (notification: { request: { content: { title: string; body: string; data: Record<string, unknown> } } }) => {
      const { title, body, data } = notification.request.content;
      onNotificationReceived?.({ title: title ?? '', body: body ?? '', data });
    }
  );

  // Listener for tapped notifications
  const responseSub = Notifications.addNotificationResponseReceivedListener(
    (response: { notification: { request: { content: { data: Record<string, unknown> } } } }) => {
      const data = response.notification.request.content.data;
      onNotificationTapped?.(data);
    }
  );

  return () => {
    receivedSub?.remove();
    responseSub?.remove();
  };
};

// ════════════════════════════════════════════
// Local notifications (lembretes)
// ════════════════════════════════════════════

/**
 * Agenda uma notificação local (ex: lembrete de medicamento).
 */
export const scheduleLocalNotification = async (
  payload: NotificationPayload,
  triggerSeconds: number
): Promise<string | null> => {
  if (!Notifications) return null;

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: 'default',
      },
      trigger: {
        type: 'timeInterval',
        seconds: triggerSeconds,
      },
    });
    return id;
  } catch (err) {
    console.error('[Notifications] Schedule failed:', err);
    return null;
  }
};

/**
 * Cancela todas as notificações agendadas.
 */
export const cancelAllScheduled = async (): Promise<void> => {
  if (!Notifications) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
};
