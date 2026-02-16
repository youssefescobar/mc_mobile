import axios from 'axios';
import { Platform } from 'react-native';

// Replace with your computer's LAN IP if running on physical device
// For Android Emulator, use 'http://10.0.2.2:5000'
// For iOS Simulator, use 'http://localhost:5000'
// For iOS Simulator, use 'http://localhost:5000'
export const BASE_URL = 'http://192.168.1.14:5000/api';

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
