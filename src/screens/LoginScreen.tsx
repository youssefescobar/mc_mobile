import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, Image, KeyboardAvoidingView, Platform, Dimensions, Keyboard, TouchableWithoutFeedback, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }: Props) {
    const { t, i18n } = useTranslation();
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleLogin = async () => {
        if (!identifier || !password) {
            showToast(t('fill_required'), 'error', { title: t('missing_fields') });
            return;
        }

        setLoading(true);
        try {
            console.log('Attempting login with:', identifier);
            const response = await api.post('/auth/login', { identifier, password });

            const { token, role, user_id } = response.data;

            console.log('Login successful:', role);
            setAuthToken(token);

            // Navigate based on role
            if (role === 'moderator') {
                navigation.replace('ModeratorDashboard', { userId: user_id });
            } else {
                navigation.replace('PilgrimDashboard', { userId: user_id });
            }
        } catch (error: any) {
            console.error('Login Error:', error);
            showToast(error.response?.data?.message || t('invalid_credentials'), 'error', { title: t('login_failed') });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                        <View>
                            <View style={styles.headerContainer}>
                                <Image
                                    source={require('../../assets/logo.jpeg')}
                                    style={styles.logo}
                                    resizeMode="contain"
                                />
                                <Text style={styles.appName}>Munawwara Care</Text>
                                <Text style={styles.welcomeText}>{t('welcome')}</Text>
                                <Text style={styles.subText}>{t('sign_in_subtitle')}</Text>
                            </View>

                            <View style={styles.formContainer}>
                                <View style={styles.inputWrapper}>
                                    <Text style={styles.label}>{t('email_placeholder')}</Text>
                                    <TextInput
                                        style={[styles.input, { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' }]}
                                        placeholder={t('email_placeholder')}
                                        placeholderTextColor="#999"
                                        value={identifier}
                                        onChangeText={setIdentifier}
                                        autoCapitalize="none"
                                    />
                                </View>

                                <View style={styles.inputWrapper}>
                                    <Text style={styles.label}>{t('password_placeholder')}</Text>
                                    <TextInput
                                        style={[styles.input, { textAlign: i18n.language === 'ar' || i18n.language === 'ur' ? 'right' : 'left' }]}
                                        placeholder="••••••••"
                                        placeholderTextColor="#999"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                    />
                                </View>

                                <TouchableOpacity
                                    style={[styles.loginButton, loading && styles.buttonDisabled]}
                                    onPress={handleLogin}
                                    disabled={loading}
                                >
                                    <Text style={styles.loginButtonText}>{loading ? t('signing_in') : t('sign_in')}</Text>
                                </TouchableOpacity>

                                <View style={styles.divider}>
                                    <View style={styles.line} />
                                    <Text style={styles.dividerText}>{t('or_continue_with')}</Text>
                                    <View style={styles.line} />
                                </View>

                                <TouchableOpacity
                                    style={[styles.googleButton, i18n.language === 'ar' || i18n.language === 'ur' ? { flexDirection: 'row-reverse' } : null]}
                                    onPress={() => showToast(t('google_signin_coming_soon'), 'info', { title: t('coming_soon') })}
                                >
                                    <Text style={[styles.googleButtonText, i18n.language === 'ar' || i18n.language === 'ur' ? { marginRight: 0, marginLeft: 10 } : null]}>G</Text>
                                    <Text style={styles.googleText}>{t('sign_in_google')}</Text>
                                </TouchableOpacity>

                                <View style={styles.footer}>
                                    <Text style={styles.footerText}>{t('dont_have_account')} </Text>
                                    <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
                                        <Text style={styles.signUpText}>{t('sign_up')}</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                            <View style={{ height: 30 }} />
                        </View>
                    </TouchableWithoutFeedback>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 40,
        marginTop: 60,
    },
    logo: {
        width: 100,
        height: 100,
        marginBottom: 10,
        borderRadius: 20,
    },
    appName: {
        fontSize: 22,
        fontWeight: '600',
        color: '#333',
        marginBottom: 5,
    },
    welcomeText: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 8,
    },
    subText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    formContainer: {
        width: '100%',
    },
    inputWrapper: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginLeft: 4,
    },
    input: {
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 14,
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
    loginButton: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginBottom: 20,
        marginTop: 10,
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
    loginButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#E1E1E1',
    },
    dividerText: {
        marginHorizontal: 10,
        color: '#999',
        fontSize: 14,
    },
    googleButton: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E1E1E1',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    googleButtonText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#EA4335',
        marginRight: 10,
    },
    googleText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        fontSize: 15,
        color: '#666',
    },
    signUpText: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#007AFF',
    },
});
