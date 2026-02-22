import { registerRootComponent } from 'expo';
// ── CRITICAL: Register background task at root level BEFORE anything else.
// When the app is killed, RN starts from index.ts. If this import is only in
// App.tsx, the task is never registered and the killed-state call UI never shows.
import './src/services/BackgroundNotificationTask';
import './src/i18n'; // Initialize i18n

import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dismissCallNotification } from './src/services/BackgroundNotificationTask';

import App from './App';

// ── Notifee Background Event Handler ──────────────────────────────────────────
// Runs when the user presses a notification action button while the app is
// KILLED or fully BACKGROUNDED (no foreground event handler running).
// MUST be registered before registerRootComponent.
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const data = detail.notification?.data;
    if (!data || data.type !== 'incoming_call') return;

    if (type === EventType.ACTION_PRESS) {

        if (detail.pressAction?.id === 'answer') {
            // User tapped "Answer" while app was killed or fully backgrounded.
            // 1. Dismiss the notification immediately.
            await dismissCallNotification();

            // 2. Store the call info in AsyncStorage so App.tsx can pick it up
            //    after the app process starts.
            try {
                const pendingCall = {
                    callerId: data.callerId as string,
                    callerName: data.callerName as string,
                    callerRole: data.callerRole as string,
                    offer: data.offer as string, // JSON string
                };
                await AsyncStorage.setItem('PENDING_CALL', JSON.stringify(pendingCall));
                console.log('[Notifee BG] Stored pending call for app launch:', pendingCall.callerName);
            } catch (e) {
                console.error('[Notifee BG] Failed to store pending call:', e);
            }
            // Android will open the app (launchActivity: 'default' on the action),
            // App.tsx reads PENDING_CALL from AsyncStorage and restores the UI.

        } else if (detail.pressAction?.id === 'decline') {
            // User tapped "Decline" — dismiss notification and notify the caller
            await dismissCallNotification();

            // Store the declined callerId so CallContext can reset its state
            // when the app comes back to the foreground (isHandlingCall guard fix).
            try {
                await AsyncStorage.setItem('DECLINED_CALL', data.callerId as string);
            } catch (_) { }

            try {
                const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace('/api', '');
                // Read the JWT token from storage so the request is authenticated
                const token = await AsyncStorage.getItem('token');
                const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${apiUrl}/api/call-history/decline`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ callerId: data.callerId }),
                });
                const result = await response.json();
                console.log('[Notifee BG] Decline result:', result.success);
            } catch (e) {
                console.error('[Notifee BG] Failed to notify backend of decline:', e);
            }
        }

    } else if (type === EventType.PRESS) {
        // User tapped the notification body — treat same as Answer
        await dismissCallNotification();
        try {
            const pendingCall = {
                callerId: data.callerId as string,
                callerName: data.callerName as string,
                callerRole: data.callerRole as string,
                offer: data.offer as string,
            };
            await AsyncStorage.setItem('PENDING_CALL', JSON.stringify(pendingCall));
        } catch (_) { }
    }
});

registerRootComponent(App);
