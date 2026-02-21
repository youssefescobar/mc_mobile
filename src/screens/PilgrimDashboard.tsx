import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated, Alert, Platform } from 'react-native';
import Map from '../components/Map';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { useToast } from '../components/ToastContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { socketService } from '../services/socket';
import { getUserId, getUserName } from '../services/user';
import { openNavigation } from '../utils/openNavigation';
import { useCall } from '../context/CallContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimDashboard'>;

interface GroupInfo {
    group_name: string;
    group_id: string;
    allow_pilgrim_navigation?: boolean;
    moderators: {
        _id: string;
        full_name: string;
        phone_number: string;
        current_latitude?: number;
        current_longitude?: number;
    }[];
}

export default function PilgrimDashboard({ navigation, route }: Props) {
    const { t, i18n } = useTranslation();
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
    const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
    const [sosActive, setSosActive] = useState(false);
    const [missedCallCount, setMissedCallCount] = useState(0);

    const fetchMissedCallCount = async () => {
        try {
            const response = await api.get('/call-history/unread-count');
            if (response.data) {
                setMissedCallCount(response.data.count);
            }
        } catch (error) {
            console.error('Failed to fetch missed call count', error);
        }
    };
    const [isSharingLocation, setIsSharingLocation] = useState(true);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sheetAnim = useRef(new Animated.Value(40)).current;
    const [suggestedAreas, setSuggestedAreas] = useState<any[]>([]);

    const { showToast } = useToast();

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications/unread-count');
            if (response.data.success) {
                setUnreadCount(response.data.unread_count);
            }
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    const setupLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            // Get initial battery
            const level = await Battery.getBatteryLevelAsync();
            setBatteryLevel(Math.round(level * 100));

            // Start watching position
            setLocationSubscription(await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 60000,
                    distanceInterval: 50,
                },
                async (location) => {
                    try {
                        const battery = await Battery.getBatteryLevelAsync();
                        await api.put('/pilgrims/location', {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            battery_percent: Math.round(battery * 100)
                        });
                    } catch (error) {
                        console.log('Failed to update location');
                    }
                }
            ));
        } catch (e) {
            console.log('Error in location tracking');
        }
    };

    const { startCall } = useCall();

    // Initial setup & Background interval
    useEffect(() => {
        getCurrentLocation();
        locationIntervalRef.current = setInterval(() => {
            if (!sosActive) getCurrentLocation();
        }, 5 * 60 * 1000);

        return () => {
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            if (locationSubscription) locationSubscription.remove();
        };
    }, [sosActive]);

    useEffect(() => {
        if (sosActive) {
            startRealTimeTracking();
        } else {
            stopRealTimeTracking();
            getCurrentLocation();
        }
    }, [sosActive]);

    useEffect(() => {
        const initializeScreen = async () => {
            fetchGroupInfo();
            fetchNotifications();
            fetchMissedCallCount();
            setupLocationTracking();
            setTimeout(async () => {
                await socketService.registerUser();
            }, 1000);
        };
        initializeScreen();
    }, []);

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
            ])
        ).start();

        Animated.timing(sheetAnim, { toValue: 0, duration: 450, useNativeDriver: true }).start();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            if (!groupInfo) fetchGroupInfo();
            fetchNotifications();
            fetchMissedCallCount();
        }, [groupInfo])
    );

    useEffect(() => {
        if (!groupInfo) return;
        const joinGroupValues = async () => {
            if (!socketService.socket?.connected) {
                await socketService.connect();
                await new Promise(r => setTimeout(r, 1000));
            }
            socketService.joinGroup(groupInfo.group_id);
            fetchUnreadCount(groupInfo.group_id);
        };
        joinGroupValues();

        const handleNewMessage = (msg: any) => {
            if (msg.group_id === groupInfo.group_id) {
                const isForMe = !msg.recipient_id || msg.recipient_id === route.params.userId;
                if (isForMe && msg.sender_id._id !== route.params.userId) {
                    setUnreadCount(prev => prev + 1);
                }
            }
        };
        socketService.onNewMessage(handleNewMessage);
        return () => {
            socketService.offNewMessage(handleNewMessage);
            socketService.leaveGroup(groupInfo.group_id);
        };
    }, [groupInfo]);

    useEffect(() => {
        if (!groupInfo) return;
        const fetchAreas = async () => {
            try {
                const res = await api.get(`/groups/${groupInfo.group_id}/suggested-areas`);
                setSuggestedAreas(res.data.areas || []);
            } catch (e) {
                console.log('No suggested areas');
            }
        };
        fetchAreas();
    }, [groupInfo]);

    const fetchUnreadCount = async (gId: string) => {
        try {
            const res = await api.get(`/messages/group/${gId}/unread`);
            if (res.data.success) setUnreadCount(res.data.unread_count);
        } catch (_) { }
    };

    const fetchGroupInfo = async () => {
        try {
            const response = await api.get('/pilgrim/my-group');
            setGroupInfo(response.data);
        } catch (error) {
            console.log('No group assigned');
        }
    };

    const handleLocationUpdate = async (location: Location.LocationObject) => {
        if (!isSharingLocation) return;
        const now = Date.now();
        if (now - lastLocationUpdate.current < 30000) return;

        try {
            lastLocationUpdate.current = now;
            const level = await Battery.getBatteryLevelAsync();
            const batteryPercent = Math.round(level * 100);
            setBatteryLevel(batteryPercent);

            await api.put('/pilgrim/location', {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                battery_percent: batteryPercent
            });

            if (groupInfo && route.params?.userId) {
                socketService.sendLocation({
                    groupId: groupInfo.group_id,
                    pilgrimId: route.params.userId,
                    lat: location.coords.latitude,
                    lng: location.coords.longitude,
                    isSos: sosActive
                });
            }
        } catch (e) { }
    };

    const lastLocationUpdate = useRef<number>(0);

    const getCurrentLocation = async () => {
        if (!isSharingLocation) return;
        try {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            lastLocationUpdate.current = 0;
            handleLocationUpdate(location);
        } catch (e) { }
    };

    const startRealTimeTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const sub = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
            handleLocationUpdate
        );
        setLocationSubscription(sub);
    };

    const stopRealTimeTracking = () => {
        if (locationSubscription) {
            locationSubscription.remove();
            setLocationSubscription(null);
        }
    };

    const handleSOS = async () => {
        Alert.alert(t('sos_lost'), t('sos_confirmation'), [
            { text: t('cancel'), style: "cancel" },
            { text: t('send_alert'), style: "destructive", onPress: sendSOS }
        ]);
    };

    const sendSOS = async () => {
        setSosActive(true);
        try {
            await api.post('/pilgrim/sos', {});
            if (groupInfo && route.params?.userId) {
                socketService.sendSOS({
                    groupId: groupInfo.group_id,
                    pilgrimId: route.params.userId,
                    lat: 0,
                    lng: 0,
                    message: "SOS Alert"
                });
            }
            showToast(t('alert_sent'), 'success');
            setTimeout(() => setSosActive(false), 1500);
        } catch (error) {
            showToast(t('sos_failed'), 'error');
            setSosActive(false);
        }
    };

    const getBatteryIcon = (level: number | null) => {
        if (level === null) return 'battery-dead';
        if (level >= 90) return 'battery-full';
        if (level >= 50) return 'battery-half';
        return 'battery-dead';
    };

    const isRTL = useIsRTL();

    return (
        <View style={styles.container}>
            <View style={styles.mapContainer}>
                <Map
                    onLocationUpdate={handleLocationUpdate}
                    markers={[
                        ...(groupInfo?.moderators
                            .filter(m => m.current_latitude !== undefined && m.current_longitude !== undefined)
                            .map(m => ({
                                id: m._id,
                                latitude: m.current_latitude!,
                                longitude: m.current_longitude!,
                                title: `${t('moderator')}: ${m.full_name}`,
                                description: t('group_leader')
                            })) || []),
                        ...suggestedAreas.map(a => ({
                            id: `area-${a._id}`,
                            latitude: a.latitude,
                            longitude: a.longitude,
                            title: `📍 ${a.name}`,
                            description: a.description || t('suggested_areas'),
                            pinColor: '#F59E0B'
                        }))
                    ]}
                />
            </View>

            {/* Header overlay */}
            <View style={styles.header} pointerEvents="box-none">
                <View style={styles.headerContent} pointerEvents="box-none">
                    <View style={styles.headerLeft} pointerEvents="box-none">
                        <View style={styles.iconGroup}>
                            <TouchableOpacity
                                style={styles.profileButton}
                                onPress={() => navigation.navigate('PilgrimProfile', { userId: route.params.userId })}
                            >
                                <Ionicons name="person-circle-outline" size={28} color="#0F172A" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.profileButton}
                                onPress={() => navigation.navigate('CallHistory')}
                            >
                                <Ionicons name="call-outline" size={24} color="#0F172A" />
                                {missedCallCount > 0 && (
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>
                                            {missedCallCount > 9 ? '9+' : missedCallCount}
                                        </Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity onPress={handleSOS} activeOpacity={0.8} style={{ marginTop: 12 }}>
                            <Animated.View style={[
                                styles.sosButton,
                                sosActive && { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <Ionicons name="warning" size={16} color="white" style={{ marginRight: 6 }} />
                                <Text style={styles.sosText}>{t('sos')}</Text>
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Bottom sheet */}
            <Animated.View style={[styles.sheet, { transform: [{ translateY: sheetAnim }] }]}>
                {!groupInfo && (
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={() => navigation.navigate('JoinGroup', { userId: route.params.userId })}
                    >
                        <Ionicons name="enter-outline" size={18} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.joinButtonText}>{t('join_group_via_code')}</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.statusRow}>
                    <View style={styles.statusChip}>
                        <Ionicons name="location-outline" size={18} color="#0F766E" />
                        <View>
                            <Text style={styles.chipLabel}>{t('location')}</Text>
                            <Text style={styles.chipValue}>{t('active')}</Text>
                        </View>
                    </View>
                    <View style={styles.statusChip}>
                        <Ionicons name={getBatteryIcon(batteryLevel)} size={18} color="#1E3A8A" />
                        <View>
                            <Text style={styles.chipLabel}>{t('battery')}</Text>
                            <Text style={styles.chipValue}>{batteryLevel !== null ? `${batteryLevel}%` : '--'}</Text>
                        </View>
                    </View>
                </View>

                {groupInfo && (
                    <View style={styles.groupCard}>
                        <View style={styles.groupHeaderRow}>
                            <View style={styles.groupIconCircle}>
                                <Ionicons name="people" size={16} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.groupName}>{groupInfo.group_name}</Text>
                                <Text style={styles.moderatorLabel}>
                                    {t('led_by')} <Text style={styles.moderatorName}>{groupInfo.moderators[0]?.full_name || t('assigned')}</Text>
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => navigation.navigate('PilgrimMessagesScreen', {
                                groupId: groupInfo.group_id,
                                groupName: groupInfo.group_name,
                                userId: route.params.userId
                            })}
                        >
                            <Ionicons name="chatbubbles-outline" size={16} color="#2563EB" style={{ marginRight: 8 }} />
                            <Text style={styles.messageButtonText}>{t('broadcasts_updates')}</Text>
                            {unreadCount > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        {groupInfo.allow_pilgrim_navigation && groupInfo.moderators[0]?.current_latitude && groupInfo.moderators[0]?.current_longitude && (
                            <TouchableOpacity
                                style={styles.navigateModButton}
                                onPress={() => openNavigation(
                                    groupInfo.moderators[0].current_latitude!,
                                    groupInfo.moderators[0].current_longitude!,
                                    groupInfo.moderators[0].full_name
                                )}
                            >
                                <Ionicons name="navigate-outline" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.navigateModButtonText}>{t('navigate_to_moderator')}</Text>
                            </TouchableOpacity>
                        )}

                        {groupInfo && groupInfo.moderators.length > 0 && (
                            <TouchableOpacity
                                style={styles.callModButton}
                                onPress={() => startCall(groupInfo.moderators[0]._id, groupInfo.moderators[0].full_name)}
                            >
                                <Ionicons name="call" size={16} color="white" style={{ marginRight: 8 }} />
                                <Text style={styles.navigateModButtonText}>{t('call_moderator')}</Text>
                            </TouchableOpacity>
                        )}

                        {/* Suggested Areas Section */}
                        {suggestedAreas.length > 0 && (
                            <View style={styles.suggestedSection}>
                                <Text style={[styles.suggestedTitle, { textAlign: isRTL ? 'right' : 'left' }]}>📍 {t('suggested_areas')}</Text>
                                {suggestedAreas.map(area => (
                                    <View key={area._id} style={styles.suggestedRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.suggestedName}>{area.name}</Text>
                                            {area.description ? <Text style={styles.suggestedDesc}>{area.description}</Text> : null}
                                        </View>
                                        <TouchableOpacity
                                            style={styles.navigateAreaBtn}
                                            onPress={() => openNavigation(area.latitude, area.longitude, area.name)}
                                        >
                                            <Ionicons name="navigate-outline" size={14} color="white" style={{ marginRight: 4 }} />
                                            <Text style={styles.navigateAreaText}>{t('navigate_to_area')}</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    header: {
        position: 'absolute',
        top: 8,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
    },
    headerLeft: {
        alignItems: 'flex-start',
    },
    iconGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    profileButton: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    joinButton: {
        flexDirection: 'row',
        backgroundColor: '#2563EB',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    joinButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
    mapContainer: {
        flex: 1,
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 4,
        backgroundColor: 'white',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 10,
    },
    statusRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    statusChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    chipLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    chipValue: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 1,
    },
    groupCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 16,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    groupHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    groupIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    moderatorLabel: {
        fontSize: 13,
        color: '#94A3B8',
        marginTop: 2,
    },
    moderatorName: {
        fontWeight: '600',
        color: '#64748B',
    },
    messageButton: {
        backgroundColor: '#EFF6FF',
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
    },
    messageButtonText: {
        color: '#2563EB',
        fontWeight: '600',
        fontSize: 14,
    },
    unreadBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 12,
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 6,
        marginLeft: 12,
    },
    unreadBadgeText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
    },
    sosButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 21,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 5,
    },
    sosText: {
        color: 'white',
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 1,
    },
    navigateModButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#10B981',
        borderRadius: 12,
        paddingVertical: 12,
        marginTop: 12,
        elevation: 2,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    callModButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 12,
        marginTop: 8,
        elevation: 2,
        shadowColor: '#1E40AF',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
    navigateModButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        width: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'white',
    },
    badgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '700',
    },
    suggestedSection: {
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    suggestedTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 12,
    },
    suggestedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    suggestedName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    suggestedDesc: {
        fontSize: 12,
        color: '#94A3B8',
        marginTop: 2,
    },
    navigateAreaBtn: {
        flexDirection: 'row',
        backgroundColor: '#2563EB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        alignItems: 'center',
    },
    navigateAreaText: {
        color: 'white',
        fontSize: 11,
        fontWeight: '700',
    },
});
