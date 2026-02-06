import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken, BASE_URL } from '../services/api';
import Map from '../components/Map';
import { Group, Pilgrim } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

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
    const [allPilgrims, setAllPilgrims] = useState<Pilgrim[]>([]);
    const [isMapVisible, setIsMapVisible] = useState(true);
    const [showProfile, setShowProfile] = useState(false);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchNotifications = async () => {
        try {
            const response = await api.get('/notifications?limit=1');
            if (response.data.success) {
                setUnreadCount(response.data.unread_count);
            }
        } catch (error) {
            console.error('Failed to fetch unread count', error);
        }
    };

    const fetchGroups = async () => {
        try {
            setLoading(true);
            const response = await api.get('/groups/dashboard');
            if (response.data.success) {
                const fetchedGroups: Group[] = response.data.data;
                setGroups(fetchedGroups);

                // Flatten pilgrims from all groups for the map
                const pilgrims = fetchedGroups.flatMap(g => g.pilgrims || []);
                setAllPilgrims(pilgrims);
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

    // Refresh data when screen comes into focus (e.g., after creating a group)
    useFocusEffect(
        useCallback(() => {
            fetchGroups();
            fetchProfile();
            fetchNotifications();
        }, [])
    );

    const handleLogout = async () => {
        setAuthToken(null);
        navigation.replace('Login');
    };

    const mapMarkers = allPilgrims
        .filter(p => p.location && p.location.lat && p.location.lng)
        .map(p => ({
            id: p._id,
            latitude: p.location!.lat,
            longitude: p.location!.lng,
            title: p.full_name,
            description: `Battery: ${p.battery_percent || '?'}%`
        }));

    return (
        <View style={styles.container}>
            {/* Header */}
            <SafeAreaView style={styles.header} edges={['top']}>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
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

            {/* Map Toggle & Container */}
            <View style={styles.mapHeader}>
                <Text style={styles.sectionTitle}>Live Map</Text>
                <TouchableOpacity onPress={() => setIsMapVisible(!isMapVisible)}>
                    <Text style={styles.toggleText}>{isMapVisible ? 'Hide Map' : 'Show Map'}</Text>
                </TouchableOpacity>
            </View>

            {isMapVisible && (
                <View style={styles.mapContainer}>
                    <Map markers={mapMarkers} />
                </View>
            )}

            {/* Group List */}
            <View style={[styles.listContainer, !isMapVisible && styles.listContainerFull]}>
                <Text style={styles.sectionTitleList}>My Groups</Text>
                {loading ? (
                    <ActivityIndicator size="large" color="#007AFF" />
                ) : (
                    <FlatList
                        data={groups}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.groupCard}
                                onPress={() => navigation.navigate('GroupDetails', { groupId: item._id, groupName: item.group_name })}
                            >
                                <View>
                                    <Text style={styles.groupName}>{item.group_name}</Text>
                                    <Text style={styles.groupDate}>Created: {new Date(item.created_at).toLocaleDateString()}</Text>
                                </View>
                                <View style={styles.pilgrimCountBadge}>
                                    <Text style={styles.pilgrimCountText}>{item.pilgrims?.length || 0}</Text>
                                </View>
                            </TouchableOpacity>
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
        backgroundColor: '#f5f5f5',
    },
    header: {
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#333',
    },
    profileButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    notificationButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
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
        color: '#666',
        backgroundColor: '#E3F2FD',
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
        backgroundColor: '#f0f0f0',
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
    mapHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#666',
    },
    toggleText: {
        color: '#007AFF',
        fontWeight: '600',
    },
    mapContainer: {
        height: '40%',
        width: '100%',
    },
    listContainer: {
        flex: 1,
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        marginTop: -15,
    },
    listContainerFull: {
        marginTop: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
    },
    sectionTitleList: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#333',
    },
    groupCard: {
        padding: 16,
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#eee',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    groupName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    groupDate: {
        fontSize: 12,
        color: '#999',
    },
    pilgrimCountBadge: {
        backgroundColor: '#E3F2FD',
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
        color: '#007AFF',
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
        backgroundColor: '#007AFF',
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#007AFF',
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
