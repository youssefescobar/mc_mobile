import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ToastContext';
import { useTranslation } from 'react-i18next';


type PilgrimSignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PilgrimSignUp'>;

export default function PilgrimSignUpScreen() {
    const navigation = useNavigation<PilgrimSignUpScreenNavigationProp>();
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();

    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const handleRegister = async () => {
        const cleanFullName = fullName.trim();
        const cleanNationalId = nationalId.trim();
        const cleanPhoneNumber = phoneNumber.trim();
        const cleanPassword = password.trim();
        const cleanConfirmPassword = confirmPassword.trim();

        if (!cleanFullName || !cleanNationalId || !cleanPhoneNumber || !cleanPassword || !cleanConfirmPassword) {
            showToast(t('please_fill_all_fields'), 'error');
            return;
        }

        if (cleanPassword !== cleanConfirmPassword) {
            showToast(t('passwords_dont_match'), 'error');
            return;
        }

        if (cleanPassword.length < 6) {
            showToast(t('password_too_short'), 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register', {
                full_name: cleanFullName,
                national_id: cleanNationalId,
                phone_number: cleanPhoneNumber,
                password: cleanPassword
            });

            const { token: jwtToken, role, full_name, user_id } = response.data;

            // Save auth data
            await AsyncStorage.setItem('token', jwtToken);
            await AsyncStorage.setItem('role', role);
            await AsyncStorage.setItem('full_name', full_name);
            await AsyncStorage.setItem('user_id', user_id);
            setAuthToken(jwtToken);

            showToast(t('registration_successful'), 'success');
            navigation.replace('PilgrimDashboard', { userId: user_id });

        } catch (error: any) {
            // Handle structured validation errors
            if (error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const firstError = Object.values(errors)[0] as string;
                showToast(firstError, 'error', { title: 'Registration Failed' });
            } else {
                const errorMessage = error.response?.data?.message || t('registration_failed');
                showToast(errorMessage, 'error');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.header}>
                    <Ionicons name="people-circle-outline" size={80} color="#2563eb" />
                    <Text style={styles.title}>{t('pilgrim_registration')}</Text>
                    <Text style={styles.subtitle}>{t('signup_national_id_subtitle')}</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t('full_name')}
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="card-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t('national_id_passport_placeholder')}
                            value={nationalId}
                            onChangeText={setNationalId}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="call-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t('mobile_number_placeholder')}
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            keyboardType="phone-pad"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t('password_placeholder')}
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry={!showPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder={t('confirm_password_placeholder')}
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry={!showPassword}
                        />
                    </View>

                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleRegister}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>{t('register')}</Text>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => navigation.navigate('Login')} style={{ alignItems: 'center', marginTop: 20 }}>
                        <Text style={{ color: '#666' }}>
                            {t('already_have_account')} <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>{t('login')}</Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 30,
        marginTop: 20
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1e3a8a',
        marginTop: 16,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#64748b',
    },
    form: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 12,
        height: 56,
        backgroundColor: '#f8fafc',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#1e293b',
    },
    eyeIcon: {
        padding: 4,
    },
    button: {
        backgroundColor: '#2563eb',
        height: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 8,
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#93c5fd',
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
