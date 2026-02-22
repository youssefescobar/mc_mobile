import { registerRootComponent } from 'expo';
// ── CRITICAL: Register background task at root level BEFORE anything else.
// When the app is killed, RN starts from index.ts. If this import is only in
// App.tsx, the task is never registered and the killed-state call UI never shows.
import './src/services/BackgroundNotificationTask';
import './src/i18n'; // Initialize i18n
import notifee, { EventType } from '@notifee/react-native';
import { Vibration } from 'react-native';

import App from './App';

// ── Notifee Background Event Handler ──────────────────────────────────────────
// MUST be registered at root level before registerRootComponent.
// Handles notification action button presses when app is killed/backgrounded.
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const data = detail.notification?.data;

    if (!data || data.type !== 'incoming_call') return;

    if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'decline') {
            // Cancel notification + vibration immediately for instant feedback
            if (detail.notification?.id) {
                await notifee.cancelNotification(detail.notification.id);
            }
            Vibration.cancel();

            // Notify the caller via backend REST endpoint
            try {
                const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace('/api', '');
                const declineUrl = `${API_URL}/api/call-history/decline`;
                console.log('[Notifee BG] Calling decline endpoint:', declineUrl);

                const response = await fetch(declineUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callerId: data.callerId }),
                });
                const result = await response.json();
                console.log('[Notifee BG] Decline result:', result);
            } catch (e) {
                console.error('[Notifee BG] Failed to notify backend of decline:', e);
            }

        } else if (detail.pressAction?.id === 'answer') {
            // Just cancel — app will open and foreground handler takes over
            if (detail.notification?.id) {
                await notifee.cancelNotification(detail.notification.id);
            }
            Vibration.cancel();
            console.log('[Notifee BG] Answer tapped, handing off to foreground');
        }
    }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
