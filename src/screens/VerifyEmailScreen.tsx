import React, { useState, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Keyboard,
    TouchableWithoutFeedback,
    KeyboardAvoidingView,
    Platform,
    ScrollView
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
    const { t, i18n } = useTranslation();
    const { email, isPilgrim, postVerifyAction } = route.params as {
        email: string;
        isPilgrim?: boolean;
        postVerifyAction?: 'request-moderator';
    };
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [cooldown, setCooldown] = useState(0);
    const inputRef = useRef<TextInput>(null);
    const { showToast } = useToast();

    const handleVerify = async () => {
        if (!code || code.length !== 6) {
            showToast(t('enter_code_error'), 'error', { title: t('invalid_code') });
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/verify-email', { code });

            if (isPilgrim && postVerifyAction === 'request-moderator') {
                try {
                    await api.post('/auth/request-moderator');
                    showToast(t('moderator_request_submitted'), 'success', { title: t('request_sent') });
                } catch (error: any) {
                    const message = error.response?.data?.message || t('failed_submit_request'); // key might be missing, using fallback or existing logic
                    if (message.toLowerCase().includes('pending')) return;
                    showToast(message, 'error', { title: t('request_failed') });
                }
            }

            showToast(
                t('email_verified_success'),
                'success',
                {
                    title: t('verified_exclamation'),
                    actionLabel: isPilgrim ? t('done') : t('login'),
                    onAction: () => isPilgrim ? navigation.goBack() : navigation.replace('Login')
                }
            );

            if (isPilgrim) {
                setTimeout(() => navigation.goBack(), 1500);
            } else {
                setTimeout(() => navigation.replace('Login'), 2000);
            }
        } catch (error: any) {
            console.error('Verification Error:', error);
            showToast(error.response?.data?.message || t('invalid_code'), 'error', { title: t('verification_failed') });
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        if (cooldown > 0) return;

        setResending(true);
        try {
            if (isPilgrim) {
                await api.post('/auth/send-email-verification');
            } else {
                await api.post('/auth/resend-verification', { email });
            }
            showToast(t('new_code_sent'), 'success', { title: t('code_sent_exclamation') });

            // Start 60 second cooldown
            setCooldown(60);
            const interval = setInterval(() => {
                setCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } catch (error: any) {
            console.error('Resend Error:', error);
            showToast(error.response?.data?.message || t('failed_resend_code'), 'error', { title: t('error') });
        } finally {
            setResending(false);
        }
    };

    const renderCodeBoxes = () => {
        const boxes = [];
        for (let i = 0; i < 6; i++) {
            const digit = code[i] || '';
            const isFocused = i === code.length;
            boxes.push(
                <View key={i} style={[styles.codeBox, (isFocused || digit) && styles.codeBoxActive]}>
                    <Text style={styles.codeText}>{digit}</Text>
                </View>
            );
        }
        return boxes;
    };

    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';

    return (
        <View style={styles.container}>
            <KeyboardAvoidingView
                style={styles.container}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                    <ScrollView
                        contentContainerStyle={styles.content}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        <View style={[styles.topBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topButton}>
                                <Text style={styles.topButtonText}>{t('back')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleResend}
                                disabled={resending || cooldown > 0}
                                style={styles.topButton}
                            >
                                <Text style={[styles.topButtonText, (resending || cooldown > 0) && styles.topButtonDisabled]}>
                                    {resending ? t('sending') : cooldown > 0 ? t('resend_in', { seconds: cooldown }) : t('resend')}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={styles.innerContent}
                            activeOpacity={1}
                            onPress={() => inputRef.current?.focus()}
                        >
                            <View style={styles.headerContainer}>
                                <View style={styles.iconCircle}>
                                    <Text style={styles.iconText}>✉️</Text>
                                </View>
                                <Text style={styles.title}>{t('verify_email_title')}</Text>
                                <Text style={styles.subtitle}>
                                    {t('sent_code_to')}{"\n"}
                                    <Text style={styles.emailHighlight}>{email}</Text>
                                </Text>
                            </View>

                            <View style={[styles.codeContainer, { direction: 'ltr' }]}>
                                {/* Code input usually LTR even in RTL langs for numbers */}
                                {renderCodeBoxes()}
                            </View>

                            <TextInput
                                ref={inputRef}
                                style={styles.hiddenInput}
                                value={code}
                                onChangeText={(text) => {
                                    const numeric = text.replace(/[^0-9]/g, '');
                                    if (numeric.length <= 6) setCode(numeric);
                                    if (numeric.length === 6) Keyboard.dismiss();
                                }}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />

                            <TouchableOpacity
                                style={[styles.button, (code.length !== 6 || loading) && styles.buttonDisabled]}
                                onPress={handleVerify}
                                disabled={code.length !== 6 || loading}
                            >
                                <Text style={styles.buttonText}>{loading ? t('verifying') : t('verify_code_button')}</Text>
                            </TouchableOpacity>

                            {/* Resend Button */}
                            {!isPilgrim && (
                                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backButton}>
                                    <Text style={styles.backText}>{t('back_to_login')}</Text>
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    content: {
        flexGrow: 1,
        paddingBottom: 12,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    topButton: {
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    topButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    topButtonDisabled: {
        color: '#999',
    },
    innerContent: {
        flex: 1,
        padding: 16,
        paddingTop: 40,
        alignItems: 'center',
        justifyContent: 'flex-start',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconText: {
        fontSize: 32,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 10,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    emailHighlight: {
        color: '#007AFF',
        fontWeight: '600',
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        maxWidth: 340,
        marginBottom: 24,
    },
    codeBox: {
        width: 45,
        height: 55,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E1E1E1',
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    codeBoxActive: {
        borderColor: '#007AFF',
        borderWidth: 2,
        backgroundColor: '#F0F8FF',
    },
    codeText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
    },
    hiddenInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    button: {
        backgroundColor: '#007AFF',
        width: '100%',
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
        marginBottom: 20,
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
    backButton: {
        padding: 10,
    },
    backText: {
        color: '#666',
        fontSize: 15,
    },
});
