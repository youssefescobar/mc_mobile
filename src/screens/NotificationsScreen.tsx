import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { useToast } from '../components/ToastContext';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

interface Notification {
    _id: string;
    type: string;
    title: string;
    message: string;
    read: boolean;
    created_at: string;
    data?: any;
}

interface Invitation {
    _id: string;
    group_id: { _id: string, group_name: string };
    inviter_id: { full_name: string, email: string };
    status: string;
    created_at: string;
}

export default function NotificationsScreen({ navigation }: Props) {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [loading, setLoading] = useState(true);
    const { showToast } = useToast();

    const fetchData = async () => {
        try {
            setLoading(true);
            const [notifResponse, inviteResponse] = await Promise.all([
                api.get('/notifications'),
                api.get('/invitations')
            ]);

            if (notifResponse.data.success) {
                setNotifications(notifResponse.data.notifications);
            }
            if (inviteResponse.data.success) {
                setInvitations(inviteResponse.data.invitations);
            }

            // Mark all notifications as read when viewing the screen
            if (notifResponse.data.unread_count > 0) {
                await api.put('/notifications/read-all');
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            }
        } catch (error) {
            console.error('Error fetching notifications:', error);
            showToast('Failed to load notifications', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleAcceptInvite = async (invitationId: string) => {
        try {
            await api.post(`/invitations/${invitationId}/accept`);
            showToast('Invitation accepted!', 'success');
            fetchData(); // Refresh data
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to accept invitation', 'error');
        }
    };

    const handleDeclineInvite = async (invitationId: string) => {
        try {
            await api.post(`/invitations/${invitationId}/decline`);
            showToast('Invitation declined', 'info');
            fetchData(); // Refresh data
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to decline invitation', 'error');
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to delete notification', 'error');
        }
    };

    const handleClearRead = async () => {
        try {
            await api.delete('/notifications/read');
            setNotifications(prev => prev.filter(n => !n.read));
        } catch (error: any) {
            showToast(error.response?.data?.message || 'Failed to clear notifications', 'error');
        }
    };

    const renderInvitation = ({ item }: { item: Invitation }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="mail-unread-outline" size={16} color="#666" />
                    <Text style={styles.cardType}>Group Invitation</Text>
                </View>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={styles.cardTitle}>Join "{item.group_id.group_name}"</Text>
            <Text style={styles.cardMessage}>
                Invited by <Text style={{ fontWeight: 'bold' }}>{item.inviter_id.full_name}</Text>
            </Text>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleDeclineInvite(item._id)}
                >
                    <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAcceptInvite(item._id)}
                >
                    <Text style={styles.acceptText}>Accept</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderNotification = ({ item }: { item: Notification }) => {
        // Skip invitations in notification list if they are handled separately
        if (item.type === 'group_invitation') return null;

        let iconName = 'notifications-outline';
        let iconColor = '#666';

        if (item.type === 'moderator_removed') {
            iconName = 'warning-outline';
            iconColor = '#FF3B30';
        } else if (item.type === 'sos_alert') {
            iconName = 'alert-circle-outline';
            iconColor = '#EF4444';
        } else if (item.type === 'moderator_request_approved') {
            iconName = 'checkmark-circle-outline';
            iconColor = '#34C759';
        } else if (item.type === 'moderator_request_rejected') {
            iconName = 'close-circle-outline';
            iconColor = '#FF3B30';
        } else if (item.type === 'invitation_accepted') {
            iconName = 'checkmark-circle-outline';
            iconColor = '#34C759';
        }

        const isSos = item.type === 'sos_alert';
        const handlePress = () => {
            if (!isSos) return;
            const groupId = item.data?.group_id;
            const groupName = item.data?.group_name || 'Group';
            const pilgrimId = item.data?.pilgrim_id;
            if (groupId && pilgrimId) {
                navigation.navigate('GroupDetails', {
                    groupId,
                    groupName,
                    focusPilgrimId: pilgrimId,
                    openProfile: true
                });
            } else {
                showToast(`Missing SOS details (group: ${!!groupId}, pilgrim: ${!!pilgrimId})`, 'error');
            }
        };

        return (
            <TouchableOpacity
                style={[styles.card, !item.read && styles.unreadCard]}
                onPress={handlePress}
                activeOpacity={isSos ? 0.85 : 1}
                disabled={!isSos}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={iconName as any} size={16} color={iconColor} />
                        <Text style={styles.cardType}>
                            {item.type === 'moderator_removed' ? 'Removed' :
                                item.type === 'sos_alert' ? 'SOS Alert' :
                                    item.type === 'invitation_accepted' ? 'Accepted' :
                                        item.type === 'moderator_request_approved' ? 'Request Approved' :
                                            item.type === 'moderator_request_rejected' ? 'Request Rejected' :
                                                'Notification'}
                        </Text>
                    </View>
                    <View style={styles.cardHeaderRight}>
                        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        {item.read && (
                            <TouchableOpacity
                                style={styles.dismissButton}
                                onPress={() => handleDeleteNotification(item._id)}
                            >
                                <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardMessage}>{item.message}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Notifications</Text>
                    <TouchableOpacity onPress={handleClearRead} style={styles.clearButton}>
                        <Text style={styles.clearButtonText}>Clear Viewed</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
            ) : (
                <View style={styles.listContainer}>
                    {invitations.length > 0 && (
                        <View>
                            <Text style={styles.sectionTitle}>Pending Invitations</Text>
                            <FlatList
                                data={invitations}
                                renderItem={renderInvitation}
                                keyExtractor={item => item._id}
                                scrollEnabled={false}
                            />
                        </View>
                    )}

                    <Text style={styles.sectionTitle}>Recent Notifications</Text>
                    <FlatList
                        data={notifications}
                        renderItem={renderNotification}
                        keyExtractor={item => item._id}
                        ListEmptyComponent={<Text style={styles.emptyText}>No new notifications</Text>}
                        contentContainerStyle={{ paddingBottom: 20 }}
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    headerSafeArea: {
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingBottom: 15,
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    clearButton: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    clearButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#007AFF',
    },
    listContainer: {
        padding: 15,
        flex: 1,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
        marginTop: 10,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF',
    },
    cardHeaderRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dismissButton: {
        padding: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    cardType: {
        fontSize: 12,
        color: '#666',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    cardDate: {
        fontSize: 12,
        color: '#999',
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    cardMessage: {
        fontSize: 14,
        color: '#555',
        lineHeight: 20,
    },
    actionButtons: {
        flexDirection: 'row',
        marginTop: 15,
        justifyContent: 'flex-end',
        gap: 10,
    },
    actionButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    acceptButton: {
        backgroundColor: '#007AFF',
    },
    declineButton: {
        backgroundColor: '#f5f5f5',
        borderWidth: 1,
        borderColor: '#ddd',
    },
    acceptText: {
        color: 'white',
        fontWeight: '600',
    },
    declineText: {
        color: '#666',
        fontWeight: '600',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
        fontSize: 16,
    },
});
