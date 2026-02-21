import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import CallTypeModal from '../components/CallTypeModal';
import { useCall } from '../context/CallContext';
import { useIsRTL } from '../hooks/useIsRTL';

interface CallRecord {
    _id: string;
    caller_id: { _id: string; full_name: string; role: string };
    receiver_id: { _id: string; full_name: string; role: string };
    call_type: 'internet' | 'phone';
    status: 'ringing' | 'in-progress' | 'completed' | 'missed' | 'declined' | 'unreachable';
    duration: number;
    createdAt: string;
}

export default function CallHistoryScreen() {
    const { startCall } = useCall();
    const navigation = useNavigation();
    const { t } = useTranslation();
    const isRTL = useIsRTL();
    const [calls, setCalls] = useState<CallRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const getUserId = async () => {
            const id = await AsyncStorage.getItem('user_id');
            setUserId(id);
        };
        getUserId();
    }, []);

    const fetchCallHistory = async () => {
        try {
            const response = await api.get('/call-history');
            setCalls(response.data);
        } catch (error) {
            console.error('Error fetching call history:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const markCallsAsRead = async () => {
        try {
            await api.put('/call-history/mark-read');
        } catch (error) {
            console.error('Failed to mark calls as read', error);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchCallHistory();
            markCallsAsRead();
        }
    }, [userId]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchCallHistory();
        markCallsAsRead();
    };

    const getCallIcon = (call: CallRecord) => {
        const callerId = call.caller_id?._id;
        const isOutgoing = callerId === userId;
        const iconName = 'call-outline';
        const color = call.status === 'completed' ? '#4CAF50' :
            call.status === 'declined' ? '#F44336' :
                call.status === 'missed' ? '#FF9800' : '#9E9E9E';
        return { iconName, color };
    };

    const formatDuration = (seconds: number) => {
        if (seconds === 0) return '';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `${diffMins}${t('time_ago_m')}`;
        if (diffHours < 24) return `${diffHours}${t('time_ago_h')}`;
        if (diffDays < 7) return `${diffDays}${t('time_ago_d')}`;
        return date.toLocaleDateString();
    };

    // ... (inside component)
    const [callModalVisible, setCallModalVisible] = useState(false);
    const [selectedContact, setSelectedContact] = useState<{ id: string, name: string, phone?: string } | null>(null);

    const handleCallPress = (contact: { id: string, name: string, phone?: string }) => {
        setSelectedContact(contact);
        setCallModalVisible(true);
    };

    const renderCallItem = ({ item }: { item: CallRecord }) => {
        const callerId = item.caller_id?._id;
        const isOutgoing = callerId === userId;
        const otherPerson = isOutgoing ? item.receiver_id : item.caller_id;
        const { iconName, color } = getCallIcon(item);

        const displayName = otherPerson?.full_name || t('unknown_user');
        const isMissed = item.status === 'missed' && !isOutgoing;

        return (
            <TouchableOpacity style={styles.callItem}>
                <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                    <Ionicons name={iconName as any} size={24} color={color} />
                </View>
                <View style={styles.callInfo}>
                    <Text style={styles.name}>{displayName}</Text>
                    <View style={styles.detailsRow}>
                        <Text style={styles.callType}>
                            {item.call_type === 'internet' ? t('call_type_internet') : t('call_type_phone')} • {isOutgoing ? t('call_direction_outgoing') : t('call_direction_incoming')}
                        </Text>
                        {item.duration > 0 && (
                            <Text style={styles.duration}> • {formatDuration(item.duration)}</Text>
                        )}
                    </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
                    {isMissed && (
                        <TouchableOpacity
                            style={styles.callBackButton}
                            onPress={() => handleCallPress({ id: otherPerson._id, name: displayName })}
                        >
                            <Ionicons name="call" size={16} color="white" />
                            <Text style={styles.callBackText}>{t('call_back')}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#1F2A44" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('call_history')}</Text>
                <View style={{ width: 40 }} />
            </View>
            <FlatList
                data={calls}
                renderItem={renderCallItem}
                keyExtractor={(item) => item._id}
                contentContainerStyle={calls.length === 0 ? styles.emptyContainer : styles.listContainer}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2196F3']} />
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <Ionicons name="call-outline" size={64} color="#BDBDBD" />
                        <Text style={styles.emptyText}>{t('no_call_history')}</Text>
                        <Text style={styles.emptySubtext}>{t('no_call_history_sub')}</Text>
                    </View>
                }
            />

            {/* Call Type Modal */}
            <CallTypeModal
                visible={callModalVisible}
                onClose={() => setCallModalVisible(false)}
                onInternetCall={() => {
                    if (selectedContact) {
                        startCall(selectedContact.id, selectedContact.name);
                    }
                }}
                name={selectedContact?.name || ''}
                phoneNumber={selectedContact?.phone}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    centerContainer: {
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F0F0F0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2A44',
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContainer: {
        padding: 12,
        paddingTop: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    callItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    callInfo: {
        flex: 1,
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        marginBottom: 4,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    callType: {
        fontSize: 14,
        color: '#757575',
    },
    duration: {
        fontSize: 14,
        color: '#757575',
    },
    time: {
        fontSize: 12,
        color: '#9E9E9E',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: '#757575',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: '#9E9E9E',
        marginTop: 8,
    },
    callBackButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563EB',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 16,
        marginTop: 6,
    },
    callBackText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
});
