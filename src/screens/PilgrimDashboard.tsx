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

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimDashboard'>;

interface GroupInfo {
    group_name: string;
    group_id: string;
    moderators: {
        _id: string;
        full_name: string;
        phone_number: string;
        current_latitude?: number;
        current_longitude?: number;
    }[];
}

export default function PilgrimDashboard({ navigation, route }: Props) {
    // Location sharing is now always-on
    const isSharingLocation = true;
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
    const [groupInfo, setGroupInfo] = useState<GroupInfo | null>(null);
    const [sosActive, setSosActive] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const sheetAnim = useRef(new Animated.Value(40)).current;
    const { showToast } = useToast();
    const locationSubscription = useRef<Location.LocationSubscription | null>(null);

    useEffect(() => {
        fetchGroupInfo();
        setupBatteryListener();
        startLiveLocationTracking();

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

        return () => {
            if (locationSubscription.current) {
                locationSubscription.current.remove();
                locationSubscription.current = null;
            }
        };
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
        fetchUnreadCount(groupInfo.group_id);
        const interval = setInterval(() => fetchUnreadCount(groupInfo.group_id), 15000);
        return () => clearInterval(interval);
    }, [groupInfo]);

    const fetchUnreadCount = async (gId: string) => {
        try {
            const res = await api.get(`/messages/group/${gId}/unread`);
            if (res.data.success) setUnreadCount(res.data.unread_count);
        } catch (_) {}
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
        } catch (e) {
            // Silent error for location updates
        }
    };

    const startLiveLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            if (locationSubscription.current) {
                locationSubscription.current.remove();
            }

            locationSubscription.current = await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 15000,
                    distanceInterval: 10
                },
                (location) => {
                    handleLocationUpdate(location);
                }
            );
        } catch (e) {
            // Silent failure for tracking setup
        }
    };

    const handleSOS = async () => {
        Alert.alert(
            "SOS: I am lost",
            "Send an emergency alert to your moderators with your current location?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Send Alert",
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
            showToast('Alert sent to your moderators.', 'success');
            setTimeout(() => setSosActive(false), 1500);
        } catch (error) {
            showToast('Failed to send SOS. Check connection.', 'error');
            setSosActive(false);
        }
    };

    const getBatteryIcon = (level: number | null) => {
        if (level === null) return 'battery-dead';
        if (level >= 90) return 'battery-full';
        if (level >= 50) return 'battery-half';
        return 'battery-dead';
    };

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
                            title: `Moderator: ${m.full_name}`,
                            description: 'Group leader'
                        })) || []
                    }
                />
            </View>

            {/* Header overlay */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('PilgrimProfile', { userId: route.params.userId })}
                    >
                        <Ionicons name="person-circle-outline" size={28} color="#0F172A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleSOS} activeOpacity={0.8}>
                        <Animated.View style={[
                            styles.sosButton,
                            sosActive && { transform: [{ scale: pulseAnim }] }
                        ]}>
                            <Ionicons name="warning" size={16} color="white" style={{ marginRight: 6 }} />
                            <Text style={styles.sosText}>SOS</Text>
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
                        <Text style={styles.joinButtonText}>Join Group via Code</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.statusRow}>
                    <View style={styles.statusChip}>
                        <Ionicons name="location-outline" size={18} color="#0F766E" />
                        <View>
                            <Text style={styles.chipLabel}>Location</Text>
                            <Text style={styles.chipValue}>Active</Text>
                        </View>
                    </View>
                    <View style={styles.statusChip}>
                        <Ionicons name={getBatteryIcon(batteryLevel)} size={18} color="#1E3A8A" />
                        <View>
                            <Text style={styles.chipLabel}>Battery</Text>
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
                                    Led by <Text style={styles.moderatorName}>{groupInfo.moderators[0]?.full_name || 'Assigned'}</Text>
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => navigation.navigate('PilgrimMessagesScreen', {
                                groupId: groupInfo.group_id,
                                groupName: groupInfo.group_name
                            })}
                        >
                            <Ionicons name="chatbubbles-outline" size={16} color="#2563EB" style={{ marginRight: 8 }} />
                            <Text style={styles.messageButtonText}>Broadcasts & Updates</Text>
                            {unreadCount > 0 && (
                                <View style={styles.unreadBadge}>
                                    <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
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
        paddingBottom: 34,
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
        marginLeft: 8,
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
});
