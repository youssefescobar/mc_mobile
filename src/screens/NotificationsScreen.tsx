import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { useToast } from '../components/ToastContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';

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
    const { t, i18n } = useTranslation();
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
            showToast(t('failed_load_notifications'), 'error');
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
            showToast(t('invitation_accepted'), 'success');
            fetchData(); // Refresh data
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_accept_invite'), 'error');
        }
    };

    const handleDeclineInvite = async (invitationId: string) => {
        try {
            await api.post(`/invitations/${invitationId}/decline`);
            showToast(t('invitation_declined'), 'info');
            fetchData(); // Refresh data
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_decline_invite'), 'error');
        }
    };

    const handleDeleteNotification = async (notificationId: string) => {
        try {
            await api.delete(`/notifications/${notificationId}`);
            setNotifications(prev => prev.filter(n => n._id !== notificationId));
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_delete_notif'), 'error');
        }
    };

    const handleClearRead = async () => {
        try {
            await api.delete('/notifications/read');
            setNotifications(prev => prev.filter(n => !n.read));
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_clear_notif'), 'error');
        }
    };

    const renderInvitation = ({ item }: { item: Invitation }) => (
        <View style={styles.card}>
            <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="mail-unread-outline" size={16} color="#666" />
                    <Text style={styles.cardType}>{t('group_invitation')}</Text>
                </View>
                <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <Text style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('join')} "{item.group_id.group_name}"</Text>
            <Text style={[styles.cardMessage, { textAlign: isRTL ? 'right' : 'left' }]}>
                {t('invited_by')} <Text style={{ fontWeight: 'bold' }}>{item.inviter_id.full_name}</Text>
            </Text>

            <View style={[styles.actionButtons, { flexDirection: isRTL ? 'row-reverse' : 'row', justifyContent: isRTL ? 'flex-start' : 'flex-end' }]}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.declineButton]}
                    onPress={() => handleDeclineInvite(item._id)}
                >
                    <Text style={styles.declineText}>{t('decline')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.acceptButton]}
                    onPress={() => handleAcceptInvite(item._id)}
                >
                    <Text style={styles.acceptText}>{t('accept')}</Text>
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
            const groupName = item.data?.group_name || t('default_group_name');
            const pilgrimId = item.data?.pilgrim_id;
            if (groupId && pilgrimId) {
                navigation.navigate('GroupDetails', {
                    groupId,
                    groupName,
                    focusPilgrimId: pilgrimId,
                    openProfile: true
                });
            } else {
                showToast(t('missing_sos_details'), 'error');
            }
        };

        const getTypeLabel = (type: string) => {
            switch (type) {
                case 'moderator_removed': return t('removed');
                case 'sos_alert': return t('sos_alert');
                case 'moderator_request_approved': return t('request_approved');
                case 'moderator_request_rejected': return t('request_rejected');
                case 'invitation_accepted': return t('accepted');
                default: return t('notification');
            }
        };

        return (
            <TouchableOpacity
                style={[
                    styles.card,
                    !item.read && styles.unreadCard,
                    (!item.read && isRTL) && { borderLeftWidth: 0, borderRightWidth: 4, borderRightColor: '#007AFF' }
                ]}
                onPress={handlePress}
                activeOpacity={isSos ? 0.85 : 1}
                disabled={!isSos}
            >
                <View style={[styles.cardHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name={iconName as any} size={16} color={iconColor} />
                        <Text style={styles.cardType}>
                            {getTypeLabel(item.type)}
                        </Text>
                    </View>
                    <View style={[styles.cardHeaderRight, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
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
                <Text style={[styles.cardTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{item.title}</Text>
                <Text style={[styles.cardMessage, { textAlign: isRTL ? 'right' : 'left' }]}>{item.message}</Text>
            </TouchableOpacity>
        );
    };

    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.headerSafeArea}>
                <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#007AFF" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('notifications')}</Text>
                    <TouchableOpacity onPress={handleClearRead} style={styles.clearButton}>
                        <Text style={styles.clearButtonText}>{t('clear_viewed')}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
            ) : (
                <View style={styles.listContainer}>
                    {invitations.length > 0 && (
                        <View>
                            <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('pending_invitations')}</Text>
                            <FlatList
                                data={invitations}
                                renderItem={renderInvitation}
                                keyExtractor={item => item._id}
                                scrollEnabled={false}
                            />
                        </View>
                    )}

                    <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{t('recent_notifications')}</Text>
                    <FlatList
                        data={notifications}
                        renderItem={renderNotification}
                        keyExtractor={item => item._id}
                        ListEmptyComponent={<Text style={styles.emptyText}>{t('no_new_notifications')}</Text>}
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
