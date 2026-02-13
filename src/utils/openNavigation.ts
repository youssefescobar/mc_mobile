import { Platform, Linking, ActionSheetIOS, Alert } from 'react-native';

interface MapOption {
    label: string;
    url: string;
    scheme: string;
}

/**
 * Opens a chooser (ActionSheet on iOS, Alert on Android) letting the user
 * pick which navigation app to use for turn-by-turn directions.
 */
export async function openNavigation(lat: number, lng: number, label?: string) {
    const encodedLabel = encodeURIComponent(label || 'Destination');

    const options: MapOption[] = [];

    // Apple Maps (iOS only)
    if (Platform.OS === 'ios') {
        options.push({
            label: 'Apple Maps',
            url: `maps://app?daddr=${lat},${lng}&dirflg=d`,
            scheme: 'maps://',
        });
    }

    // Google Maps
    options.push({
        label: 'Google Maps',
        url: Platform.OS === 'ios'
            ? `comgooglemaps://?daddr=${lat},${lng}&directionsmode=driving`
            : `google.navigation:q=${lat},${lng}`,
        scheme: Platform.OS === 'ios' ? 'comgooglemaps://' : 'google.navigation:',
    });

    // Waze
    options.push({
        label: 'Waze',
        url: `waze://?ll=${lat},${lng}&navigate=yes`,
        scheme: 'waze://',
    });

    // Web fallback (always available)
    const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    // Check which apps are available
    const available: MapOption[] = [];
    for (const opt of options) {
        try {
            const canOpen = await Linking.canOpenURL(opt.scheme);
            if (canOpen) available.push(opt);
        } catch {
            // Skip unavailable
        }
    }

    // Always add web fallback
    available.push({ label: 'Open in Browser', url: webUrl, scheme: '' });

    // If only web fallback, just open it
    if (available.length === 1) {
        Linking.openURL(webUrl);
        return;
    }

    // Show chooser
    if (Platform.OS === 'ios') {
        const labels = [...available.map(o => o.label), 'Cancel'];
        ActionSheetIOS.showActionSheetWithOptions(
            {
                options: labels,
                cancelButtonIndex: labels.length - 1,
                title: 'Navigate with...',
            },
            (buttonIndex) => {
                if (buttonIndex < available.length) {
                    Linking.openURL(available[buttonIndex].url);
                }
            }
        );
    } else {
        // Android: use Alert with buttons (max 3 buttons, so limit options)
        const buttons = available.slice(0, 3).map(opt => ({
            text: opt.label,
            onPress: () => { Linking.openURL(opt.url); },
        }));
        buttons.push({ text: 'Cancel', onPress: () => { /* no-op */ } });

        Alert.alert('Navigate with...', undefined, buttons);
    }
}
