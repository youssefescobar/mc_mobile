import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Speech from 'expo-speech';

export const BACKGROUND_NOTIFICATION_TASK = 'BACKGROUND-NOTIFICATION-TASK';

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error, executionInfo }) => {
    if (error) {
        console.error('Background notification task failed:', error);
        return;
    }

    if (data) {
        // @ts-ignore
        const notificationData = data.notification?.data;

        if (notificationData?.type === 'urgent') {
            try {
                // Attempt to speak the message body
                if (notificationData.body) {
                    Speech.speak(notificationData.body, {
                        language: 'en',
                        pitch: 1.0,
                        rate: 1.0,
                    });
                }
            } catch (e) {
                console.error('Failed to play TTS in background:', e);
            }
        }
    }
});

// Register the task to run when a notification is received while the app is backgrounded/killed
Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
