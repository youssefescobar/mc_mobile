import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, clearAuthToken } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimProfile'>;

interface PilgrimProfile {
    _id: string;
    full_name: string;
    email?: string;
    phone_number?: string;
    national_id?: string;
    medical_history?: string;
    age?: number;
    gender?: string;
}

export default function PilgrimProfileScreen({ navigation, route }: Props) {
    const [profile, setProfile] = useState<PilgrimProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/pilgrim/profile');
            setProfile(response.data);
        } catch (error) {
            console.error('Fetch profile error:', error);
            showToast('Failed to load profile', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        Alert.alert(
            'Logout',
            'Are you sure you want to logout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        await clearAuthToken();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Profile</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.profileHeader}>
                    <View style={styles.avatarLarge}>
                        <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'P'}</Text>
                    </View>
                    <Text style={styles.name}>{profile?.full_name}</Text>
                    <Text style={styles.role}>Pilgrim</Text>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Personal Information</Text>
                    <View style={styles.card}>
                        <InfoRow label="Phone" value={profile?.phone_number} />
                        <InfoRow label="Email" value={profile?.email || 'N/A'} />
                        <InfoRow label="National ID" value={profile?.national_id || 'N/A'} />
                        <InfoRow label="Age" value={profile?.age?.toString()} />
                        <InfoRow label="Gender" value={profile?.gender} last />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Medical Information</Text>
                    <View style={styles.card}>
                        <Text style={styles.medicalText}>
                            {profile?.medical_history || 'No medical history recorded.'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity style={styles.actionButton} onPress={() => handleRequestModerator()}>
                    <Text style={styles.actionButtonText}>Request to be Moderator</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                    <Text style={styles.logoutText}>Log Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const handleRequestModerator = async () => {
    Alert.alert(
        'Request Moderator Access',
        'Do you want to request to become a moderator? An admin will review your request.',
        [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Request',
                onPress: async () => {
                    try {
                        await api.post('/admin/request-moderator');
                        Alert.alert('Success', 'Your request has been submitted.');
                    } catch (error: any) {
                        Alert.alert('Error', error.response?.data?.message || 'Failed to submit request');
                    }
                }
            }
        ]
    );
};

const InfoRow = ({ label, value, last }: { label: string, value?: string, last?: boolean }) => (
    <View style={[styles.infoRow, last && styles.noBorder]}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    backButtonText: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    scrollContent: {
        padding: 20,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarLarge: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 4,
        borderColor: 'white',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    avatarText: {
        fontSize: 40,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    role: {
        fontSize: 16,
        color: '#666',
        backgroundColor: '#E9ECEF',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
        overflow: 'hidden',
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#666',
        marginBottom: 8,
        marginLeft: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    noBorder: {
        borderBottomWidth: 0,
    },
    label: {
        fontSize: 15,
        color: '#666',
    },
    value: {
        fontSize: 15,
        fontWeight: '500',
        color: '#333',
    },
    medicalText: {
        fontSize: 15,
        color: '#333',
        lineHeight: 22,
    },
    logoutButton: {
        backgroundColor: '#FFE5E5',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 40,
    },
    logoutText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: 'bold',
    },
    actionButton: {
        backgroundColor: 'white',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        marginTop: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#007AFF',
    },
    actionButtonText: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
