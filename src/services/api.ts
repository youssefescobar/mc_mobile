import axios from 'axios';
import { Platform } from 'react-native';

// Replace with your computer's LAN IP if running on physical device
// For Android Emulator, use 'http://10.0.2.2:5000'
// For iOS Simulator, use 'http://localhost:5000'
const BASE_URL = 'http://192.168.1.7:5000/api';

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

export const setAuthToken = (token: string | null) => {
    if (token) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete api.defaults.headers.common['Authorization'];
    }
};
