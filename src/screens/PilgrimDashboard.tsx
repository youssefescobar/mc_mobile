import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Animated, Alert, Platform } from 'react-native';
import axios from 'axios';

import Map from '../components/Map';
import { Region } from 'react-native-maps';
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
    const [highlightedMarkerId, setHighlightedMarkerId] = useState<string | null>(null);
    const [showSuggestedAreas, setShowSuggestedAreas] = useState(false);
    const [isAreasDrawerVisible, setIsAreasDrawerVisible] = useState(false);
    const [isToolsExpanded, setIsToolsExpanded] = useState(false);
    const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
    const [mapRegion, setMapRegion] = useState<Region | undefined>(undefined);
    const drawerAnim = useRef(new Animated.Value(600)).current;



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
        setCurrentLocation(location);
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
            setCurrentLocation(location);
            lastLocationUpdate.current = 0;
            handleLocationUpdate(location);
        } catch (e) { }
    };

    const handleNavigatePress = () => {
        if (!groupInfo?.moderators[0]) return;

        const mod = groupInfo.moderators[0];
        if (!mod.current_latitude || !mod.current_longitude) {
            showToast(t('moderator_location_unknown'), 'error');
            return;
        }

        Alert.alert(
            t('navigation_options'),
            t('choose_navigation_method'),
            [
                {
                    text: t('in_app_view'),
                    onPress: () => {
                        setHighlightedMarkerId(mod._id);
                        // Reset after animation
                        setTimeout(() => setHighlightedMarkerId(null), 2000);
                    }
                },
                {
                    text: t('google_maps_app'),
                    onPress: () => openNavigation(
                        mod.current_latitude!,
                        mod.current_longitude!,
                        mod.full_name,
                        true // googleMapsOnly
                    )
                },
                { text: t('cancel'), style: 'cancel' }
            ]
        );
    };

    const toggleAreasDrawer = (visible: boolean) => {
        setIsAreasDrawerVisible(visible);
        Animated.spring(drawerAnim, {
            toValue: visible ? 0 : 600,
            useNativeDriver: true,
            tension: 50,
            friction: 8
        }).start();
    };

    const handleNavigateAreaPress = (area: any) => {

        Alert.alert(
            t('navigation_options'),
            t('choose_navigation_method'),
            [
                {
                    text: t('in_app_view'),
                    onPress: () => {
                        setShowSuggestedAreas(true);
                        setHighlightedMarkerId(`area-${area._id}`);
                        // Reset after animation
                        setTimeout(() => setHighlightedMarkerId(null), 2000);
                    }
                },
                {
                    text: t('google_maps_app'),
                    onPress: () => openNavigation(
                        area.latitude,
                        area.longitude,
                        area.name,
                        true
                    )
                },
                { text: t('cancel'), style: 'cancel' }
            ]
        );
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

    const recenterMap = () => {
        if (currentLocation) {
            setMapRegion({
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                latitudeDelta: 0.005,
                longitudeDelta: 0.005,
            });
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
            <View style={styles.mapContainer} pointerEvents="box-none">
                <Map
                    onLocationUpdate={handleLocationUpdate}
                    highlightedMarkerId={highlightedMarkerId}
                    region={mapRegion}
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
                        ...(showSuggestedAreas ? suggestedAreas.map(a => ({
                            id: `area-${a._id}`,
                            latitude: a.latitude,
                            longitude: a.longitude,
                            title: `📍 ${a.name}`,
                            description: a.description || t('suggested_areas'),
                            pinColor: '#F59E0B'
                        })) : [])
                    ]}
                />
            </View>

            {/* Top Navigation Cluster */}
            <View style={styles.topCluster} pointerEvents="box-none">
                <View style={styles.toolsContainer}>
                    {isToolsExpanded && (
                        <View style={styles.toolsDropdown}>
                            <View style={styles.gridRow}>
                                <TouchableOpacity
                                    style={styles.circleActionBtn}
                                    onPress={() => navigation.navigate('PilgrimProfile', { userId: route.params.userId })}
                                >
                                    <Ionicons name="person-outline" size={22} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.circleActionBtn}
                                    onPress={() => navigation.navigate('CallHistory')}
                                >
                                    <Ionicons name="call-outline" size={22} color="#0F172A" />
                                    {missedCallCount > 0 && (
                                        <View style={styles.clusterBadge}>
                                            <Text style={styles.clusterBadgeText}>
                                                {missedCallCount > 9 ? '9+' : missedCallCount}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>

                            <View style={styles.gridRow}>
                                <TouchableOpacity
                                    style={styles.circleActionBtn}
                                    onPress={() => toggleAreasDrawer(true)}
                                >
                                    <Ionicons name="compass-outline" size={22} color="#0F172A" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.circleActionBtn}
                                    onPress={recenterMap}
                                >
                                    <Ionicons name="locate" size={22} color="#2563EB" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* Tools Toggle */}
                    <TouchableOpacity
                        onPress={() => setIsToolsExpanded(!isToolsExpanded)}
                        activeOpacity={0.8}
                    >
                        <View style={[styles.menuRectBtn, isToolsExpanded && styles.menuRectBtnActive]}>
                            <Ionicons
                                name={isToolsExpanded ? "chevron-up" : "grid-outline"}
                                size={20}
                                color={isToolsExpanded ? "#2563EB" : "#0F172A"}
                            />
                            <Text style={[styles.menuText, isToolsExpanded && styles.menuTextActive]}>
                                {isToolsExpanded ? t('close') : t('menu')}
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* SOS Row (Matching width) */}
                    <View style={styles.sosGridRow}>
                        <TouchableOpacity onPress={handleSOS} activeOpacity={0.8} style={{ width: '100%' }}>
                            <Animated.View style={[
                                styles.sosRectBtn,
                                { width: '100%', justifyContent: 'center' },
                                sosActive && { transform: [{ scale: pulseAnim }] }
                            ]}>
                                <Ionicons name="warning" size={20} color="white" />
                                <Text style={styles.sosText}>{t('sos')}</Text>
                            </Animated.View>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>


            {/* Action Card (Leader Hub) */}
            <Animated.View style={[styles.actionCard, { transform: [{ translateY: sheetAnim }] }]}>
                {!groupInfo ? (
                    <TouchableOpacity
                        style={styles.joinPrimaryBtn}
                        onPress={() => navigation.navigate('JoinGroup', { userId: route.params.userId })}
                    >
                        <Ionicons name="enter-outline" size={20} color="white" style={{ marginEnd: 8 }} />
                        <Text style={styles.joinBtnText}>{t('join_group_via_code')}</Text>
                    </TouchableOpacity>
                ) : (
                    <>
                        {/* Status Bar */}
                        <View style={styles.compactStatusRow}>
                            <View style={styles.miniChip}>
                                <Ionicons name="location" size={12} color="#10B981" />
                                <Text style={styles.miniChipText}>{t('active')}</Text>
                            </View>
                            <View style={styles.miniChip}>
                                <Ionicons name={getBatteryIcon(batteryLevel)} size={12} color="#3B82F6" />
                                <Text style={styles.miniChipText}>{batteryLevel !== null ? `${batteryLevel}%` : '--'}</Text>
                            </View>
                        </View>

                        {/* Leader Section */}
                        <View style={styles.leaderSection}>
                            <View style={styles.leaderInfo}>
                                <Text style={styles.leaderTitle}>{groupInfo.group_name}</Text>
                                <Text style={styles.leaderName} numberOfLines={1}>
                                    {groupInfo.moderators[0]?.full_name || t('assigned')}
                                </Text>
                            </View>
                            <View style={styles.leaderActions}>
                                <TouchableOpacity
                                    style={[styles.iconActionBtn, { backgroundColor: '#10B981' }]}
                                    onPress={handleNavigatePress}
                                >
                                    <Ionicons name="navigate" size={20} color="white" />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.iconActionBtn, { backgroundColor: '#3B82F6' }]}
                                    onPress={() => startCall(groupInfo.moderators[0]._id, groupInfo.moderators[0].full_name)}
                                >
                                    <Ionicons name="call" size={20} color="white" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Broadcast Button */}
                        <TouchableOpacity
                            style={styles.broadcastBtn}
                            onPress={() => navigation.navigate('PilgrimMessagesScreen', {
                                groupId: groupInfo.group_id,
                                groupName: groupInfo.group_name,
                                userId: route.params.userId
                            })}
                        >
                            <Ionicons name="chatbubbles-outline" size={20} color="white" style={{ marginEnd: 8 }} />
                            <Text style={styles.broadcastBtnText}>{t('broadcasts_updates')}</Text>
                            {unreadCount > 0 && (
                                <View style={styles.broadcastBadge}>
                                    <Text style={styles.broadcastBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </Animated.View>

            {/* Suggested Areas Drawer */}
            <Animated.View style={[styles.drawer, { transform: [{ translateY: drawerAnim }] }]}>
                <View style={styles.drawerHandle} />
                <View style={styles.drawerHeader}>
                    <Text style={styles.drawerTitle}>📍 {t('suggested_areas')}</Text>
                    <TouchableOpacity onPress={() => toggleAreasDrawer(false)}>
                        <Ionicons name="close-circle" size={28} color="#94A3B8" />
                    </TouchableOpacity>
                </View>

                <View style={styles.drawerToggleContainer}>
                    <Text style={styles.drawerToggleLabel}>{t('show_on_map')}</Text>
                    <Switch
                        value={showSuggestedAreas}
                        onValueChange={setShowSuggestedAreas}
                        trackColor={{ false: '#CBD5E1', true: '#BFDBFE' }}
                        thumbColor={showSuggestedAreas ? '#2563EB' : '#94A3B8'}
                    />
                </View>

                <View style={styles.areasList}>
                    {suggestedAreas.map(area => (
                        <View key={area._id} style={styles.areaItem}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.areaName}>{area.name}</Text>
                                {area.description ? <Text style={styles.areaDesc} numberOfLines={1}>{area.description}</Text> : null}
                            </View>
                            <TouchableOpacity
                                style={styles.areaNavBtn}
                                onPress={() => handleNavigateAreaPress(area)}
                            >
                                <Ionicons name="navigate-outline" size={16} color="#2563EB" />
                            </TouchableOpacity>
                        </View>
                    ))}
                </View>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({

    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    mapContainer: {
        flex: 1,
    },
    // Top Cluster
    topCluster: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
    },
    toolsContainer: {
        width: 104,
    },
    toolsDropdown: {
        marginBottom: 8,
    },
    gridRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    menuRectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    menuRectBtnActive: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    menuText: {
        color: '#0F172A',
        fontWeight: '800',
        fontSize: 13,
    },
    menuTextActive: {
        color: '#2563EB',
    },
    circleActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
    },
    clusterBadge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#EF4444',
        borderRadius: 10,
        minWidth: 18,
        height: 18,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    clusterBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
    sosGridRow: {
        marginTop: 8,
        width: 104,
    },
    sosRectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        elevation: 8,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    sosText: {
        color: 'white',
        fontWeight: '900',
        fontSize: 15,
        textTransform: 'uppercase',
    },
    // Action Card (Leader Hub)
    actionCard: {
        position: 'absolute',
        bottom: 24,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.98)',
        borderRadius: 28,
        padding: 20,
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
    },
    joinPrimaryBtn: {
        flexDirection: 'row',
        backgroundColor: '#2563EB',
        height: 56,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    joinBtnText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 16,
    },
    compactStatusRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 16,
    },
    miniChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 20,
    },
    miniChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    leaderSection: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    leaderInfo: {
        flex: 1,
    },
    leaderTitle: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    leaderName: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 2,
    },
    leaderActions: {
        flexDirection: 'row',
        gap: 10,
    },
    iconActionBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    broadcastBtn: {
        backgroundColor: '#2563EB',
        height: 56,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    broadcastBtnText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 15,
    },
    broadcastBadge: {
        backgroundColor: '#EF4444',
        borderRadius: 12,
        minWidth: 22,
        height: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginStart: 10,
        borderWidth: 2,
        borderColor: 'white',
    },
    broadcastBadgeText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
    },
    // Suggested Areas Drawer
    drawer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        padding: 24,
        paddingTop: 12,
        elevation: 25,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -10 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
        zIndex: 200,
        maxHeight: '80%',
    },
    drawerHandle: {
        width: 40,
        height: 5,
        backgroundColor: '#E2E8F0',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 20,
    },
    drawerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    drawerTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
    },
    drawerToggleContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderRadius: 16,
        marginBottom: 20,
    },
    drawerToggleLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: '#475569',
    },
    areasList: {
        gap: 12,
    },
    areaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    areaName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1E293B',
    },
    areaDesc: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    areaNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
});

