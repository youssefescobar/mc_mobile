import { useTranslation } from 'react-i18next';

/**
 * Hook to determine if the current language is RTL (Arabic, Urdu).
 * Replaces inline `i18n.language === 'ar' || i18n.language === 'ur'` checks.
 */
export function useIsRTL(): boolean {
    const { i18n } = useTranslation();
    return i18n.language === 'ar' || i18n.language === 'ur';
}
