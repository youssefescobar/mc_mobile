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

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
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
            showToast('Please enter the full 6-digit code sent to your email.', 'error', { title: 'Invalid Code' });
            return;
        }

        setLoading(true);
        try {
            await api.post('/auth/verify-email', { code });

            if (isPilgrim && postVerifyAction === 'request-moderator') {
                try {
                    await api.post('/auth/request-moderator');
                    showToast('Moderator request submitted for review.', 'success', { title: 'Request Sent' });
                } catch (error: any) {
                    const message = error.response?.data?.message || 'Failed to submit moderator request';
                    if (message.toLowerCase().includes('pending')) return;
                    showToast(message, 'error', { title: 'Request Failed' });
                }
            }

            showToast(
                'Your email has been verified.',
                'success',
                {
                    title: 'Verified!',
                    actionLabel: isPilgrim ? 'Done' : 'Login',
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
            showToast(error.response?.data?.message || 'Invalid code', 'error', { title: 'Verification Failed' });
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
            showToast('A new verification code has been sent to your email.', 'success', { title: 'Code Sent!' });

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
            showToast(error.response?.data?.message || 'Failed to resend code', 'error', { title: 'Error' });
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

    return (
        <SafeAreaView style={styles.container}>
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
                        <View style={styles.topBar}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topButton}>
                                <Text style={styles.topButtonText}>Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleResend}
                                disabled={resending || cooldown > 0}
                                style={styles.topButton}
                            >
                                <Text style={[styles.topButtonText, (resending || cooldown > 0) && styles.topButtonDisabled]}>
                                    {resending ? "Sending..." : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
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
                                <Text style={styles.title}>Verify Email</Text>
                                <Text style={styles.subtitle}>
                                    We sent a code to{"\n"}
                                    <Text style={styles.emailHighlight}>{email}</Text>
                                </Text>
                            </View>

                            <View style={styles.codeContainer}>
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
                                <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify Code"}</Text>
                            </TouchableOpacity>

                            {/* Resend Button */}
                            {!isPilgrim && (
                                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backButton}>
                                    <Text style={styles.backText}>Back to Login</Text>
                                </TouchableOpacity>
                            )}
                        </TouchableOpacity>
                    </ScrollView>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    content: {
        flexGrow: 1,
        paddingBottom: 24,
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
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerContainer: {
        alignItems: 'center',
        marginBottom: 40,
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
        marginBottom: 40,
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
