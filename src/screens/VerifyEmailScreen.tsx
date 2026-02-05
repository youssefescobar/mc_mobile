import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, Alert, TouchableOpacity, Keyboard } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen({ route, navigation }: Props) {
    const { email } = route.params;
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<TextInput>(null);

    const handleVerify = async () => {
        if (!code || code.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter the full 6-digit code sent to your email.');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/verify-email', {
                email,
                code
            });

            Alert.alert(
                'Success!',
                'Your email has been verified. You can now sign in.',
                [
                    { text: 'Login Now', onPress: () => navigation.replace('Login') }
                ]
            );
        } catch (error: any) {
            console.error('Verification Error:', error);
            Alert.alert('Verification Failed', error.response?.data?.message || 'Invalid code');
        } finally {
            setLoading(false);
        }
    };

    // Render the 6 code boxes
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
            <TouchableOpacity
                style={styles.content}
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

                {/* Hidden Input for handling typing */}
                <TextInput
                    ref={inputRef}
                    style={styles.hiddenInput}
                    value={code}
                    onChangeText={(text) => {
                        // Only allow numbers and max 6 chars
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

                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.backButton}>
                    <Text style={styles.backText}>Back to Login</Text>
                </TouchableOpacity>

            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    content: {
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
        backgroundColor: '#E3F2FD', // Light blue bg
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
        borderColor: '#007AFF', // Highlight active or filled boxes
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
