import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance, AndroidCategory, AndroidVisibility } from '@notifee/react-native';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// ── Notifee call channel ───────────────────────────────────────────────────────
// Must be created before displayNotification is called.
// IMPORTANCE.HIGH is required for fullScreenIntent on Android.
export async function ensureCallChannel() {
    await notifee.createChannel({
        id: 'incoming_call_ui',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [500, 1000, 500, 1000, 500, 1000],
        sound: 'default',
        bypassDnd: true,
        visibility: AndroidVisibility.PUBLIC,
    });
}

// ── Show the incoming call Notifee notification ────────────────────────────────
// Can be called from both the background task (FCM path) and from
// CallContext (socket path, when app is backgrounded).
export async function showIncomingCallNotification(
    callerName: string,
    callerRole: string,
    callerId: string,
    offer: string // JSON string
) {
    await ensureCallChannel();

    await notifee.displayNotification({
        id: 'incoming_call',          // fixed ID so multiple calls don't stack
        title: callerName || 'Incoming Call',
        body: `${callerRole || 'User'} is calling`,
        data: {
            type: 'incoming_call',
            callerId,
            callerName,
            callerRole,
            offer,
        },
        android: {
            channelId: 'incoming_call_ui',
            importance: AndroidImportance.HIGH,
            category: AndroidCategory.CALL,
            visibility: AndroidVisibility.PUBLIC,
            // fullScreenIntent: show call UI on lock screen (screen off)
            fullScreenAction: {
                id: 'default',
                launchActivity: 'default',
            },
            // Default press action: open the app to the foreground
            pressAction: {
                id: 'default',
                launchActivity: 'default',
            },
            actions: [
                {
                    title: '❌ Decline',
                    pressAction: { id: 'decline', launchActivity: 'default' },
                },
                {
                    title: '✅ Answer',
                    pressAction: { id: 'answer', launchActivity: 'default' },
                },
            ],
            sound: 'default',
            ongoing: true,       // can't be swiped away while ringing
            autoCancel: false,
            color: '#2563EB',
            largeIcon: 'notification_icon',
        },
    });
}

// ── Dismiss the incoming call notification ─────────────────────────────────────
export async function dismissCallNotification() {
    try {
        await notifee.cancelNotification('incoming_call');
    } catch (_) {
        // ignore
    }
}

// ── Background / Killed FCM Handler ──────────────────────────────────────────
// This task runs when FCM arrives and the app is in background or killed.
// The backend ONLY sends FCM when the recipient has NO active socket,
// so this path is exclusively for killed / offline scenarios.
TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
    if (error) {
        console.error('[BackgroundTask] Error:', error);
        return;
    }

    if (!data) return;

    // @ts-ignore
    const notificationData = data.notification?.data || data.data;

    // ── Incoming Call ──────────────────────────────────────────────────────────
    if (notificationData?.type === 'incoming_call') {
        console.log('[BackgroundTask] Incoming call FCM received — showing Notifee notification');
        try {
            await showIncomingCallNotification(
                notificationData.callerName,
                notificationData.callerRole,
                notificationData.callerId,
                notificationData.offer,
            );
            console.log('[BackgroundTask] ✓ Incoming call notification displayed');
        } catch (e) {
            console.error('[BackgroundTask] Failed to show call notification:', e);
        }
        return;
    }

    // ── Urgent TTS ────────────────────────────────────────────────────────────
    if (notificationData?.type === 'urgent' && notificationData?.messageType === 'tts') {
        try {
            await Audio.setAudioModeAsync({
                staysActiveInBackground: true,
                shouldDuckAndroid: true,
                playThroughEarpieceAndroid: false,
                allowsRecordingIOS: false,
            });

            const soundObject = new Audio.Sound();
            try {
                await soundObject.loadAsync(require('../../assets/urgent.wav'));
                await soundObject.playAsync();
                await new Promise<void>((resolve) => {
                    soundObject.setOnPlaybackStatusUpdate((status) => {
                        if (status.isLoaded && status.didJustFinish) resolve();
                    });
                    setTimeout(resolve, 3000);
                });
                await soundObject.unloadAsync();
            } catch (audioError) {
                console.log('[BackgroundTask] Error playing urgent sound', audioError);
            }

            if (notificationData.body || notificationData.message || notificationData.content) {
                const textToSpeak = notificationData.body || notificationData.message || notificationData.content;
                await new Promise<void>((resolve) => {
                    Speech.speak('Urgent message saying', {
                        language: 'en',
                        rate: 1.1,
                        onDone: () => resolve(),
                        onError: () => resolve(),
                    });
                });
                await new Promise<void>((resolve) => {
                    Speech.speak(textToSpeak, {
                        language: 'en',
                        pitch: 1.0,
                        rate: 0.9,
                        onDone: () => resolve(),
                        onError: () => resolve(),
                    });
                });
            }
        } catch (e) {
            console.error('[BackgroundTask] Failed urgent TTS sequence:', e);
        }
    }
});

// Register the task — must run at module load time (imported from index.ts)
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
