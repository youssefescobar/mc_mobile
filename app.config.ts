import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
    ...config,
    name: "Munawwara Care",
    slug: "mc_mobile",
    version: "1.0.0",
    scheme: "mc_mobile",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
        image: "./assets/splash-screen.png",
        resizeMode: "contain",
        backgroundColor: "#ffffff"
    },
    ios: {
        supportsTablet: true
    },
    android: {
        adaptiveIcon: {
            foregroundImage: "./assets/icon.png",
            backgroundColor: "#ffffff"
        },
        permissions: [
            "android.permission.FOREGROUND_SERVICE",
            "android.permission.WAKE_LOCK",
            "android.permission.CAMERA",
            "android.permission.RECORD_AUDIO",
            "android.permission.MODIFY_AUDIO_SETTINGS",
            "android.permission.VIBRATE",
            "android.permission.POST_NOTIFICATIONS",
            "android.permission.USE_FULL_SCREEN_INTENT",
            "android.permission.RECEIVE_BOOT_COMPLETED"
        ],
        edgeToEdgeEnabled: true,
        predictiveBackGestureEnabled: false,
        googleServicesFile: "./google-services.json",
        package: "com.munawwaracare.mcmobile",
        config: {
            googleMaps: {
                apiKey: process.env.GOOGLE_MAPS_API_KEY
            }
        }
    },
    plugins: [
        [
            "expo-notifications",
            {
                icon: "./assets/icon.png",
                color: "#ffffff",
                defaultChannel: "default",
                sounds: []
            }
        ],
        [
            "expo-build-properties",
            {
                android: {
                    useAndroidX: true,
                    enableProguardInReleaseBuilds: true,
                    usesCleartextTraffic: true,
                    extraMavenRepos: [
                        // Notifee local maven repo — used because dl.notifee.app is unreachable.
                        // expo-build-properties injects this into android/build.gradle during prebuild,
                        // so NO manual patching is needed after `expo prebuild`.
                        "$rootDir/../node_modules/@notifee/react-native/android/libs"
                    ]
                }
            }
        ],
        [
            "expo-camera",
            {
                cameraPermission: "Allow Munawwara Care to access your camera to scan the QR code.",
                microphonePermission: "Allow Munawwara Care to access your microphone for voice calls."
            }
        ]
    ]
});
