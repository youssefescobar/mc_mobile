import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken, BASE_URL } from '../services/api';
import { Group, Pilgrim } from '../types';

import Ionicons from '@expo/vector-icons/Ionicons';
import { Swipeable } from 'react-native-gesture-handler';
import { useToast } from '../components/ToastContext';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorDashboard'>;

interface UserProfile {
    _id: string;
    full_name: string;
    email: string;
    phone_number: string;
    role: string;
    profile_picture?: string;
}

export default function ModeratorDashboard({ route, navigation }: Props) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [showProfile, setShowProfile] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const [shownSosId, setShownSosId] = useState<string | null>(null);
    const { showToast } = useToast();

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await api.get('/notifications?limit=1');
            if (response.data.success) {
                setUnreadCount(response.data.unread_count);
                const latest = response.data.notifications?.[0];
                if (latest && latest.type === 'sos_alert' && !latest.read && latest._id !== shownSosId) {
                    setShownSosId(latest._id);
                    Alert.alert(
                        latest.title || 'SOS Alert',
                        latest.message || 'A pilgrim needs help.',
                        [
                            { text: 'Dismiss', style: 'cancel' },
                            { text: 'Open Notifications', onPress: () => navigation.navigate('Notifications') }
                        ]
                    );
                }
            }
        } catch (error) {
            console.error('Failed to fetch unread count', error);
        }
    }, [navigation, shownSosId]);

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await api.get('/groups/dashboard');
            if (response.data.success) {
                const fetchedGroups: Group[] = response.data.data;
                setGroups(fetchedGroups);

            }
        } catch (error: any) {
            console.error(error);
            // Silent error or retry logic could go here
        } finally {
            setLoading(false);
        }
    };

    const fetchProfile = async () => {
        try {
            const response = await api.get('/auth/me');
            if (response.data) {
                setProfile(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
        }
    };

    // Location Tracking
    const [batteryLevel, setBatteryLevel] = useState<number | null>(null);

    const setupLocationTracking = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') return;

            // Get initial battery
            const level = await Battery.getBatteryLevelAsync();
            setBatteryLevel(Math.round(level * 100));

            // Start watching position
            await Location.watchPositionAsync(
                {
                    accuracy: Location.Accuracy.High,
                    timeInterval: 60000, // Update every minute
                    distanceInterval: 50, // OR every 50 meters
                },
                async (location) => {
                    try {
                        const battery = await Battery.getBatteryLevelAsync();
                        await api.put('/auth/location', {
                            latitude: location.coords.latitude,
                            longitude: location.coords.longitude,
                            battery: Math.round(battery * 100)
                        });
                        console.log('Moderator location updated');
                    } catch (error) {
                        console.log('Failed to update location');
                    }
                }
            );
        } catch (e) {
            console.log('Error setting up location tracking');
        }
    };

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchGroups();
            fetchProfile();
            fetchNotifications();
            setupLocationTracking(); // Start tracking
            const intervalId = setInterval(fetchNotifications, 15000);
            return () => clearInterval(intervalId);
        }, [])
    );

    const handleLogout = async () => {
        setAuthToken(null);
        navigation.replace('Login');
    };

    const handleDeleteGroup = async (groupId: string, groupName: string) => {
        Alert.alert(
            "Delete Group",
            `Are you sure you want to delete "${groupName}"?`,
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/groups/${groupId}`);
                            showToast(`${groupName} deleted`, 'success');
                            fetchGroups(); // Refresh list
                        } catch (error: any) {
                            showToast('Failed to delete group', 'error');
                        }
                    }
                }
            ]
        );
    };

    const renderRightActions = (groupId: string, groupName: string, close: () => void) => {
        return (
            <TouchableOpacity
                style={styles.deleteAction}
                onPress={() => {
                    close();
                    handleDeleteGroup(groupId, groupName);
                }}
            >
                <Ionicons name="trash-outline" size={24} color="white" />
                <Text style={styles.deleteActionText}>Delete</Text>
            </TouchableOpacity>
        );
    };

    const totalPilgrims = groups.reduce((sum, group) => sum + (group.pilgrims?.length || 0), 0);

    return (
        <View style={styles.container}>
            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <View>
                    <Text style={styles.headerTitle}>Dashboard</Text>
                    <Text style={styles.headerSubtitle}>Welcome back{profile?.full_name ? `, ${profile.full_name}` : ''}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.notificationButton}
                        onPress={() => navigation.navigate('Notifications')}
                    >
                        <Ionicons name="notifications-outline" size={24} color="#333" />
                        {unreadCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => setShowProfile(true)}>
                        {profile?.profile_picture ? (
                            <Image
                                source={{ uri: `${BASE_URL.replace('/api', '')}/uploads/${profile.profile_picture}` }}
                                style={{ width: 40, height: 40, borderRadius: 20 }}
                            />
                        ) : (
                            <View style={styles.profileButton}>
                                <Ionicons name="person-circle-outline" size={32} color="#666" />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Profile Modal */}
            <Modal
                transparent={true}
                visible={showProfile}
                animationType="fade"
                onRequestClose={() => setShowProfile(false)}
            >
                <TouchableWithoutFeedback onPress={() => setShowProfile(false)}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback>
                            <View style={styles.profileCard}>
                                <View style={styles.profileHeader}>
                                    <View style={styles.avatarLarge}>
                                        {profile?.profile_picture ? (
                                            <Image
                                                source={{ uri: `${BASE_URL.replace('/api', '')}/uploads/${profile.profile_picture}` }}
                                                style={{ width: 80, height: 80, borderRadius: 40 }}
                                            />
                                        ) : (
                                            <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'M'}</Text>
                                        )}
                                    </View>
                                    <Text style={styles.profileName}>{profile?.full_name || 'Moderator'}</Text>
                                    <Text style={styles.profileRole}>Verified Moderator</Text>
                                </View>

                                <View style={styles.profileDetails}>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Email</Text>
                                        <Text style={styles.detailValue}>{profile?.email || 'Loading...'}</Text>
                                    </View>
                                    <View style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>Phone</Text>
                                        <Text style={styles.detailValue}>{profile?.phone_number || 'Loading...'}</Text>
                                    </View>
                                </View>

                                <TouchableOpacity
                                    style={styles.editProfileButton}
                                    onPress={() => {
                                        setShowProfile(false);
                                        navigation.navigate('EditProfile');
                                    }}
                                >
                                    <Text style={styles.editProfileText}>Edit Profile</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                                    <Text style={styles.logoutText}>Log Out</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <View style={styles.statIcon}>
                        <Ionicons name="grid" size={16} color="#2563EB" />
                    </View>
                    <Text style={styles.statLabel}>Groups</Text>
                    <Text style={styles.statValue}>{groups.length}</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={styles.statIcon}>
                        <Ionicons name="people" size={16} color="#16A34A" />
                    </View>
                    <Text style={styles.statLabel}>Pilgrims</Text>
                    <Text style={styles.statValue}>{totalPilgrims}</Text>
                </View>
            </View>

            {/* Group List */}
            <View style={styles.listContainer}>
                <View style={styles.listHeader}>
                    <Text style={styles.sectionTitleList}>My Groups</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
                        <Text style={styles.createLink}>Create Group</Text>
                    </TouchableOpacity>
                </View>
                {loading ? (
                    <ActivityIndicator size="large" color="#007AFF" />
                ) : (
                    <FlatList
                        data={groups}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <Swipeable
                                renderRightActions={(progress, dragX, ref) =>
                                    renderRightActions(item._id, item.group_name, ref?.close || (() => { }))
                                }
                            >
                                <TouchableOpacity
                                    style={styles.groupCard}
                                    onPress={() => navigation.navigate('GroupDetails', { groupId: item._id, groupName: item.group_name })}
                                >
                                    <View style={styles.groupCardLeft}>
                                        <View style={styles.groupIconCircle}>
                                            <Ionicons name="people" size={16} color="#2563EB" />
                                        </View>
                                        <View>
                                            <Text style={styles.groupName}>{item.group_name}</Text>
                                            <Text style={styles.groupDate}>Created {new Date(item.created_at).toLocaleDateString()}</Text>
                                        </View>
                                    </View>
                                    <View style={styles.pilgrimCountBadge}>
                                        <Text style={styles.pilgrimCountText}>{item.pilgrims?.length || 0}</Text>
                                    </View>
                                </TouchableOpacity>
                            </Swipeable>
                        )}
                        refreshing={loading}
                        onRefresh={() => { fetchGroups(); fetchProfile(); }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No groups found. Create one to get started!</Text>}
                        contentContainerStyle={{ paddingBottom: 100 }}
                    />
                )}
            </View>

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateGroup')}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F7FB',
    },
    header: {
        backgroundColor: '#F5F7FB',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 12,
        paddingTop: 6,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
        alignItems: 'center',
    },
    profileButton: {
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 21,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    notificationButton: {
        width: 42,
        height: 42,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        backgroundColor: 'white',
        borderRadius: 21,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 4,
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#FF3B30',
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
        fontWeight: 'bold',
    },
    profileButtonText: {
        fontSize: 20,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    profileCard: {
        backgroundColor: 'white',
        width: '100%',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    profileHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    avatarLarge: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#007AFF', // Primary color for avatar
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatarText: {
        fontSize: 32,
        color: 'white',
        fontWeight: 'bold',
    },
    profileName: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    profileRole: {
        fontSize: 14,
        color: '#475569',
        backgroundColor: '#EEF2FF',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    profileDetails: {
        width: '100%',
        marginBottom: 24,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    detailLabel: {
        color: '#666',
        fontSize: 14,
    },
    detailValue: {
        color: '#333',
        fontSize: 14,
        fontWeight: '500',
    },
    editProfileButton: {
        backgroundColor: '#F1F5F9',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 10,
    },
    editProfileText: {
        color: '#333',
        fontSize: 16,
        fontWeight: '600',
    },
    logoutButton: {
        backgroundColor: '#FF3B30',
        width: '100%',
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    logoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        paddingHorizontal: 20,
        marginTop: 6,
        marginBottom: 12,
    },
    statCard: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 3,
    },
    statIcon: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    statLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 4,
    },
    listContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 6,
    },
    listHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitleList: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#0F172A',
    },
    createLink: {
        fontSize: 13,
        fontWeight: '600',
        color: '#2563EB',
    },
    groupCard: {
        padding: 16,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    groupIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#EEF2FF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#0F172A',
        marginBottom: 4,
    },
    deleteAction: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        marginVertical: 0, // Match exact height without extra margin
        borderRadius: 12,
        marginLeft: 10,
        marginBottom: 12, // Match the card's bottom margin
    },
    deleteActionText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 12,
        marginTop: 4,
    },
    groupDate: {
        fontSize: 12,
        color: '#999',
    },
    pilgrimCountBadge: {
        backgroundColor: '#DBEAFE',
        minWidth: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    pilgrimCountText: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1D4ED8',
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 40,
        color: '#999',
    },
    fab: {
        position: 'absolute',
        bottom: 40,
        right: 20,
        backgroundColor: '#2563EB',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
    },
    fabText: {
        color: 'white',
        fontSize: 32,
        marginTop: -4,
    },
});
