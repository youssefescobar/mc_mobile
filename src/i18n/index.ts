import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager, NativeModules } from 'react-native';
import * as Updates from 'expo-updates';

const reloadApp = async () => {
    if (__DEV__) {
        NativeModules.DevSettings.reload();
    } else {
        try {
            await Updates.reloadAsync();
        } catch (e) {
            console.error('Failed to reload app for RTL changes', e);
        }
    }
};

// Import translation files
import en from './translations/en.json';
import ar from './translations/ar.json';
import ur from './translations/ur.json';
import fr from './translations/fr.json';
import id from './translations/id.json';
import tr from './translations/tr.json';

const resources = {
    en: { translation: en },
    ar: { translation: ar },
    ur: { translation: ur },
    fr: { translation: fr },
    id: { translation: id },
    tr: { translation: tr },
};

const LANGUAGE_KEY = 'user-language';

const initI18n = async () => {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);

    if (!savedLanguage) {
        // Fallback to device locale, or default to 'en'
        const deviceLanguage = Localization.getLocales()[0].languageCode;
        savedLanguage = deviceLanguage && Object.keys(resources).includes(deviceLanguage) ? deviceLanguage : 'en';
    }

    const isRtl = savedLanguage === 'ar' || savedLanguage === 'ur';

    // If RTL setting mismatch, set it and reload to apply the layout change
    if (I18nManager.isRTL !== isRtl) {
        I18nManager.allowRTL(isRtl);
        I18nManager.forceRTL(isRtl);
        await reloadApp();
    }

    i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: savedLanguage,
            fallbackLng: 'en',
            interpolation: {
                escapeValue: false,
            },
            react: {
                useSuspense: false,
            },
        });
};

initI18n();

export default i18n;

// Helper to change language and persist it
export const changeLanguage = async (lang: string) => {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    i18n.changeLanguage(lang);

    const isRtl = lang === 'ar' || lang === 'ur';
    if (I18nManager.isRTL !== isRtl) {
        I18nManager.allowRTL(isRtl);
        I18nManager.forceRTL(isRtl);
        setTimeout(async () => {
            await reloadApp();
        }, 100);
    }
};
