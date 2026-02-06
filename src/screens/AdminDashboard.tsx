import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import Ionicons from '@expo/vector-icons/Ionicons';
import { api } from '../services/api';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminDashboard'>;

type ModeratorRequest = {
    _id: string;
    user_id: {
        _id: string;
        full_name: string;
        email: string;
        phone_number: string;
    };
    status: 'pending' | 'approved' | 'rejected';
    created_at: string;
};

const AdminDashboard: React.FC<Props> = ({ navigation }) => {
    const [requests, setRequests] = useState<ModeratorRequest[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRequests = async () => {
        try {
            setLoading(true);
            const response = await api.get('/admin/requests');
            setRequests(response.data);
        } catch (error: any) {
            Alert.alert('Error', error.response?.data?.message || 'Failed to fetch requests');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    const handleApprove = async (requestId: string, userName: string) => {
        Alert.alert(
            'Approve Request',
            `Are you sure you want to approve ${userName} as a moderator?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Approve',
                    onPress: async () => {
                        try {
                            await api.put(`/admin/requests/${requestId}/approve`);
                            Alert.alert('Success', 'User promoted to moderator');
                            fetchRequests();
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.message || 'Failed to approve request');
                        }
                    }
                }
            ]
        );
    };

    const handleReject = async (requestId: string, userName: string) => {
        Alert.alert(
            'Reject Request',
            `Are you sure you want to reject ${userName}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reject',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.put(`/admin/requests/${requestId}/reject`);
                            Alert.alert('Success', 'Request rejected');
                            fetchRequests();
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.message || 'Failed to reject request');
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: ModeratorRequest }) => (
        <View style={styles.card}>
            <View style={styles.cardInfo}>
                <Text style={styles.name}>{item.user_id.full_name}</Text>
                <Text style={styles.email}>{item.user_id.email}</Text>
                <Text style={styles.phone}>{item.user_id.phone_number}</Text>
                <Text style={styles.date}>Requested: {new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.actions}>
                <TouchableOpacity onPress={() => handleApprove(item._id, item.user_id.full_name)} style={styles.approveBtn}>
                    <Ionicons name="checkmark-circle" size={24} color="green" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleReject(item._id, item.user_id.full_name)} style={styles.rejectBtn}>
                    <Ionicons name="close-circle" size={24} color="red" />
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Admin Dashboard</Text>
                <TouchableOpacity onPress={fetchRequests}>
                    <Ionicons name="refresh" size={24} color="#007AFF" />
                </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>Pending Moderator Requests</Text>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : (
                <FlatList
                    data={requests}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    ListEmptyComponent={<Text style={styles.emptyText}>No pending requests</Text>}
                    contentContainerStyle={styles.list}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
        padding: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    subtitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4B5563',
        marginBottom: 10,
    },
    list: {
        paddingBottom: 20,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    cardInfo: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#111827',
    },
    email: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    phone: {
        fontSize: 14,
        color: '#6B7280',
    },
    date: {
        fontSize: 12,
        color: '#9CA3AF',
        marginTop: 4,
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
        marginLeft: 10,
    },
    approveBtn: {
        padding: 4,
    },
    rejectBtn: {
        padding: 4,
    },
    loader: {
        marginTop: 20,
    },
    emptyText: {
        textAlign: 'center',
        color: '#9CA3AF',
        marginTop: 20,
        fontSize: 16,
    },
});

export default AdminDashboard;
