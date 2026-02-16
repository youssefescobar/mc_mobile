import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/NotificationService';
import './src/services/BackgroundNotificationTask'; // Register background task

export default function App() {
  useEffect(() => {
    // Just register for push notifications to get the token. 
    // The actual backend update should happen after login/splash when we have the auth token.
    registerForPushNotificationsAsync();

    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification response:', response);
      }
    );

    return cleanup;
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AppNavigator />
    </GestureHandlerRootView>
  );
}
