import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configurar el manejo de notificaciones
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: true,
  }),
});

// Configurar canal de notificaciones para Android
export const configureNotifications = async () => {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('background-tasks', {
      name: 'Tareas en segundo plano',
      description: 'Notificaciones sobre jugadas procesadas en segundo plano',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });

    await Notifications.setNotificationChannelAsync('play-status', {
      name: 'Estado de jugadas',
      description: 'Información sobre el estado de las jugadas',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#4CAF50',
    });
  }

  // Solicitar permisos
  const { status } = await Notifications.requestPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Permisos de notificación no otorgados');
    return false;
  }

  return true;
};

// Tipos de notificación
export const NOTIFICATION_TYPES = {
  PLAY_SUCCESS: 'play_success',
  PLAY_PENDING: 'play_pending',
  PLAY_ERROR: 'play_error',
  CONNECTION_RESTORED: 'connection_restored',
  BATCH_PROCESSED: 'batch_processed'
};

// Enviar notificación personalizada
export const sendNotification = async (type, title, body, data = {}) => {
  try {
    let channelId = 'background-tasks';
    
    if ([NOTIFICATION_TYPES.PLAY_SUCCESS, NOTIFICATION_TYPES.PLAY_ERROR].includes(type)) {
      channelId = 'play-status';
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: { type, ...data },
        sound: false,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: null, // Enviar inmediatamente
      ...(Platform.OS === 'android' && { channelId }),
    });

    console.log('Notificación enviada:', { type, title, body });
  } catch (error) {
    console.error('Error enviando notificación:', error);
  }
};

export default {
  configureNotifications,
  sendNotification,
  NOTIFICATION_TYPES
};