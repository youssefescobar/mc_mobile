import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, SafeAreaView } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ToastContext';

type PilgrimSignUpScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'PilgrimSignUp'>;
type PilgrimSignUpScreenRouteProp = RouteProp<RootStackParamList, 'PilgrimSignUp'>;

export default function PilgrimSignUpScreen() {
    const navigation = useNavigation<PilgrimSignUpScreenNavigationProp>();
    const route = useRoute<PilgrimSignUpScreenRouteProp>();
    const { token } = route.params;
    const { showToast } = useToast();

    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false); // Toggle for password visibility

    const handleRegister = async () => {
        if (!fullName || !password || !confirmPassword) {
            showToast('Please fill in all fields', 'error');
            return;
        }

        if (password !== confirmPassword) {
            showToast('Passwords do not match', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/auth/register-invited-pilgrim', {
                full_name: fullName,
                password,
                token
            });

            const { token: jwtToken, role, full_name, user_id } = response.data;

            // Save auth data
            await AsyncStorage.setItem('token', jwtToken);
            await AsyncStorage.setItem('role', role);
            await AsyncStorage.setItem('full_name', full_name);
            await AsyncStorage.setItem('user_id', user_id);
            setAuthToken(jwtToken);

            showToast('Registration Successful!', 'success');
            navigation.replace('PilgrimDashboard', { userId: user_id });

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Registration failed';
            showToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Ionicons name="people-circle-outline" size={80} color="#2563eb" />
                    <Text style={styles.title}>Pilgrim Registration</Text>
                    <Text style={styles.subtitle}>Complete your account setup</Text>
                </View>

                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Full Name"
                            value={fullName}
                            onChangeText={setFullName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
                        <TextInput
                            style={styles.input}
                            placeholder="Password"
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
                            placeholder="Confirm Password"
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
                            <Text style={styles.buttonText}>Complete Registration</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
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
