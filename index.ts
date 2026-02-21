import { registerRootComponent } from 'expo';
import './src/i18n'; // Initialize i18n
import notifee, { EventType } from '@notifee/react-native';

import App from './App';

// ── Notifee Background Event Handler ──────────────────────────────────────────
// MUST be registered at root level before registerRootComponent.
// Handles notification action button presses when app is killed/backgrounded.
notifee.onBackgroundEvent(async ({ type, detail }) => {
    const data = detail.notification?.data;

    if (!data || data.type !== 'incoming_call') return;

    if (type === EventType.ACTION_PRESS) {
        if (detail.pressAction?.id === 'decline') {
            // Cancel notification first for instant UI feedback
            if (detail.notification?.id) {
                await notifee.cancelNotification(detail.notification.id);
            }

            // Notify the caller via backend REST endpoint
            // (We can't access the socket here, but the backend can relay it)
            try {
                const API_URL = process.env.EXPO_PUBLIC_API_URL || '';
                await fetch(`${API_URL}/api/call-history/decline`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ callerId: data.callerId }),
                });
                console.log('[Notifee BG] Decline sent to backend for caller:', data.callerId);
            } catch (e) {
                console.error('[Notifee BG] Failed to notify backend of decline:', e);
            }

        } else if (detail.pressAction?.id === 'answer') {
            // Just cancel notification — app will open and foreground handler takes over
            if (detail.notification?.id) {
                await notifee.cancelNotification(detail.notification.id);
            }
            console.log('[Notifee BG] Answer tapped, handing off to foreground');
        }
    }
});

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
