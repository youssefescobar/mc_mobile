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
    const [isSharingLocation, setIsSharingLocation] = useState(true);
    const [locationSubscription, setLocationSubscription] = useState<Location.LocationSubscription | null>(null);
    const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sheetAnim = useRef(new Animated.Value(40)).current;

    const { showToast } = useToast();

    const { startCall } = useCall();

    // Legacy Call State & Effect removed. CallContext handles this now.

    // Initial setup & Background interval
    useEffect(() => {
        // Send initial location
        getCurrentLocation();

        // Set up 5-minute interval for normal updates
        locationIntervalRef.current = setInterval(() => {
            if (!sosActive) getCurrentLocation();
        }, 5 * 60 * 1000);

        return () => {
            if (locationIntervalRef.current) clearInterval(locationIntervalRef.current);
            if (locationSubscription) locationSubscription.remove();
        };
    }, [sosActive]); // Re-run if SOS state changes (though logic handles it)

    // SOS Mode: Real-time tracking
    useEffect(() => {
        if (sosActive) {
            startRealTimeTracking();
        } else {
            stopRealTimeTracking();
            getCurrentLocation(); // Send one last update or revert to normal
        }
    }, [sosActive]);

    useEffect(() => {
        const initializeScreen = async () => {
            await fetchGroupInfo();
            setupBatteryListener();

            socketService.connect();

            // Debug: Check what's in AsyncStorage
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const storedUserId = await AsyncStorage.getItem('user_id');
            console.log('[PilgrimDashboard] Stored user_id in AsyncStorage:', storedUserId);

            // Register user for calls after connection with a delay
            setTimeout(async () => {
                await socketService.registerUser();
            }, 1000);
        };

        initializeScreen();

        return () => {
            // socketService.disconnect(); // Keep connected?
        };
    }, []);

    // Animations
    useEffect(() => {
        // Start SOS pulse animation
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.2,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.timing(sheetAnim, {
            toValue: 0,
            duration: 450,
            useNativeDriver: true,
        }).start();
    }, []);

    // Refresh group info and unread count when screen comes into focus
    useFocusEffect(
        React.useCallback(() => {
            fetchGroupInfo();
        }, [])
    );

    // Poll for unread messages when we have a group
    useEffect(() => {
        if (!groupInfo) return;
        socketService.joinGroup(groupInfo.group_id);
        fetchUnreadCount(groupInfo.group_id);

        const handleNewMessage = (msg: any) => {
            if (msg.group_id === groupInfo.group_id) {
                // Determine if message is for us (broadcast or direct)
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

    const setupBatteryListener = async () => {
        try {
            const level = await Battery.getBatteryLevelAsync();
            setBatteryLevel(Math.round(level * 100));

            Battery.addBatteryLevelListener(({ batteryLevel }) => {
                setBatteryLevel(Math.round(batteryLevel * 100));
            });
        } catch (e) {
            console.log('Battery API not available');
            setBatteryLevel(100); // Default to 100 on simulator
        }
    };

    const handleLocationUpdate = async (location: Location.LocationObject) => {
        if (!isSharingLocation) return;

        try {
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
                    isSos: sosActive // Pass SOS status
                });
            }
        } catch (e) {
            // Silent error for location updates
        }
    };

    const getCurrentLocation = async () => {
        if (!isSharingLocation) return;
        try {
            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            handleLocationUpdate(location);
        } catch (e) {
            console.log('Error getting current location', e);
        }
    };

    const startRealTimeTracking = async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const sub = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: 5000,
                distanceInterval: 10,
            },
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
        Alert.alert(
            t('sos_lost'),
            t('sos_confirmation'),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('send_alert'),
                    style: "destructive",
                    onPress: sendSOS
                }
            ]
        );
    };

    const sendSOS = async () => {
        setSosActive(true);
        try {
            await api.post('/pilgrim/sos', {});
            if (groupInfo && route.params?.userId) {
                socketService.sendSOS({
                    groupId: groupInfo.group_id,
                    pilgrimId: route.params.userId,
                    lat: 0, // Should get current loc?
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
                    markers={groupInfo?.moderators
                        .filter(m => m.current_latitude !== undefined && m.current_longitude !== undefined)
                        .map(m => ({
                            id: m._id,
                            latitude: m.current_latitude!,
                            longitude: m.current_longitude!,
                            title: `${t('moderator')}: ${m.full_name}`,
                            description: t('group_leader')
                        })) || []
                    }
                />
            </View>



            {/* Header overlay */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={[styles.headerContent, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <TouchableOpacity
                            style={styles.profileButton}
                            onPress={() => navigation.navigate('PilgrimProfile', { userId: route.params.userId })}
                        >
                            <Ionicons name="person-circle-outline" size={28} color="#0F172A" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.profileButton, { marginLeft: 12 }]}
                            onPress={() => navigation.navigate('CallHistory')}
                        >
                            <Ionicons name="time-outline" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={handleSOS} activeOpacity={0.8}>
                        <Animated.View style={[
                            styles.sosButton,
                            sosActive && { transform: [{ scale: pulseAnim }] }
                        ]}>
                            <Ionicons name="warning" size={16} color="white" style={{ marginRight: 6 }} />
                            <Text style={styles.sosText}>{t('sos')}</Text>
                        </Animated.View>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

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

                <View style={[styles.statusRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                    <View style={[styles.statusChip, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Ionicons name="location-outline" size={18} color="#0F766E" />
                        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.chipLabel}>{t('location')}</Text>
                            <Text style={styles.chipValue}>{t('active')}</Text>
                        </View>
                    </View>
                    <View style={[styles.statusChip, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                        <Ionicons name={getBatteryIcon(batteryLevel)} size={18} color="#1E3A8A" />
                        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.chipLabel}>{t('battery')}</Text>
                            <Text style={styles.chipValue}>{batteryLevel !== null ? `${batteryLevel}%` : '--'}</Text>
                        </View>
                    </View>
                </View>

                {groupInfo && (
                    <View style={styles.groupCard}>
                        <View style={[styles.groupHeaderRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                            <View style={styles.groupIconCircle}>
                                <Ionicons name="people" size={16} color="#2563EB" />
                            </View>
                            <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                                <Text style={styles.groupName}>{groupInfo.group_name}</Text>
                                <Text style={styles.moderatorLabel}>
                                    {t('led_by')} <Text style={styles.moderatorName}>{groupInfo.moderators[0]?.full_name || t('assigned')}</Text>
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.messageButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                            onPress={() => navigation.navigate('PilgrimMessagesScreen', {
                                groupId: groupInfo.group_id,
                                groupName: groupInfo.group_name,
                                userId: route.params.userId
                            })}
                        >
                            <Ionicons name="chatbubbles-outline" size={16} color="#2563EB" style={{ marginRight: 8, marginLeft: isRTL ? 8 : 0 }} />
                            <Text style={styles.messageButtonText}>{t('broadcasts_updates')}</Text>
                            {unreadCount > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {groupInfo.allow_pilgrim_navigation && groupInfo.moderators[0]?.current_latitude && groupInfo.moderators[0]?.current_longitude && (
                            <TouchableOpacity
                                style={[styles.navigateModButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                                onPress={() => openNavigation(
                                    groupInfo.moderators[0].current_latitude!,
                                    groupInfo.moderators[0].current_longitude!,
                                    groupInfo.moderators[0].full_name
                                )}
                            >
                                <Ionicons name="navigate-outline" size={16} color="white" style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                                <Text style={styles.navigateModButtonText}>{t('navigate_to_moderator')}</Text>
                            </TouchableOpacity>
                        )}

                        {groupInfo && groupInfo.moderators.length > 0 && (
                            <TouchableOpacity
                                style={[styles.callModButton, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                                onPress={() => startCall(groupInfo.moderators[0]._id, groupInfo.moderators[0].full_name)}
                            >
                                <Ionicons name="call" size={16} color="white" style={{ marginRight: isRTL ? 0 : 8, marginLeft: isRTL ? 8 : 0 }} />
                                <Text style={styles.navigateModButtonText}>{t('call_moderator') || 'Call Moderator'}</Text>
                            </TouchableOpacity>
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
        top: 0,
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
        paddingTop: 20,
        paddingBottom: 50, // Moved up from 34
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
    navigateModButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    callModButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 12,
        marginTop: 12,
        elevation: 2,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
    },
});
