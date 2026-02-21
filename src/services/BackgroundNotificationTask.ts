import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import notifee, { AndroidImportance, AndroidCategory } from '@notifee/react-native';


export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

// Create the call notification channel (Notifee)
async function ensureCallChannel() {
    await notifee.createChannel({
        id: 'incoming_call_ui',
        name: 'Incoming Calls',
        importance: AndroidImportance.HIGH,
        vibration: true,
        vibrationPattern: [300, 500, 300, 500],
        sound: 'default',
    });
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
    if (error) {
        console.error('Background notification task failed:', error);
        return;
    }

    if (data) {
        // @ts-ignore
        const notificationData = data.notification?.data || data.data; // Handle both notification payload and data-only payload

        // ── Incoming Call (Notifee fullScreenIntent) ───────────────────────────
        if (notificationData?.type === 'incoming_call') {
            try {
                await ensureCallChannel();

                await notifee.displayNotification({
                    title: notificationData.callerName || 'Incoming Call',
                    body: `${notificationData.callerRole || 'Moderator'} is calling`,
                    data: {
                        type: 'incoming_call',
                        callerId: notificationData.callerId,
                        callerName: notificationData.callerName,
                        callerRole: notificationData.callerRole,
                        offer: notificationData.offer,
                    },
                    android: {
                        channelId: 'incoming_call_ui',
                        importance: AndroidImportance.HIGH,
                        category: AndroidCategory.CALL,
                        fullScreenAction: {
                            id: 'default',
                        },
                        pressAction: {
                            id: 'answer',
                            launchActivity: 'default',
                        },
                        actions: [
                            {
                                title: 'Decline',
                                pressAction: { id: 'decline' },
                            },
                            {
                                title: 'Answer',
                                pressAction: { id: 'answer', launchActivity: 'default' },
                            },
                        ],
                        sound: 'default',
                        vibrationPattern: [300, 500, 300, 500, 300, 500],
                        ongoing: true,
                        autoCancel: false,
                        color: '#2563EB',
                        largeIcon: 'notification_icon',
                    },
                });

                console.log('[BackgroundTask] ✓ Incoming call fullScreenIntent displayed');
            } catch (e) {
                console.error('[BackgroundTask] Failed to show call fullScreenIntent:', e);
            }
            return; // Don't fall through to TTS handling
        }

        // ── Urgent TTS (unchanged) ─────────────────────────────────────────────
        // STRICTLY check for type === 'urgent' to avoid playing normal TTS messages
        if (notificationData?.type === 'urgent' && notificationData?.messageType === 'tts') {
            try {
                // Configure audio mode for background playback
                await Audio.setAudioModeAsync({
                    staysActiveInBackground: true,
                    shouldDuckAndroid: true,
                    playThroughEarpieceAndroid: false,
                    allowsRecordingIOS: false,
                });

                // 1. Play urgent sound (Intro)
                const soundObject = new Audio.Sound();
                try {
                    await soundObject.loadAsync(require('../../assets/urgent.wav'));
                    await soundObject.playAsync();

                    // Wait for sound to finish
                    await new Promise<void>((resolve) => {
                        soundObject.setOnPlaybackStatusUpdate((status) => {
                            if (status.isLoaded && status.didJustFinish) {
                                resolve();
                            }
                        });
                        // Timeout fallback
                        setTimeout(resolve, 3000);
                    });
                    await soundObject.unloadAsync();
                } catch (audioError) {
                    console.log('Error playing urgent sound', audioError);
                }

                // 2. Speak the message (Body only, no intro text)
                if (notificationData.body || notificationData.message || notificationData.content) {
                    const textToSpeak = notificationData.body || notificationData.message || notificationData.content;
                    // Intro
                    await new Promise<void>((resolve) => {
                        Speech.speak("Urgent message saying", {
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
                console.error('Failed to execute urgent sequence in background:', e);
            }
        }
    }
});

// Register the task to run when a notification is received while the app is backgrounded/killed
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
