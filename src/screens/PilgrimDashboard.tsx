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
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const { showToast } = useToast();

    useEffect(() => {
        fetchGroupInfo();
        setupBatteryListener();

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

        return () => {
            // Cleanup subscription if needed
        };
    }, []);

    // Refresh group info when screen comes into focus (e.g., after joining a group)
    useFocusEffect(
        React.useCallback(() => {
            fetchGroupInfo();
        }, [])
    );

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
            await api.put('/pilgrim/location', {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                battery_percent: batteryLevel
            });
        } catch (e) {
            // Silent error for location updates
        }
    };

    const handleSOS = async () => {
        Alert.alert(
            "EMERGENCY SOS",
            "Are you sure you want to send an SOS alert to your moderators? This will share your current location immediately.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "SEND SOS",
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
            showToast('SOS Alert Sent! Moderators notified.', 'success');
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
            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Pilgrim Dashboard</Text>
                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => navigation.navigate('PilgrimProfile', { userId: route.params.userId })}
                    >
                        <Ionicons name="person-circle-outline" size={32} color="#1E293B" />
                    </TouchableOpacity>
                </View>
                {!groupInfo && (
                    <TouchableOpacity
                        style={styles.joinButton}
                        onPress={() => navigation.navigate('JoinGroup', { userId: route.params.userId })}
                    >
                        <Ionicons name="enter-outline" size={20} color="white" style={{ marginRight: 8 }} />
                        <Text style={styles.joinButtonText}>Join Group via Code</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>

            {/* Map */}
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
                            description: 'Track your group leader'
                        })) || []
                    }
                />
            </View>

            {/* Overlays */}
            <View style={styles.overlayContainer}>

                {/* Status Cards Row */}
                <View style={styles.statusRow}>
                    {/* Location Status (Always On) */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardIconRow}>
                                <Ionicons name="location-outline" size={20} color="#64748B" />
                                <Text style={styles.cardLabel}>Location</Text>
                            </View>
                            <Ionicons name="radio-button-on" size={18} color="#10B981" />
                        </View>
                        <Text style={[styles.statusText, { color: '#10B981' }]}>
                            Always Active
                        </Text>
                    </View>

                    {/* Battery Status */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <View style={styles.cardIconRow}>
                                <Ionicons name={getBatteryIcon(batteryLevel)} size={20} color="#64748B" />
                                <Text style={styles.cardLabel}>Battery</Text>
                            </View>
                        </View>
                        <View style={styles.batteryContainer}>
                            <Text style={styles.batteryText}>{batteryLevel !== null ? `${batteryLevel}%` : '--'}</Text>
                            <View style={[
                                styles.batteryIndicator,
                                { backgroundColor: (batteryLevel || 100) < 20 ? '#EF4444' : '#10B981' }
                            ]} />
                        </View>
                    </View>
                </View>

                {/* Group Info */}
                {groupInfo && (
                    <View style={styles.groupCard}>
                        <View style={styles.groupHeaderRow}>
                            <Ionicons name="people-outline" size={20} color="#64748B" style={{ marginRight: 8 }} />
                            <Text style={styles.groupLabel}>My Group</Text>
                        </View>

                        <Text style={styles.groupName}>{groupInfo.group_name}</Text>

                        <View style={styles.moderatorRow}>
                            <Ionicons name="shield-checkmark-outline" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <Text style={styles.moderatorLabel}>Moderator: <Text style={{ fontWeight: '600', color: '#334155' }}>{groupInfo.moderators[0]?.full_name || 'Assigned'}</Text></Text>
                        </View>

                        <TouchableOpacity
                            style={styles.messageButton}
                            onPress={() => navigation.navigate('PilgrimMessagesScreen', {
                                groupId: groupInfo.group_id,
                                groupName: groupInfo.group_name
                            })}
                        >
                            <Ionicons name="chatbubbles-outline" size={20} color="#2563EB" style={{ marginRight: 8 }} />
                            <Text style={styles.messageButtonText}>Broadcasts & Updates</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* SOS Button */}
                <View style={styles.sosContainer}>
                    <TouchableOpacity onPress={handleSOS} activeOpacity={0.8}>
                        <Animated.View style={[
                            styles.sosButton,
                            sosActive && { transform: [{ scale: pulseAnim }] }
                        ]}>
                            <Ionicons name="alert-circle" size={32} color="white" />
                            <Text style={styles.sosText}>SOS</Text>
                            <Text style={styles.sosSubtext}>EMERGENCY</Text>
                        </Animated.View>
                    </TouchableOpacity>
                </View>

            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: 'white',
        zIndex: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 12,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A', // Slate 900
        letterSpacing: -0.5,
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F1F5F9', // Slate 100
        justifyContent: 'center',
        alignItems: 'center',
    },
    joinButton: {
        flexDirection: 'row',
        backgroundColor: '#2563eb',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        alignItems: 'center',
        marginBottom: 10,
        marginRight: 20,
        marginLeft: 20,
        alignSelf: 'flex-start'
    },
    joinButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14
    },
    mapContainer: {
        flex: 1,
    },
    overlayContainer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 20,
        paddingBottom: 40,
        pointerEvents: 'box-none',
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
        gap: 12, // Gap between cards
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        flex: 1, // Use flex instead of width % for better gap handling
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    cardIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B', // Slate 500
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '700',
        marginTop: 4,
    },
    batteryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between', // Push dot to end
        marginTop: 4,
    },
    batteryText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1E293B', // Slate 800
    },
    batteryIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    groupCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 4,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    groupHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
    },
    groupLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    groupName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        marginBottom: 8,
    },
    moderatorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    moderatorLabel: {
        fontSize: 14,
        color: '#64748B',
    },
    messageButton: {
        backgroundColor: '#EFF6FF', // Blue 50
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#BFDBFE', // Blue 200
    },
    messageButtonText: {
        color: '#2563EB', // Blue 600
        fontWeight: '600',
        fontSize: 14,
    },
    sosContainer: {
        alignItems: 'center',
    },
    sosButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#EF4444', // Red 500
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
        borderWidth: 4,
        borderColor: '#FEE2E2', // Red 100 ring
    },
    sosText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '900',
        marginTop: -2,
    },
    sosSubtext: {
        color: 'rgba(255,255,255,0.9)',
        fontSize: 7,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
});
