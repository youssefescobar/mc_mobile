import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationListeners } from './src/services/NotificationService';
// Note: BackgroundNotificationTask is registered in index.ts (root level) for killed-state support
import notifee, { EventType } from '@notifee/react-native';

import { CallProvider, useCall } from './src/context/CallContext';
import { ToastProvider } from './src/components/ToastContext';

function AppContent() {
  const { handleIncomingCallFromNotification, declineCall } = useCall();

  useEffect(() => {
    // ── expo-notifications: handle notification tap (existing) ──────────────
    const cleanup = setupNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
      },
      (response) => {
        console.log('Notification response:', response);
        const data = response.notification.request.content.data;

        // Handle incoming call notification tap (expo-notifications path)
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

    // ── Notifee: foreground event handler ───────────────────────────────────
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data;
      if (!data || data.type !== 'incoming_call') return;

      if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'answer') {
          // User tapped "Answer" on the notification 
          try {
            const offer = typeof data.offer === 'string' ? JSON.parse(data.offer) : data.offer;
            const callerInfo = {
              id: data.callerId as string,
              name: data.callerName as string,
              role: data.callerRole as string,
            };
            handleIncomingCallFromNotification(callerInfo, offer);
            // Dismiss the notification
            if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);
          } catch (e) {
            console.error('[App] Error handling notifee answer action:', e);
          }
        } else if (detail.pressAction?.id === 'decline') {
          declineCall();
          if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);
        }
      } else if (type === EventType.PRESS) {
        // User tapped the notification body → open app → show call screen
        try {
          const offer = typeof data.offer === 'string' ? JSON.parse(data.offer) : data.offer;
          const callerInfo = {
            id: data.callerId as string,
            name: data.callerName as string,
            role: data.callerRole as string,
          };
          handleIncomingCallFromNotification(callerInfo, offer);
          if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);
        } catch (e) {
          console.error('[App] Error handling notifee press event:', e);
        }
      }
    });

    return () => {
      cleanup();
      unsubscribeNotifee();
    };
  }, [handleIncomingCallFromNotification, declineCall]);

  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ToastProvider>
            <CallProvider>
              <AppContent />
            </CallProvider>
          </ToastProvider>
        </GestureHandlerRootView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
