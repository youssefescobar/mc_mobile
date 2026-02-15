import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, Keyboard, Alert, Modal, FlatList } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'SignUp'>;

type LanguageOption = { label: string; value: string; flag: string };
const LANGUAGES: LanguageOption[] = [
    { label: 'English', value: 'en', flag: '🇺🇸' },
    { label: 'Arabic', value: 'ar', flag: '🇸🇦' },
    { label: 'Urdu', value: 'ur', flag: '🇵🇰' },
    { label: 'French', value: 'fr', flag: '🇫🇷' },
    { label: 'Indonesian', value: 'id', flag: '🇮🇩' },
    { label: 'Turkish', value: 'tr', flag: '🇹🇷' },
];

import { PhoneNumberUtil } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

const COUNTRY_CODES = [
    { code: '+966', flag: '🇸🇦', region: 'SA', name: 'Saudi Arabia' },
    { code: '+971', flag: '🇦🇪', region: 'AE', name: 'UAE' },
    { code: '+20', flag: '🇪🇬', region: 'EG', name: 'Egypt' },
    { code: '+92', flag: '🇵🇰', region: 'PK', name: 'Pakistan' },
    { code: '+91', flag: '🇮🇳', region: 'IN', name: 'India' },
    { code: '+62', flag: '🇮🇩', region: 'ID', name: 'Indonesia' },
    { code: '+90', flag: '🇹🇷', region: 'TR', name: 'Turkey' },
    { code: '+1', flag: '🇺🇸', region: 'US', name: 'USA' },
    { code: '+44', flag: '🇬🇧', region: 'GB', name: 'UK' },
    { code: '+33', flag: '🇫🇷', region: 'FR', name: 'France' },
    { code: '+60', flag: '🇲🇾', region: 'MY', name: 'Malaysia' },
    { code: '+965', flag: '🇰🇼', region: 'KW', name: 'Kuwait' },
    { code: '+973', flag: '🇧🇭', region: 'BH', name: 'Bahrain' },
    { code: '+974', flag: '🇶🇦', region: 'QA', name: 'Qatar' },
    { code: '+968', flag: '🇴🇲', region: 'OM', name: 'Oman' },
    { code: '+962', flag: '🇯🇴', region: 'JO', name: 'Jordan' },
    { code: '+212', flag: '🇲🇦', region: 'MA', name: 'Morocco' },
    { code: '+213', flag: '🇩🇿', region: 'DZ', name: 'Algeria' },
    { code: '+216', flag: '🇹🇳', region: 'TN', name: 'Tunisia' },
    { code: '+964', flag: '🇮🇶', region: 'IQ', name: 'Iraq' },
    { code: '+880', flag: '🇧🇩', region: 'BD', name: 'Bangladesh' },
    { code: '+234', flag: '🇳🇬', region: 'NG', name: 'Nigeria' },
];

import { isValidSaudiID, isValidPassport } from '../utils/validation';

export default function SignUpScreen({ navigation }: Props) {
    const { t, i18n } = useTranslation();
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [identityType, setIdentityType] = useState<'national_id' | 'passport'>('national_id');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [selectedCountryCode, setSelectedCountryCode] = useState(COUNTRY_CODES[0]);
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');
    // Initialize language from current i18n language
    const currentLang = LANGUAGES.find(l => l.value === i18n.language) || LANGUAGES[0];
    const [selectedLanguage, setSelectedLanguage] = useState(currentLang);

    // Modals visibility
    const [showLangPicker, setShowLangPicker] = useState(false);
    const [showCountryPicker, setShowCountryPicker] = useState(false);

    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleLanguageChange = (lang: LanguageOption) => {
        setSelectedLanguage(lang);
        changeLanguage(lang.value);
    };

    const validatePhoneNumber = (phone: string, regionCode: string): boolean => {
        try {
            const number = phoneUtil.parseAndKeepRawInput(phone, regionCode);
            return phoneUtil.isValidNumber(number);
        } catch (error) {
            return false;
        }
    };

    const [phoneError, setPhoneError] = useState(false);
    const [nameError, setNameError] = useState(false);
    const [idError, setIdError] = useState(false);
    const [passwordError, setPasswordError] = useState(false);

    const handleSignUp = async () => {
        // Reset all errors
        setPhoneError(false);
        setNameError(false);
        setIdError(false);
        setPasswordError(false);

        let isValid = true;

        if (!fullName) {
            setNameError(true);
            isValid = false;
        }

        // Validate ID based on type
        if (!nationalId) {
            setIdError(true);
            isValid = false;
        } else {
            if (identityType === 'national_id') {
                if (!isValidSaudiID(nationalId)) {
                    setIdError(true);
                    isValid = false;
                }
            } else {
                if (!isValidPassport(nationalId)) {
                    setIdError(true);
                    isValid = false;
                }
            }
        }

        if (!password) {
            setPasswordError(true);
            isValid = false;
        }
        if (!phoneNumber) {
            // Check if empty, separate from checking validity later
            // But actually validatePhoneNumber checks emptiness implicitly or we can just rely on the next check.
            // Let's just say if empty, it's invalid phone.
            // Logic below handles phone validity.
        }

        // Validate Phone Number
        if (!validatePhoneNumber(phoneNumber, selectedCountryCode.region)) {
            setPhoneError(true);
            isValid = false;
        }

        if (!isValid) {
            // Optional: Show a generic toast or just rely on red borders. 
            // User requested "instead of getting a toast", so we might skip it or show a very subtle one.
            // I will skip the "fill_required" toast as per request.
            return;
        }

        setLoading(true);
        try {
            const fullPhoneNumber = `${selectedCountryCode.code}${phoneNumber}`;
            console.log('Registering pilgrim:', nationalId, fullPhoneNumber);

            const response = await api.post('/auth/register', {
                full_name: fullName,
                national_id: nationalId,
                phone_number: fullPhoneNumber,
                password,
                email: email.trim() || undefined,
                medical_history: medicalHistory.trim() || undefined,
                language: selectedLanguage.value
            });

            const { token, role, user_id } = response.data;

            setAuthToken(token);

            showToast(
                t('account_created'),
                'success',
                {
                    title: t('welcome_munawwara'),
                    actionLabel: t('continue'),
                    onAction: () => navigation.replace('PilgrimDashboard', { userId: user_id })
                }
            );

            // Auto-navigate after showing success
            setTimeout(() => navigation.replace('PilgrimDashboard', { userId: user_id }), 2000);
        } catch (error: any) {
            console.error('Registration Error:', error);

            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const firstErrorField = Object.keys(errors)[0];
                const errorMessage = errors[firstErrorField];
                showToast(errorMessage, 'error', { title: t('validation_error') });
            } else {
                showToast(error.response?.data?.message || t('registration_failed'), 'error', { title: t('registration_failed') });
            }
        } finally {
            setLoading(false);
        }
    };

    const renderPickerModal = (
        visible: boolean,
        onClose: () => void,
        data: any[],
        onSelect: (item: any) => void,
        renderItem: (item: any) => React.ReactElement,
        enableSearch: boolean = false
    ) => {
        const [searchText, setSearchText] = useState('');

        const filteredData = data.filter(item => {
            if (!enableSearch || !searchText) return true;
            const searchLower = searchText.toLowerCase();
            return (
                (item.name && item.name.toLowerCase().includes(searchLower)) ||
                (item.label && item.label.toLowerCase().includes(searchLower)) ||
                (item.code && item.code.toLowerCase().includes(searchLower))
            );
        });

        return (
            <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                    <View style={[styles.modalContent, { height: '80%', maxHeight: '80%' }]}>
                        <View style={[styles.modalHeader, (i18n.language === 'ar' || i18n.language === 'ur') && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.modalTitle}>{t('select_option')}</Text>
                            <TouchableOpacity onPress={onClose}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>

                        {enableSearch && (
                            <View style={styles.searchContainer}>
                                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                                <TextInput
                                    style={[styles.searchInput, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}
                                    placeholder={t('search') || "Search"}
                                    placeholderTextColor="#999"
                                    value={searchText}
                                    onChangeText={setSearchText}
                                />
                            </View>
                        )}

                        <FlatList
                            data={filteredData}
                            keyExtractor={(item, index) => index.toString()}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.pickerItem, (i18n.language === 'ar' || i18n.language === 'ur') && { alignItems: 'flex-end' }]} onPress={() => { onSelect(item); setSearchText(''); onClose(); }}>
                                    {renderItem(item)}
                                </TouchableOpacity>
                            )}
                            showsVerticalScrollIndicator={false}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                >

                    <View style={styles.headerContainer}>
                        <Text style={styles.title}>{t('create_account')}</Text>
                        <Text style={styles.subtitle}>{t('join_munawwara')}</Text>
                    </View>

                    <View style={styles.formContainer}>
                        {/* Language Selector */}
                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('language_preference')}</Text>
                            <TouchableOpacity style={[styles.pickerButton, (i18n.language === 'ar' || i18n.language === 'ur') && { flexDirection: 'row-reverse' }]} onPress={() => setShowLangPicker(true)}>
                                <Text style={styles.pickerButtonText}>{selectedLanguage.flag}  {selectedLanguage.label}</Text>
                                <Ionicons name="chevron-down" size={20} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('full_name')} *</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' },
                                    nameError && { borderColor: '#EF4444', borderWidth: 1.5 }
                                ]}
                                placeholder={t('full_name')}
                                placeholderTextColor="#999"
                                value={fullName}
                                onChangeText={(text) => {
                                    setFullName(text);
                                    if (nameError) setNameError(false);
                                }}
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('national_id_or_passport')} *</Text>

                            {/* Identity Type Toggle */}
                            <View style={styles.identityToggleContainer}>
                                <TouchableOpacity
                                    style={[styles.identityToggleButton, identityType === 'national_id' && styles.identityToggleButtonActive]}
                                    onPress={() => {
                                        setIdentityType('national_id');
                                        setIdError(false);
                                    }}
                                >
                                    <Text style={[styles.identityToggleButtonText, identityType === 'national_id' && styles.identityToggleButtonTextActive]}>
                                        {t('national_id_label')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.identityToggleButton, identityType === 'passport' && styles.identityToggleButtonActive]}
                                    onPress={() => {
                                        setIdentityType('passport');
                                        setIdError(false);
                                    }}
                                >
                                    <Text style={[styles.identityToggleButtonText, identityType === 'passport' && styles.identityToggleButtonTextActive]}>
                                        {t('passport_label')}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <TextInput
                                style={[
                                    styles.input,
                                    { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' },
                                    idError && { borderColor: '#EF4444', borderWidth: 1.5 }
                                ]}
                                placeholder={identityType === 'national_id' ? t('national_id_label') : t('passport_label')}
                                placeholderTextColor="#999"
                                value={nationalId}
                                onChangeText={(text) => {
                                    setNationalId(text);
                                    if (idError) setIdError(false);
                                }}
                                keyboardType={identityType === 'national_id' ? "numeric" : "default"}
                                maxLength={identityType === 'national_id' ? 10 : 20}
                            />
                            {idError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4, textAlign: (i18n.language === 'ar' || i18n.language === 'ur') ? 'right' : 'left' }}>
                                    {identityType === 'national_id' ? t('invalid_id') : t('invalid_passport')}
                                </Text>
                            )}
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('phone_number')} *</Text>
                            <View style={[styles.phoneInputContainer, (i18n.language === 'ar' || i18n.language === 'ur') && { flexDirection: 'row-reverse' }]}>
                                <TouchableOpacity style={[styles.countryCodeButton, (i18n.language === 'ar' || i18n.language === 'ur') && { marginRight: 0, marginLeft: 10, flexDirection: 'row-reverse' }]} onPress={() => setShowCountryPicker(true)}>
                                    <Text style={styles.countryCodeText}>{selectedCountryCode.code}</Text>
                                    <Ionicons name="chevron-down" size={16} color="#666" />
                                </TouchableOpacity>
                                <TextInput
                                    style={[
                                        styles.phoneInput,
                                        { textAlign: 'left' },
                                        phoneError && { borderColor: '#EF4444', borderWidth: 1.5 }
                                    ]}
                                    placeholder="50 123 4567"
                                    placeholderTextColor="#999"
                                    value={phoneNumber}
                                    onChangeText={(text) => {
                                        setPhoneNumber(text);
                                        if (phoneError) setPhoneError(false);
                                    }}
                                    keyboardType="phone-pad"
                                />
                            </View>
                            {phoneError && (
                                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4, marginLeft: 4, textAlign: (i18n.language === 'ar' || i18n.language === 'ur') ? 'right' : 'left' }}>
                                    {t('invalid_phone_number')}
                                </Text>
                            )}
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('password_placeholder')} *</Text>
                            <TextInput
                                style={[
                                    styles.input,
                                    { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' },
                                    passwordError && { borderColor: '#EF4444', borderWidth: 1.5 }
                                ]}
                                placeholder={t('password_placeholder')}
                                placeholderTextColor="#999"
                                value={password}
                                onChangeText={(text) => {
                                    setPassword(text);
                                    if (passwordError) setPasswordError(false);
                                }}
                                secureTextEntry
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('email_optional')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' }]}
                                placeholder={t('email_address_placeholder')}
                                placeholderTextColor="#999"
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={[styles.label, (i18n.language === 'ar' || i18n.language === 'ur') && { textAlign: 'right' }]}>{t('medical_history')}</Text>
                            <TextInput
                                style={[styles.input, styles.textArea, { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' }]}
                                placeholder={t('medical_history')}
                                placeholderTextColor="#999"
                                value={medicalHistory}
                                onChangeText={setMedicalHistory}
                                multiline
                                numberOfLines={3}
                            />
                        </View>

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSignUp}
                            disabled={loading}
                        >
                            <Text style={styles.buttonText}>{loading ? t('registering') : t('sign_up')}</Text>
                        </TouchableOpacity>

                        <View style={[styles.footer, (i18n.language === 'ar' || i18n.language === 'ur') && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.footerText}>{t('already_have_account')} </Text>
                            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                                <Text style={styles.linkText}>{t('login')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Language Picker Modal */}
            {renderPickerModal(showLangPicker, () => setShowLangPicker(false), LANGUAGES, handleLanguageChange, (item) => (
                <Text style={styles.pickerItemText}>{item.flag}  {item.label}</Text>
            ))}

            {/* Country Code Picker Modal */}
            {renderPickerModal(showCountryPicker, () => setShowCountryPicker(false), COUNTRY_CODES, setSelectedCountryCode, (item) => (
                <View style={{ flexDirection: (i18n.language === 'ar' || i18n.language === 'ur') ? 'row-reverse' : 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <View style={{ flexDirection: (i18n.language === 'ar' || i18n.language === 'ur') ? 'row-reverse' : 'row', alignItems: 'center' }}>
                        <Text style={styles.pickerItemText}>{item.flag}</Text>
                        <Text style={[styles.pickerItemText, { marginHorizontal: 10 }]}>{item.code}</Text>
                    </View>
                    <Text style={[styles.pickerItemText, { fontSize: 14, opacity: 0.5 }]}>{item.name}</Text>
                </View>
            ), true)}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingVertical: 20,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 5,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
    },
    inputWrapper: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 6,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E1E1E1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    phoneInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    countryCodeButton: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#E1E1E1',
        marginRight: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: 80,
        height: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    countryCodeText: {
        fontSize: 16,
        color: '#333',
    },
    phoneInput: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#E1E1E1',
        height: 48,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    pickerButton: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#E1E1E1',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    pickerButtonText: {
        fontSize: 16,
        color: '#333',
    },
    textArea: {
        minHeight: 80,
        textAlignVertical: 'top',
        paddingTop: 12,
    },
    button: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 20,
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: '#A0C4FF',
        shadowOpacity: 0,
    },
    buttonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    footerText: {
        fontSize: 15,
        color: '#666',
    },
    linkText: {
        color: '#007AFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '50%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    pickerItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    pickerItemText: {
        fontSize: 18,
        color: '#333',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 16,
        height: 48,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
        height: '100%',
    },
    identityToggleContainer: {
        flexDirection: 'row',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        padding: 4,
        marginBottom: 10,
    },
    identityToggleButton: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    identityToggleButtonActive: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    identityToggleButtonText: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500',
    },
    identityToggleButtonTextActive: {
        color: '#007AFF',
        fontWeight: '700',
    },
});
