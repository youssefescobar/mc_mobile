import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/NotificationService';
import './src/services/BackgroundNotificationTask'; // Register background task

import { CallProvider, useCall } from './src/context/CallContext';
import { ToastProvider } from './src/components/ToastContext';

function AppContent() {
  const { handleIncomingCallFromNotification } = useCall();

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
        const data = response.notification.request.content.data;

        // Handle incoming call notification tap
        if (data.type === 'incoming_call') {
          console.log('[App] Handling incoming call from notification');
          try {
            const offer = JSON.parse(data.offer as string);
            const callerInfo = {
              id: data.callerId as string,
              name: data.callerName as string,
              role: data.callerRole as string,
            };
            handleIncomingCallFromNotification(callerInfo, offer);
          } catch (error) {
            console.error('[App] Error parsing call notification data:', error);
          }
        }
      }
    );

    return cleanup;
  }, [handleIncomingCallFromNotification]);

  return <AppNavigator />;
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <CallProvider>
          <AppContent />
        </CallProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
