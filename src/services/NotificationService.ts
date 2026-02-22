import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Alert, Linking, Platform } from 'react-native';
import notifee, { AndroidNotificationSetting } from '@notifee/react-native';

// Configure foreground notification presentation
Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
        // Don't show system notification banners for incoming calls –
        // CallContext handles the in-app UI (foreground) or Notifee handles
        // the background notification. Suppress expo's default banner for calls.
        const data = notification.request.content.data;
        if (data?.type === 'incoming_call') {
            return {
                shouldPlaySound: false,
                shouldSetBadge: false,
                shouldShowBanner: false,
                shouldShowList: false,
            };
        }
        return {
            shouldPlaySound: true,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
        };
    },
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
            sound: 'urgent.wav',
        });

        // incoming_call channel is managed by Notifee (ensureCallChannel in BackgroundNotificationTask)
        // This expo channel is kept as a fallback reference only and is not used for call display.
        await Notifications.setNotificationChannelAsync('incoming_call', {
            name: 'Incoming Calls (Notifee)',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 1000, 1000, 1000],
            lightColor: '#00FF00',
            bypassDnd: true,
            lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
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
            console.log('[Notifications] Permission not granted');
            return;
        }

        try {
            // Use native FCM token directly — bypasses Expo Push Service
            // so Firebase Admin SDK can send data-only messages with full control.
            const tokenData = await Notifications.getDevicePushTokenAsync();
            token = tokenData.data;
            console.log('[Notifications] Native FCM Token:', token);
        } catch (e) {
            console.error('[Notifications] Error getting push token:', e);
        }
    } else {
        console.log('[Notifications] Must use physical device for Push Notifications');
    }

    return token;
}

/**
 * On Android 14+, USE_FULL_SCREEN_INTENT is a restricted permission.
 * Declaring it in the manifest alone is not enough — the user must grant it.
 * Without it, fullScreenIntent (lock-screen call UI) is silently ignored by Android.
 */
export async function ensureFullScreenIntentPermission(): Promise<boolean> {
    if (Platform.OS !== 'android') return true;
    try {
        const settings = await notifee.getNotificationSettings();
        // `fullScreenIntent` exists at runtime on Android 14+ but may be missing
        // from older @notifee/react-native type definitions — cast to any safely.
        const androidSettings = settings.android as any;
        if (androidSettings.fullScreenIntent === AndroidNotificationSetting.DISABLED) {
            Alert.alert(
                'Permission Required',
                'To show incoming calls on your lock screen, please enable "Display over lock screen" for this app.',
                [
                    { text: 'Later', style: 'cancel' },
                    {
                        text: 'Open Settings',
                        onPress: async () => {
                            // Deep-link to the exact Android 14+ page for this permission
                            try {
                                await Linking.sendIntent(
                                    'android.settings.MANAGE_APP_USE_FULL_SCREEN_INTENT',
                                    [{ key: 'package', value: 'com.munawwaracare.mcmobile' }]
                                );
                            } catch (_) {
                                // Fallback to general notification settings
                                await notifee.openNotificationSettings();
                            }
                        },
                    },
                ]
            );
            return false;
        }
        return true; // ENABLED or NOT_SUPPORTED (pre-Android 14, auto-granted)
    } catch (e) {
        // getNotificationSettings failed — assume OK (older Android)
        return true;
    }
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
