import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput, Animated, Modal, FlatList } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, clearAuthToken, logout } from '../services/api';
import { socketService } from '../services/socket';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimProfile'>;

interface PilgrimProfile {
    _id: string;
    full_name: string;
    email?: string;
    email_verified?: boolean;
    pending_moderator_request?: boolean;
    moderator_request_status?: 'pending' | 'approved' | 'rejected' | null;
    phone_number?: string;
    national_id?: string;
    medical_history?: string;
    age?: number;
    gender?: string;
    role?: string;
    language?: string;
}

type LanguageOption = { label: string; value: string; flag: string };
const LANGUAGES: LanguageOption[] = [
    { label: 'English', value: 'en', flag: '🇺🇸' },
    { label: 'Arabic', value: 'ar', flag: '🇸🇦' },
    { label: 'Urdu', value: 'ur', flag: '🇵🇰' },
    { label: 'French', value: 'fr', flag: '🇫🇷' },
    { label: 'Indonesian', value: 'id', flag: '🇮🇩' },
    { label: 'Turkish', value: 'tr', flag: '🇹🇷' },
];

export default function PilgrimProfileScreen({ navigation, route }: Props) {
    const { t, i18n } = useTranslation();
    const [profile, setProfile] = useState<PilgrimProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [updatingEmail, setUpdatingEmail] = useState(false);
    const [showLangPicker, setShowLangPicker] = useState(false);
    const { showToast } = useToast();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const isFocused = useIsFocused();

    const currentLang = LANGUAGES.find(l => l.value === i18n.language) || LANGUAGES[0];
    const [selectedLanguage, setSelectedLanguage] = useState(currentLang);

    useEffect(() => {
        fetchProfile();
    }, []);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true
        }).start();
    }, [fadeAnim]);

    // Refresh profile when screen comes into focus
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            fetchProfile();
            // Sync local selected language with i18n
            const lang = LANGUAGES.find(l => l.value === i18n.language);
            if (lang) setSelectedLanguage(lang);
        });
        return unsubscribe;
    }, [navigation, i18n.language]);

    const fetchProfile = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) setLoading(true);
            const response = await api.get('/auth/me'); // Use generic profile endpoint which now supports pilgrims
            setProfile(response.data);
            if (response.data.email) {
                setNewEmail(response.data.email);
            }
            // If backend has a different language, we could sync it, but usually user preference on device overrides or we sync on change.
            // For now, we trust the device's current i18n setting or update it if we want backend to be master.
            // Let's keep device setting as master for now.
        } catch (error) {
            console.error('Fetch profile error:', error);
            if (!options?.silent) showToast(t('failed_load_profile'), 'error');
        } finally {
            if (!options?.silent) setLoading(false);
        }
    };

    useEffect(() => {
        if (!isFocused) return;
        const interval = setInterval(() => fetchProfile({ silent: true }), 20000);
        return () => clearInterval(interval);
    }, [isFocused]);

    const isApproved = profile?.role === 'moderator' || profile?.moderator_request_status === 'approved';
    const isPending = profile?.pending_moderator_request || profile?.moderator_request_status === 'pending';
    const isRejected = profile?.moderator_request_status === 'rejected';

    const handleLanguageChange = async (lang: LanguageOption) => {
        setSelectedLanguage(lang);
        await changeLanguage(lang.value);
        setShowLangPicker(false);
        // Optionally update backend
        try {
            await api.put('/auth/update-language', { language: lang.value });
        } catch (e) {
            console.log('Failed to update language on backend', e);
        }
    };

    const handleUpdateEmail = async () => {
        if (!newEmail || !newEmail.includes('@')) {
            showToast(t('valid_email_required'), 'error');
            return;
        }

        setUpdatingEmail(true);
        try {
            await api.post('/auth/add-email', { email: newEmail });
            showToast(t('email_added_verifying'), 'success');

            // Now send verification code
            await api.post('/auth/send-email-verification');
            showToast(t('verification_code_sent'), 'success');
            setShowEmailInput(false);

            // Navigate to verify
            navigation.navigate('VerifyEmail', { email: newEmail, isPilgrim: true });
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_update_email'), 'error');
        } finally {
            setUpdatingEmail(false);
        }
    };

    const handleRequestModerator = async () => {
        if (!profile?.email_verified) {
            Alert.alert(
                t('email_verification_required'),
                t('email_verification_msg'),
                [
                    { text: t('cancel'), style: 'cancel' },
                    {
                        text: t('verify_now'), onPress: () => {
                            if (profile?.email) {
                                api.post('/auth/send-email-verification')
                                    .then(() => {
                                        showToast(t('verification_code_sent'), 'success', { title: t('code_sent') });
                                        navigation.navigate('VerifyEmail', {
                                            email: profile.email!,
                                            isPilgrim: true,
                                            postVerifyAction: 'request-moderator'
                                        });
                                    })
                                    .catch((error: any) => {
                                        showToast(error.response?.data?.message || t('failed_send_code'), 'error');
                                    });
                            } else {
                                showToast(t('add_email_to_continue'), 'info', { title: t('email_needed') });
                                setShowEmailInput(true);
                            }
                        }
                    }
                ]
            );
            return;
        }

        if (isApproved || isPending) {
            return;
        }

        Alert.alert(
            t('request_moderator_access'),
            t('request_moderator_msg'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('request'),
                    onPress: async () => {
                        try {
                            await api.post('/auth/request-moderator');
                            showToast(t('request_submitted'), 'success', { title: t('request_sent') });
                            setProfile(prev => prev ? { ...prev, pending_moderator_request: true, moderator_request_status: 'pending' } : prev);
                        } catch (error: any) {
                            const message = error.response?.data?.message || t('failed_submit_request');
                            if (message.toLowerCase().includes('pending')) return;
                            showToast(message, 'error');
                        }
                    }
                }
            ]
        );
    };

    const handleLogout = async () => {
        Alert.alert(
            t('logout'),
            t('logout_confirmation'),
            [
                { text: t('cancel'), style: 'cancel' },
                {

                    text: t('logout'),
                    style: 'destructive',
                    onPress: async () => {
                        socketService.disconnect();
                        await logout();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    const renderPickerModal = () => {
        if (!showLangPicker) return null;

        return (
            <Modal visible={true} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangPicker(false)}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('select_option')}</Text>
                            <TouchableOpacity onPress={() => setShowLangPicker(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <FlatList
                            data={LANGUAGES}
                            keyExtractor={(item) => item.value}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={[styles.pickerItem, (i18n.language === 'ar' || i18n.language === 'ur') && { flexDirection: 'row-reverse' }]} onPress={() => handleLanguageChange(item)}>
                                    <Text style={styles.pickerItemText}>{item.flag}  {item.label}</Text>
                                    {selectedLanguage.value === item.value && (
                                        <Ionicons name="checkmark" size={20} color="#007AFF" />
                                    )}
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.backgroundOrbOne} />
            <View style={styles.backgroundOrbTwo} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={i18n.language === 'ar' || i18n.language === 'ur' ? "arrow-forward" : "arrow-back"} size={28} color="#1F2A44" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('profile')}</Text>
                <TouchableOpacity onPress={() => navigation.navigate('EditProfile')} style={styles.editButton}>
                    <Text style={styles.editButtonText}>{t('edit')}</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Animated.View style={[styles.animatedWrap, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }]}>
                    <View style={styles.profileHeader}>
                        <View style={styles.avatarLarge}>
                            <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'P'}</Text>
                        </View>
                        <Text style={styles.name}>{profile?.full_name}</Text>
                        <Text style={styles.role}>{t('pilgrim')}</Text>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('personal_information')}</Text>
                        <View style={styles.card}>
                            <InfoRow label={t('phone_number')} value={profile?.phone_number} />
                            <InfoRow label={t('national_id')} value={profile?.national_id || t('not_available_short')} />
                            <InfoRow label={t('age')} value={profile?.age?.toString()} />
                            <InfoRow label={t('gender')} value={profile?.gender ? t(profile.gender.toLowerCase()) : undefined} />

                            {/* Email Section */}
                            <View style={styles.emailRow}>
                                <View style={styles.emailTextWrap}>
                                    <Text style={styles.label}>{t('email')}</Text>
                                    <Text style={styles.value}>{profile?.email || t('not_set')}</Text>
                                </View>
                                {profile?.email_verified ? (
                                    <View style={styles.verifiedBadge}>
                                        <Text style={styles.verifiedText}>{t('verified')}</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity onPress={() => setShowEmailInput(!showEmailInput)}>
                                        <Text style={styles.addEmailText}>{profile?.email ? t('verify') : t('add_email')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Email Input for update */}
                            {showEmailInput && !profile?.email_verified && (
                                <View style={styles.emailInputContainer}>
                                    <TextInput
                                        style={styles.emailInput}
                                        placeholder={t('enter_your_email')}
                                        value={newEmail}
                                        onChangeText={setNewEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                    <TouchableOpacity
                                        style={styles.updateButton}
                                        onPress={handleUpdateEmail}
                                        disabled={updatingEmail}
                                    >
                                        {updatingEmail ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.updateButtonText}>{t('send_code')}</Text>}
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Language Switcher Row */}
                            <TouchableOpacity style={styles.infoRow} onPress={() => setShowLangPicker(true)}>
                                <Text style={styles.label}>{t('language')}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.value}>{selectedLanguage.flag} {selectedLanguage.label}</Text>
                                    <Ionicons name="chevron-down" size={16} color="#6B7280" />
                                </View>
                            </TouchableOpacity>

                        </View>
                    </View>

                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>{t('medical_information')}</Text>
                        <View style={styles.card}>
                            <Text style={styles.medicalText}>
                                {profile?.medical_history || t('no_medical_history_recorded')}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.actionButton, (isPending || isApproved) && styles.actionButtonDisabled]}
                        onPress={() => handleRequestModerator()}
                        disabled={Boolean(isPending || isApproved)}
                    >
                        <Text style={[styles.actionButtonText, (isPending || isApproved) && styles.actionButtonTextDisabled]}>
                            {isApproved ? t('approved') : isPending ? t('request_pending') : isRejected ? t('request_again') : t('request_to_be_moderator')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                        <Text style={styles.logoutText}>{t('logout')}</Text>
                    </TouchableOpacity>
                </Animated.View>
            </ScrollView>

            {renderPickerModal()}
        </SafeAreaView>
    );
}

const InfoRow = ({ label, value, last, isRTL }: { label: string, value?: string, last?: boolean, isRTL?: boolean }) => (
    <View style={[styles.infoRow, last && styles.noBorder]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    backgroundOrbOne: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#E8EEFF',
        opacity: 0.6,
    },
    backgroundOrbTwo: {
        position: 'absolute',
        top: 140,
        left: -80,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#EAF7F2',
        opacity: 0.7,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 14,
        backgroundColor: '#F6F7FB',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    backButtonText: {
        fontSize: 22,
        color: '#1F2A44',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2A44',
    },
    editButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    editButtonText: {
        fontSize: 15,
        color: '#1F6FEB',
        fontWeight: '700',
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 40,
    },
    animatedWrap: {
        gap: 12,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatarLarge: {
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: '#E7EEFF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        borderWidth: 3,
        borderColor: '#F6F7FB',
        shadowColor: '#1F2A44',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 16,
        elevation: 5,
    },
    avatarText: {
        fontSize: 34,
        fontWeight: '700',
        color: '#1F6FEB',
    },
    name: {
        fontSize: 22,
        fontWeight: '700',
        color: '#1F2A44',
        marginBottom: 6,
    },
    role: {
        fontSize: 13,
        color: '#4B5563',
        backgroundColor: '#EDEFF6',
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 999,
        overflow: 'hidden',
    },
    section: {
        marginBottom: 18,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7B8191',
        marginBottom: 10,
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 16,
        shadowColor: '#1F2A44',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EDF0F6',
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F2F6',
        alignItems: 'center',
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    label: {
        fontSize: 14,
        color: '#6B7280',
    },
    value: {
        fontSize: 15,
        fontWeight: '600',
        color: '#1F2A44',
    },
    medicalText: {
        fontSize: 15,
        color: '#1F2A44',
        lineHeight: 22,
    },
    logoutButton: {
        backgroundColor: '#FFE9EA',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 24,
    },
    logoutText: {
        color: '#E11D48',
        fontSize: 15,
        fontWeight: '700',
    },
    actionButton: {
        backgroundColor: '#1F6FEB',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 6,
        marginBottom: 10,
        shadowColor: '#1F6FEB',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 18,
        elevation: 4,
    },
    actionButtonText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '700',
    },
    actionButtonDisabled: {
        backgroundColor: '#E7ECF6',
        borderColor: '#D0D5DD',
        shadowOpacity: 0,
    },
    actionButtonTextDisabled: {
        color: '#98A2B3',
    },
    emailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F2F6',
    },
    emailTextWrap: {
        flex: 1,
        marginRight: 10,
    },
    verifiedBadge: {
        backgroundColor: '#E8F5EE',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        alignSelf: 'flex-start',
    },
    verifiedText: {
        color: '#16A34A',
        fontSize: 12,
        fontWeight: '700',
    },
    addEmailText: {
        color: '#1F6FEB',
        fontSize: 13,
        fontWeight: '700',
    },
    emailInputContainer: {
        marginTop: 10,
        flexDirection: 'row',
        alignItems: 'center',
    },
    emailInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#E1E6F0',
        borderRadius: 10,
        padding: 10,
        marginRight: 10,
        backgroundColor: '#F9FAFC',
        fontSize: 14,
    },
    updateButton: {
        backgroundColor: '#1F6FEB',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
    },
    updateButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 13,
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
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerItemText: {
        fontSize: 18,
        color: '#333',
    },
});
