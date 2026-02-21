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
export async function openNavigation(lat: number, lng: number, label?: string, googleMapsOnly?: boolean) {
    const encodedLabel = encodeURIComponent(label || 'Destination');

    const options: MapOption[] = [];

    // Apple Maps (iOS only)
    if (Platform.OS === 'ios' && !googleMapsOnly) {
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

    if (!googleMapsOnly) {
        // Waze
        options.push({
            label: 'Waze',
            url: `waze://?ll=${lat},${lng}&navigate=yes`,
            scheme: 'waze://',
        });
    }

    // Web fallback (always available unless googleMapsOnly)
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

    if (!googleMapsOnly) {
        // Always add web fallback
        available.push({ label: 'Open in Browser', url: webUrl, scheme: '' });
    }

    // If only one option (e.g. Google Maps only and it's available), just open it
    if (available.length === 1) {
        Linking.openURL(available[0].url);
        return;
    }

    // If no options available (e.g. Google Maps not installed on iOS), 
    // and we are NOT in googleMapsOnly mode, fallback to web.
    // If we ARE in googleMapsOnly mode and it's not installed, we might need a prompt.
    if (available.length === 0) {
        if (!googleMapsOnly) {
            Linking.openURL(webUrl);
        } else {
            // On iOS, if comgooglemaps:// fails, we can't open the app.
            // On Android, google.navigation: usually opens the play store or app.
            Alert.alert('Google Maps Required', 'Please install the Google Maps app to use this feature.');
        }
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
        // Android: use Alert with buttons
        const buttons = available.slice(0, 3).map(opt => ({
            text: opt.label,
            onPress: () => { Linking.openURL(opt.url); },
        }));
        buttons.push({ text: 'Cancel', onPress: () => { /* no-op */ } });

        Alert.alert('Navigate with...', undefined, buttons);
    }
}

