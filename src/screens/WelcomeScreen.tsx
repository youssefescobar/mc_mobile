import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken, updateFCMToken } from '../services/api';
import { ActivityIndicator } from 'react-native';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

type WelcomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const { width } = Dimensions.get('window');

const WelcomeScreen = () => {
    const navigation = useNavigation<WelcomeScreenNavigationProp>();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.8)).current;
    const [isCheckingSession, setIsCheckingSession] = React.useState(true);

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 4,
                tension: 10,
                useNativeDriver: true,
            }),
        ]).start();

        const checkAuth = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (token) {
                    console.log('[Welcome] Token found, verifying...');
                    setAuthToken(token);
                    const response = await api.get('/auth/me');

                    if (response.data) {
                        const user = response.data;
                        console.log('[Welcome] Session valid for:', user.role);

                        // Update local storage with latest info
                        await AsyncStorage.setItem('role', user.role);
                        await AsyncStorage.setItem('user_id', user._id);
                        if (user.full_name) {
                            await AsyncStorage.setItem('full_name', user.full_name);
                        }

                        // Refresh FCM Token in background
                        registerForPushNotificationsAsync().then(fcmToken => {
                            if (fcmToken) {
                                updateFCMToken(fcmToken);
                            }
                        });

                        // Small delay to let splash animation play
                        setTimeout(() => {
                            if (user.role === 'pilgrim') {
                                navigation.replace('PilgrimDashboard', { userId: user._id });
                            } else {
                                navigation.replace('ModeratorDashboard', { userId: user._id });
                            }
                        }, 2000);
                        return;
                    }
                }
            } catch (error) {
                console.log('[Welcome] Session verification failed or no token:', error);
                // Clear potentially invalid token
                await AsyncStorage.multiRemove(['token', 'user_role', 'user_id', 'full_name']);
            } finally {
                setIsCheckingSession(false);
            }

            // If we're here, no valid session found. Go to Login after a delay.
            setTimeout(() => {
                navigation.replace('Login');
            }, 2500);
        };

        checkAuth();
    }, [fadeAnim, scaleAnim, navigation]);

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#ffffff', '#f0f0f0']}
                style={styles.gradient}
            >
                <Animated.View
                    style={[
                        styles.content,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: scaleAnim }],
                        },
                    ]}
                >
                    <View style={styles.logoContainer}>
                        <Image
                            source={require('../../assets/splash-screen.png')}
                            style={styles.logo}
                            resizeMode="contain"
                        />
                    </View>

                    <Text style={styles.title}>Munawwara Care</Text>
                    <Text style={styles.subtitle}>Compassionate Care for Pilgrims</Text>

                    {isCheckingSession && (
                        <View style={{ marginTop: 40 }}>
                            <ActivityIndicator size="small" color="#2563eb" />
                        </View>
                    )}
                </Animated.View>

                <View style={styles.footer}>
                    <Text style={styles.version}>v1.0.0</Text>
                </View>
            </LinearGradient>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    gradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    logoContainer: {
        width: width * 0.6,
        height: width * 0.6,
        backgroundColor: '#fff',
        borderRadius: 40, // Rounded square
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 40,
        overflow: 'hidden',
    },
    logo: {
        width: '80%',
        height: '80%',
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
    footer: {
        position: 'absolute',
        bottom: 40,
    },
    version: {
        color: '#999',
        fontSize: 12,
    }
});

export default WelcomeScreen;
