import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure how notifications are handled when the app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [250, 250, 250, 250],
            lightColor: '#FF231F7C',
        });

        await Notifications.setNotificationChannelAsync('urgent', {
            name: 'Urgent',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [500, 500, 500, 500],
            lightColor: '#FF0000',
            sound: 'urgent.wav', // We need to add this sound file
        });

        // Note: incoming_call notifications are handled by Notifee in BackgroundNotificationTask
        // when app is background/killed. This channel is kept for consistency with foreground flow.
        await Notifications.setNotificationChannelAsync('incoming_call', {
            name: 'Incoming Calls',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [800, 600, 800, 600, 800, 600, 800, 600],
            lightColor: '#00FF00',
            sound: 'default',
            enableVibrate: true,
            showBadge: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
            bypassDnd: true,
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token for push notification!');
            return;
        }

        try {
            // We use getDevicePushTokenAsync to get the native FCM token directly.
            // This bypasses Expo's Push Service and allows us to use Firebase Admin SDK directly on the backend.
            // This is crucial for "Urgent" notifications where we need granular control over Android Channels and specific sounds.
            const tokenData = await Notifications.getDevicePushTokenAsync();
            token = tokenData.data;
            console.log('Native FCM Token:', token);
        } catch (e) {
            console.error('Error getting push token:', e);
        }
    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}

export const setupNotificationListeners = (
    onNotificationReceived: (notification: Notifications.Notification) => void,
    onNotificationResponse: (response: Notifications.NotificationResponse) => void
) => {
    const receivedSubscription = Notifications.addNotificationReceivedListener(onNotificationReceived);
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(onNotificationResponse);

    return () => {
        receivedSubscription.remove();
        responseSubscription.remove();
    };
};
