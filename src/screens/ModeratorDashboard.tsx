import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Image, Modal, TouchableWithoutFeedback } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { api, setAuthToken, BASE_URL, logout } from '../services/api';
import { socketService } from '../services/socket';
import { Group, Pilgrim } from '../types';

import Ionicons from '@expo/vector-icons/Ionicons';
import { Swipeable } from 'react-native-gesture-handler';
import { useToast } from '../components/ToastContext';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '../i18n';

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
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';
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

    const fetchNotifications = useCallback(async () => {
        try {
            const response = await api.get('/notifications?limit=1');
            if (response.data.success) {
                setUnreadCount(response.data.unread_count);
                const latest = response.data.notifications?.[0];
                if (latest && latest.type === 'sos_alert' && !latest.read && latest._id !== shownSosId) {
                    setShownSosId(latest._id);
                    Alert.alert(
                        latest.title || t('sos_alert'),
                        latest.message || t('sos_alert_default'),
                        [
                            { text: t('dismiss'), style: 'cancel' },
                            { text: t('open_notifications'), onPress: () => navigation.navigate('Notifications') }
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
    const lastLocationUpdate = useRef<number>(0);

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
                    const now = Date.now();
                    if (now - lastLocationUpdate.current < 30000) return;

                    try {
                        lastLocationUpdate.current = now;
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
            console.log('Error in location tracking');
        }
    };

    // Initial Load
    useEffect(() => {
        fetchGroups();
        fetchProfile();
        setupLocationTracking();
    }, []);

    // Refresh data when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
            fetchMissedCallCount();

            // Optional: Refetch groups if it's been a while or force refresh needed
            // For now, we rely on pull-to-refresh for groups to save bandwidth
            // if (groups.length === 0) fetchGroups(); 
        }, [])
    );

    const handleLogout = async () => {
        Alert.alert(
            t('log_out'),
            t('logout_confirmation'),
            [
                { text: t('cancel'), style: 'cancel' },
                {

                    text: t('log_out'),
                    style: 'destructive',
                    onPress: async () => {
                        socketService.disconnect();
                        await logout();
                        navigation.reset({
                            index: 0,
                            routes: [{ name: 'Login' }],
                        });
                    }
                }
            ]
        );
    };

    const handleDeleteGroup = async (groupId: string, groupName: string) => {
        Alert.alert(
            t('delete_group_link'),
            t('delete_group_question', { groupName }),
            [
                { text: t('cancel'), style: "cancel" },
                {
                    text: t('remove'),
                    style: "destructive",
                    onPress: async () => {
                        try {
                            await api.delete(`/groups/${groupId}`);
                            showToast(t('group_deleted', { groupName }), 'success');
                            fetchGroups(); // Refresh list
                        } catch (error: any) {
                            showToast(t('failed_delete_group'), 'error');
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
                <Text style={styles.deleteActionText}>{t('remove')}</Text>
            </TouchableOpacity>
        );
    };

    const totalPilgrims = groups.reduce((sum, group) => sum + (group.pilgrims?.length || 0), 0);

    const [showLangPicker, setShowLangPicker] = useState(false);
    const LANGUAGES = [
        { label: 'English', value: 'en', flag: '🇺🇸' },
        { label: 'Arabic', value: 'ar', flag: '🇸🇦' },
        { label: 'Urdu', value: 'ur', flag: '🇵🇰' },
        { label: 'French', value: 'fr', flag: '🇫🇷' },
        { label: 'Indonesian', value: 'id', flag: '🇮🇩' },
        { label: 'Turkish', value: 'tr', flag: '🇹🇷' },
    ];
    const currentLang = LANGUAGES.find(l => l.value === i18n.language) || LANGUAGES[0];
    const [selectedLanguage, setSelectedLanguage] = useState(currentLang);

    const handleLanguageChange = async (lang: any) => {
        setSelectedLanguage(lang);
        await changeLanguage(lang.value);
        setShowLangPicker(false);
        // Delay showing the profile modal slightly to avoid transition issues
        setTimeout(() => setShowProfile(true), 300);
        try {
            await api.put('/auth/update-language', { language: lang.value });
        } catch (e) {
            console.log('Failed to update language on backend', e);
        }
    };

    const renderPickerModal = () => (
        <Modal visible={showLangPicker} transparent animationType="slide">
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangPicker(false)}>
                <View style={styles.modalContent}>
                    <View style={[styles.modalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Text style={styles.modalTitle}>{t('select_option')}</Text>
                        <TouchableOpacity onPress={() => setShowLangPicker(false)}>
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={LANGUAGES}
                        keyExtractor={(item) => item.value}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={[styles.pickerItem, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => handleLanguageChange(item)}>
                                <Text style={styles.pickerItemText}>{item.flag}  {item.label}</Text>
                                {selectedLanguage.value === item.value && (
                                    <Ionicons name="checkmark" size={20} color="#007AFF" />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </TouchableOpacity>
        </Modal>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
                <View style={isRTL && { alignItems: 'flex-end' }}>
                    <Text style={styles.headerTitle}>{t('dashboard')}</Text>
                    <Text style={styles.headerSubtitle}>{t('welcome_back')}{profile?.full_name ? `, ${profile.full_name}` : ''}</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.notificationButton}
                        onPress={() => navigation.navigate('CallHistory')}
                    >
                        <Ionicons name="call-outline" size={24} color="#333" />
                        {missedCallCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>
                                    {missedCallCount > 9 ? '9+' : missedCallCount}
                                </Text>
                            </View>
                        )}
                    </TouchableOpacity>

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

                    <TouchableOpacity
                        style={styles.profileButton}
                        onPress={() => setShowProfile(true)}
                    >
                        <Ionicons name="person-circle-outline" size={32} color="#666" />
                    </TouchableOpacity>
                </View>
            </View>

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
                                        <Text style={styles.avatarText}>{profile?.full_name?.charAt(0) || 'M'}</Text>
                                    </View>
                                    <Text style={styles.profileName}>{profile?.full_name || t('moderator')}</Text>
                                    <Text style={styles.profileRole}>{t('verified_moderator')}</Text>
                                </View>

                                <View style={styles.profileDetails}>
                                    <View style={[styles.detailRow, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <Text style={styles.detailLabel}>{t('email')}</Text>
                                        <Text style={styles.detailValue}>{profile?.email || t('loading')}</Text>
                                    </View>
                                    <View style={[styles.detailRow, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <Text style={styles.detailLabel}>{t('phone')}</Text>
                                        <Text style={styles.detailValue}>{profile?.phone_number || t('loading')}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.detailRow, isRTL && { flexDirection: 'row-reverse' }]}
                                        onPress={() => {
                                            setShowProfile(false);
                                            setTimeout(() => setShowLangPicker(true), 300);
                                        }}
                                    >
                                        <Text style={styles.detailLabel}>{t('language')}</Text>
                                        <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center' }}>
                                            <Text style={[styles.detailValue, isRTL ? { marginLeft: 8 } : { marginRight: 8 }]}>
                                                {selectedLanguage.flag} {selectedLanguage.label}
                                            </Text>
                                            <Ionicons name="chevron-forward" size={16} color="#6B7280" style={isRTL && { transform: [{ rotate: '180deg' }] }} />
                                        </View>
                                    </TouchableOpacity>
                                </View>

                                <TouchableOpacity
                                    style={styles.editProfileButton}
                                    onPress={() => {
                                        setShowProfile(false);
                                        navigation.navigate('EditProfile');
                                    }}
                                >
                                    <Text style={styles.editProfileText}>{t('edit')}</Text>
                                </TouchableOpacity>

                                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                                    <Text style={styles.logoutText}>{t('log_out')}</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
            {renderPickerModal()}

            {/* Stats */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, isRTL && { alignSelf: 'flex-end' }]}>
                        <Ionicons name="grid" size={16} color="#2563EB" />
                    </View>
                    <Text style={[styles.statLabel, isRTL && { textAlign: 'right' }]}>{t('groups')}</Text>
                    <Text style={[styles.statValue, isRTL && { textAlign: 'right' }]}>{groups.length}</Text>
                </View>
                <View style={styles.statCard}>
                    <View style={[styles.statIcon, isRTL && { alignSelf: 'flex-end' }]}>
                        <Ionicons name="people" size={16} color="#16A34A" />
                    </View>
                    <Text style={[styles.statLabel, isRTL && { textAlign: 'right' }]}>{t('pilgrims')}</Text>
                    <Text style={[styles.statValue, isRTL && { textAlign: 'right' }]}>{totalPilgrims}</Text>
                </View>
            </View>

            {/* Group List */}
            <View style={styles.listContainer}>
                <View style={[styles.listHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={styles.sectionTitleList}>{t('my_groups')}</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('CreateGroup')}>
                        <Text style={styles.createLink}>{t('create_group_link')}</Text>
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
                                    style={[styles.groupCard, isRTL && { flexDirection: 'row-reverse' }]}
                                    onPress={() => navigation.navigate('GroupDetails', { groupId: item._id, groupName: item.group_name })}
                                >
                                    <View style={[styles.groupCardLeft, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <View style={styles.groupIconCircle}>
                                            <Ionicons name="people" size={16} color="#2563EB" />
                                        </View>
                                        <View style={isRTL && { alignItems: 'flex-end' }}>
                                            <Text style={styles.groupName}>{item.group_name}</Text>
                                            <Text style={styles.groupDate}>{t('created_date', { date: new Date(item.created_at).toLocaleDateString() })}</Text>
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
                        ListEmptyComponent={<Text style={styles.emptyText}>{t('no_groups')}</Text>}
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
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        maxHeight: '50%',
        width: '100%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    pickerItem: {
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    pickerItemText: {
        fontSize: 18,
        color: '#333',
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
        bottom: 30,
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
