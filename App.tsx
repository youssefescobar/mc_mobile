import { useEffect, useRef } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, setupNotificationListeners, ensureFullScreenIntentPermission } from './src/services/NotificationService';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { CallProvider, useCall } from './src/context/CallContext';
import { ToastProvider } from './src/components/ToastContext';

function AppContent() {
  const { handleIncomingCallFromNotification, answerCall, declineCall } = useCall();
  const pendingCallHandled = useRef(false);

  useEffect(() => {
    // ── 1. Check for a pending call stored by the background Answer tap ──────
    // This handles scenario 3 (killed state): user tapped Answer on the
    // notification, the app launched, and we now restore the call UI.
    const restorePendingCall = async () => {
      if (pendingCallHandled.current) return;
      try {
        // Check for a pending ANSWER (killed state — user tapped Answer)
        const raw = await AsyncStorage.getItem('PENDING_CALL');
        if (raw) {
          await AsyncStorage.removeItem('PENDING_CALL');
          const { callerId, callerName, callerRole, offer } = JSON.parse(raw);
          console.log('[App] Restoring pending call from AsyncStorage:', callerName);
          pendingCallHandled.current = true;
          handleIncomingCallFromNotification(
            { id: callerId, name: callerName, role: callerRole },
            offer
          );
          return; // Don't check decline if we're answering
        }

        // Check for a pending DECLINE (backgrounded state — user tapped Decline)
        // The CallContext AppState listener also handles this, but checking here
        // as well ensures immediate cleanup with no modal flash.
        const declinedCallerId = await AsyncStorage.getItem('DECLINED_CALL');
        if (declinedCallerId) {
          await AsyncStorage.removeItem('DECLINED_CALL');
          console.log('[App] Background decline detected on launch, cleaning up');
          pendingCallHandled.current = true;
          declineCall();
        }
      } catch (e) {
        console.error('[App] Failed to restore pending call:', e);
      }
    };
    restorePendingCall();

    // ── 2. expo-notifications listener (non-call taps / general) ─────────────
    const cleanup = setupNotificationListeners(
      (notification) => {
        // Incoming call type is handled by Notifee — ignore here
        const data = notification.request.content.data;
        if (data?.type === 'incoming_call') return;
        console.log('[App] Notification received:', notification);
      },
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.type === 'incoming_call') return; // Notifee handles this
        console.log('[App] Notification tapped:', data);
      }
    );

    // ── 3. Notifee FOREGROUND event handler ───────────────────────────────────
    // Check Android 14+ USE_FULL_SCREEN_INTENT permission (lock screen calls)
    ensureFullScreenIntentPermission();

    // ── 4. Notifee FOREGROUND event handler ───────────────────────────────────
    // Handles Answer / Decline button taps when the app is in the FOREGROUND.
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
      const data = detail.notification?.data;
      if (!data || data.type !== 'incoming_call') return;

      if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'answer') {
          // Notification Answer tap while app is foregrounded
          // CallContext already has the pendingOffer from the socket event,
          // so just trigger answerCall() directly.
          if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);
          answerCall();

        } else if (detail.pressAction?.id === 'decline') {
          if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);
          declineCall();
        }

      } else if (type === EventType.PRESS) {
        // User tapped the notification body while app was visible —
        // the call modal should already be showing. Just dismiss notification.
        if (detail.notification?.id) notifee.cancelNotification(detail.notification.id);

        // If for some reason the call state wasn't set (edge case), restore it
        if (data.offer) {
          try {
            handleIncomingCallFromNotification(
              {
                id: data.callerId as string,
                name: data.callerName as string,
                role: data.callerRole as string,
              },
              data.offer
            );
          } catch (e) {
            console.error('[App] Error restoring call from foreground notification press:', e);
          }
        }
      }
    });

    return () => {
      cleanup();
      unsubscribeNotifee();
    };
  }, [handleIncomingCallFromNotification, answerCall, declineCall]);

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
