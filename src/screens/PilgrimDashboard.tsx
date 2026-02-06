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

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimDashboard'>;

interface GroupInfo {
    group_name: string;
    group_id: string;
    moderators: {
        _id: string;
        full_name: string;
        phone_number: string;
    }[];
}

export default function PilgrimDashboard({ navigation, route }: Props) {
    const [isSharingLocation, setIsSharingLocation] = useState(true);
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
                        <Text style={styles.profileIcon}>👤</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Map */}
            <View style={styles.mapContainer}>
                <Map onLocationUpdate={handleLocationUpdate} />
            </View>

            {/* Overlays */}
            <View style={styles.overlayContainer}>

                {/* Status Cards Row */}
                <View style={styles.statusRow}>
                    {/* Location Toggle */}
                    <View style={styles.card}>
                        <View style={styles.cardHeader}>
                            <Text style={styles.cardLabel}>Location Sharing</Text>
                            <Switch
                                value={isSharingLocation}
                                onValueChange={setIsSharingLocation}
                                trackColor={{ false: "#767577", true: "#34C759" }}
                            />
                        </View>
                        <Text style={[styles.statusText, { color: isSharingLocation ? '#34C759' : '#FF3B30' }]}>
                            {isSharingLocation ? 'Active' : 'Disabled'}
                        </Text>
                    </View>

                    {/* Battery Status */}
                    <View style={styles.card}>
                        <Text style={styles.cardLabel}>Battery</Text>
                        <View style={styles.batteryContainer}>
                            <Text style={styles.batteryText}>{batteryLevel !== null ? `${batteryLevel}%` : '--'}</Text>
                            <View style={[
                                styles.batteryIndicator,
                                { backgroundColor: (batteryLevel || 100) < 20 ? '#FF3B30' : '#34C759' }
                            ]} />
                        </View>
                    </View>
                </View>

                {/* Group Info */}
                {groupInfo && (
                    <View style={styles.groupCard}>
                        <Text style={styles.groupLabel}>My Group</Text>
                        <Text style={styles.groupName}>{groupInfo.group_name}</Text>
                        <Text style={styles.moderatorLabel}>Moderator: {groupInfo.moderators[0]?.full_name || 'Assigned'}</Text>
                    </View>
                )}

                {/* SOS Button */}
                <View style={styles.sosContainer}>
                    <TouchableOpacity onPress={handleSOS} activeOpacity={0.8}>
                        <Animated.View style={[
                            styles.sosButton,
                            sosActive && { transform: [{ scale: pulseAnim }] }
                        ]}>
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
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 16,
        paddingTop: 8,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: '800',
        color: '#333',
    },
    profileButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F0F0F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    profileIcon: {
        fontSize: 20,
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
        pointerEvents: 'box-none', // Allow clicks to pass through empty areas
    },
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    card: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        width: '48%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    cardLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
    },
    statusText: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    batteryContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    batteryText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginRight: 8,
    },
    batteryIndicator: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    groupCard: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    groupLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#666',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    groupName: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    moderatorLabel: {
        fontSize: 14,
        color: '#666',
    },
    sosContainer: {
        alignItems: 'center',
    },
    sosButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FF3B30',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#FF3B30',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 8,
        borderWidth: 4,
        borderColor: 'white',
    },
    sosText: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
    },
    sosSubtext: {
        color: 'white',
        fontSize: 8,
        fontWeight: '700',
    },
});
