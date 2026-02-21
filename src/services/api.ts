import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Default to the railway production url if not provided in .env
export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://mcbackendapp-production.up.railway.app/api';

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    timeout: 15000, // 15 seconds timeout
});

api.interceptors.request.use(request => {
    console.log('[API Request]', request.method?.toUpperCase(), request.url);
    return request;
});

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};

export const clearAuthToken = () => setAuthToken(null);

export const logout = async () => {
    try {
        await api.post('/auth/logout');
    } catch (error) {
        console.error('Logout failed on server', error);
    } finally {
        await AsyncStorage.multiRemove(['token', 'user_role', 'user_id', 'full_name']);
        clearAuthToken();
    }
};

export const updateFCMToken = async (token: string) => {
    try {
        await api.put('/auth/fcm-token', { fcm_token: token });
        console.log('FCM Token updated successfully');
    } catch (error) {
        console.error('Failed to update FCM token', error);
    }
};
