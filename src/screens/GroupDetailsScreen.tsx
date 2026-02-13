
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking, Share, RefreshControl, Switch, Animated as RNAnimated } from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useIsFocused } from '@react-navigation/native';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { Group, Pilgrim } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import GroupCodeModal from '../components/GroupCodeModal';
import Map from '../components/Map';
import ComposeMessageModal from '../components/ComposeMessageModal';
import { Ionicons } from '@expo/vector-icons';
import CallModal from '../components/CallModal';
import { useTranslation } from 'react-i18next';
import { socketService } from '../services/socket';
import { useIsRTL } from '../hooks/useIsRTL';
import { openNavigation } from '../utils/openNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen({ route, navigation }: Props) {
    // Call state
    const [callModalVisible, setCallModalVisible] = useState(false);
    const [callTarget, setCallTarget] = useState<{ id: string; name: string } | null>(null);
    const [isCaller, setIsCaller] = useState(false);
    const { groupId, groupName, focusPilgrimId, openProfile } = route.params;
    const { t, i18n } = useTranslation();
    const isRTL = useIsRTL();
    const didAutoFocus = useRef(false);
    const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const { showToast } = useToast();
    const [selectedPilgrimId, setSelectedPilgrimId] = useState<string | null>(null);
    const [showDirectModal, setShowDirectModal] = useState(false);
    const [directRecipientId, setDirectRecipientId] = useState<string | null>(null);
    const [directRecipientName, setDirectRecipientName] = useState('');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [profilePilgrim, setProfilePilgrim] = useState<Pilgrim | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const isFocused = useIsFocused();

    // Form States
    const [existingIdentifier, setExistingIdentifier] = useState('');
    const [adding, setAdding] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    // Modal States
    const [showActionMenu, setShowActionMenu] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showGroupCodeModal, setShowGroupCodeModal] = useState(false);
    const [showDeletePilgrimModal, setShowDeletePilgrimModal] = useState(false);
    const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);
    const [selectedPilgrim, setSelectedPilgrim] = useState<{ id: string, name: string } | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [allowPilgrimNav, setAllowPilgrimNav] = useState(false);

    const fetchGroupDetails = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) setLoading(true);
            const response = await api.get(`/groups/${groupId}`);
            if (response.data) {
                setPilgrims(response.data.pilgrims || []);
                setAllowPilgrimNav(response.data.allow_pilgrim_navigation || false);
            }
        } catch (error: any) {
            console.error(error);
            if (!options?.silent) showToast(t('failed_load_pilgrims'), 'error', { title: t('error') });
        } finally {
            if (!options?.silent) setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    useEffect(() => {
        if (!focusPilgrimId || didAutoFocus.current || pilgrims.length === 0) return;
        const found = pilgrims.find(p => p._id === focusPilgrimId);
        if (!found) return;
        didAutoFocus.current = true;
        setSelectedPilgrimId(found._id);
        if (openProfile) {
            setProfilePilgrim(found);
            setShowProfileModal(true);
        }
    }, [focusPilgrimId, openProfile, pilgrims]);

    useEffect(() => {
        if (!isFocused) return;
        // const interval = setInterval(() => fetchGroupDetails({ silent: true }), 15000); // Poll removed for socket testing

        socketService.connect();
        socketService.joinGroup(groupId);

        const handleLocationUpdate = (data: any) => {
            if (data.pilgrimId) {
                setPilgrims(prev => prev.map(p =>
                    p._id === data.pilgrimId ? {
                        ...p,
                        location: { lat: data.lat, lng: data.lng, timestamp: new Date() },
                        isSos: data.isSos // Update SOS status
                    } : p
                ));
            }
        };

        const handleSOS = (data: any) => {
            Alert.alert(
                t('sos_alert'),
                `${t('pilgrim')} sent SOS!`,
                [
                    { text: t('dismiss'), style: 'cancel' },
                    { text: t('location'), onPress: () => setSelectedPilgrimId(data.pilgrimId) }
                ]
            );
        };

        socketService.onLocationUpdate(handleLocationUpdate);
        socketService.onSOSAlert(handleSOS);

        return () => {
            // clearInterval(interval);
            socketService.leaveGroup(groupId);
            socketService.offLocationUpdate(handleLocationUpdate);
            socketService.offSOSAlert(handleSOS);
        };
    }, [isFocused, groupId]);

    const handleAddPilgrim = async () => {
        if (!existingIdentifier.trim()) {
            showToast(t('identifier_required'), 'error', { title: t('missing_info') });
            return;
        }
        setAdding(true);
        try {
            const response = await api.post(`/groups/${groupId}/add-pilgrim`, {
                identifier: existingIdentifier.trim()
            });
            if (response.data.success) {
                showToast(t('pilgrim_added_success', { name: existingIdentifier.trim() }), 'success', { title: t('pilgrim_added_title') });
                setShowAddModal(false);
                setExistingIdentifier('');
                fetchGroupDetails();
            }
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_add_pilgrim'), 'error');
        } finally {
            setAdding(false);
        }
    };

    const handleInviteModerator = async () => {
        if (!inviteEmail) {
            showToast(t('enter_email'), 'error');
            return;
        }
        setInviting(true);
        try {
            await api.post(`/groups/${groupId}/invite`, { email: inviteEmail });
            showToast(t('invitation_sent'), 'success');
            setShowInviteModal(false);
            setInviteEmail('');
        } catch (error: any) {
            showToast(error.response?.data?.message || t('failed_send_invitation'), 'error');
        } finally {
            setInviting(false);
        }
    };

    const confirmRemovePilgrim = async () => {
        if (!selectedPilgrim) return;
        try {
            await api.post(`/groups/${groupId}/remove-pilgrim`, { user_id: selectedPilgrim.id });
            showToast(t('pilgrim_removed_success'), 'success');
            setPilgrims(prev => prev.filter(p => p._id !== selectedPilgrim.id));
        } catch (error: any) {
            showToast(t('failed_remove_pilgrim'), 'error');
        } finally {
            setShowDeletePilgrimModal(false);
            setSelectedPilgrim(null);
        }
    };

    const handleShareLocation = async (pilgrim: Pilgrim) => {
        if (!pilgrim.location?.lat || !pilgrim.location?.lng) {
            showToast(t('no_location_data'), 'error');
            return;
        }
        const url = `https://www.google.com/maps/search/?api=1&query=${pilgrim.location.lat},${pilgrim.location.lng}`;
        try {
            await Share.share({
                message: `${t('pilgrim_location')} (${pilgrim.full_name}): ${url}`,
                url: url, // iOS
            });
        } catch (error) {
            console.log(error);
        }
    };

    const confirmDeleteGroup = async () => {
        try {
            setLoading(true);
            await api.delete(`/groups/${groupId}`);
            showToast(t('group_deleted_success'), 'success');
            setShowDeleteGroupModal(false);
            navigation.goBack();
        } catch (error: any) {
            showToast(t('failed_delete_group'), 'error');
            setLoading(false);
            setShowDeleteGroupModal(false);
        }
    };

    const pilgrimsWithLocation = pilgrims.filter(p => p.location && p.location.lat && p.location.lng);
    const mapMarkers = pilgrimsWithLocation.map(p => ({
        id: p._id,
        latitude: p.location!.lat,
        longitude: p.location!.lng,
        title: p.full_name,
        description: `${t('battery')}: ${p.battery_percent || '?'}%`,
        pinColor: (p as any).isSos ? 'red' : 'blue' // Use red for SOS
    }));

    const getInitialRegion = () => {
        if (!pilgrimsWithLocation.length) return undefined;
        const lats = pilgrimsWithLocation.map(p => p.location!.lat);
        const lngs = pilgrimsWithLocation.map(p => p.location!.lng);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const latitude = (minLat + maxLat) / 2;
        const longitude = (minLng + maxLng) / 2;
        const latitudeDelta = Math.max(0.01, (maxLat - minLat) * 1.5);
        const longitudeDelta = Math.max(0.01, (maxLng - minLng) * 1.5);
        return { latitude, longitude, latitudeDelta, longitudeDelta };
    };

    const selectedPilgrimForMap = selectedPilgrimId ? pilgrimsWithLocation.find(p => p._id === selectedPilgrimId) : undefined;
    const mapRegion = selectedPilgrimForMap ? {
        latitude: selectedPilgrimForMap.location!.lat,
        longitude: selectedPilgrimForMap.location!.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01
    } : getInitialRegion();

    const renderRightActions = useCallback((pilgrimId: string, pilgrimName: string) => {
        return (
            <TouchableOpacity
                style={styles.swipeDeleteBtn}
                onPress={() => {
                    setSelectedPilgrim({ id: pilgrimId, name: pilgrimName });
                    setShowDeletePilgrimModal(true);
                }}
            >
                <Ionicons name="trash" size={22} color="white" />
                <Text style={styles.swipeDeleteText}>Remove</Text>
            </TouchableOpacity>
        );
    }, []);

    return (
        <GestureHandlerRootView style={styles.container}>
            <SafeAreaView style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]} edges={['top']}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{groupName}</Text>
                <TouchableOpacity onPress={() => setShowDeleteGroupModal(true)} style={styles.backButton}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                </TouchableOpacity>
            </SafeAreaView>

            <View style={styles.content}>
                <View style={styles.mapCard}>
                    <Map
                        initialRegion={mapRegion}
                        markers={mapMarkers}
                        highlightedMarkerId={selectedPilgrimId}
                        followsUserLocation={false}
                        showsUserLocation={false}
                    />
                </View>

                <View style={[styles.statsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={styles.statsLabel}>{t('total_pilgrims')}</Text>
                    <Text style={styles.statsCount}>{pilgrims.length}</Text>
                </View>

                <View style={[styles.navToggleRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[{ flexDirection: 'row', alignItems: 'center' }, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Ionicons name="navigate-outline" size={16} color="#475569" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 6 }} />
                        <Text style={styles.navToggleLabel}>Allow pilgrims to navigate to you</Text>
                    </View>
                    <Switch
                        value={allowPilgrimNav}
                        onValueChange={async (val) => {
                            setAllowPilgrimNav(val);
                            try {
                                await api.put(`/groups/${groupId}`, { allow_pilgrim_navigation: val });
                            } catch {
                                setAllowPilgrimNav(!val);
                            }
                        }}
                        trackColor={{ false: '#E2E8F0', true: '#93C5FD' }}
                        thumbColor={allowPilgrimNav ? '#2563EB' : '#CBD5E1'}
                    />
                </View>

                <View style={[styles.messageActions, isRTL && { flexDirection: 'row-reverse' }]}>
                    <TouchableOpacity style={styles.messageActionBtn} onPress={() => setShowBroadcastModal(true)}>
                        <Ionicons name="megaphone-outline" size={16} color="#2563EB" />
                        <Text style={styles.messageActionText} numberOfLines={1}>{t('broadcast_message')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.messageActionBtn} onPress={() => navigation.navigate('ModeratorMessagesScreen', { groupId, groupName })}>
                        <Ionicons name="chatbubbles-outline" size={16} color="#2563EB" />
                        <Text style={styles.messageActionText} numberOfLines={1}>{t('sent_messages')}</Text>
                    </TouchableOpacity>
                </View>

                <View style={[styles.sectionHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={styles.sectionTitle}>{t('pilgrim_list')}</Text>
                </View>

                <View style={[styles.searchContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Ionicons name="search" size={18} color="#94A3B8" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 8 }} />
                    <TextInput
                        style={[styles.searchInput, isRTL && { textAlign: 'right' }]}
                        placeholder={t('search_placeholder_pilgrim')}
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={pilgrims.filter(p => {
                            if (!searchQuery.trim()) return true;
                            const q = searchQuery.toLowerCase().trim();
                            return (
                                p.full_name.toLowerCase().includes(q) ||
                                p.national_id.toLowerCase().includes(q) ||
                                p.phone_number.toLowerCase().includes(q)
                            );
                        })}
                        keyExtractor={item => item._id}
                        renderItem={({ item }) => (
                            <Swipeable
                                renderRightActions={() => renderRightActions(item._id, item.full_name)}
                                overshootRight={false}
                            >
                                <TouchableOpacity
                                    style={[styles.pilgrimCard, selectedPilgrimId === item._id && styles.pilgrimCardSelected, isRTL && { flexDirection: 'row-reverse' }]}
                                    onPress={() => setSelectedPilgrimId(item._id)}
                                    activeOpacity={0.9}
                                >
                                    <View style={[styles.pilgrimInfo, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <View style={[styles.avatarSmall, selectedPilgrimId === item._id && styles.avatarSmallSelected, { [isRTL ? 'marginLeft' : 'marginRight']: 12 }]}>
                                            <Text style={styles.avatarTextSmall}>{item.full_name.charAt(0)}</Text>
                                        </View>
                                        <View style={[{ flex: 1 }, isRTL && { alignItems: 'flex-end' }]}>
                                            <Text style={styles.pilgrimName} numberOfLines={1}>{item.full_name}</Text>
                                            <Text style={styles.pilgrimId} numberOfLines={1}>{t('national_id')}: {item.national_id}</Text>
                                            {item.location && (
                                                <View style={[styles.statusIndicator, isRTL && { flexDirection: 'row-reverse' }]}>
                                                    <View style={[styles.statusDot, { backgroundColor: '#10B981', [isRTL ? 'marginLeft' : 'marginRight']: 4 }]} />
                                                    <Text style={styles.statusText}>{t('active')}</Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    <View style={[styles.pilgrimActions, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <TouchableOpacity style={styles.pilgrimIconBtn} onPress={() => { setProfilePilgrim(item); setShowProfileModal(true); }}>
                                            <Ionicons name="person-outline" size={18} color="#475569" />
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.pilgrimIconBtn, styles.pilgrimIconBtnPrimary]} onPress={() => { setSelectedPilgrimId(item._id); setDirectRecipientId(item._id); setDirectRecipientName(item.full_name); setShowDirectModal(true); }}>
                                            <Ionicons name="megaphone-outline" size={18} color="white" />
                                        </TouchableOpacity>
                                        {item.location && (
                                            <TouchableOpacity style={[styles.pilgrimIconBtn, { backgroundColor: '#10B981' }]} onPress={() => openNavigation(item.location!.lat, item.location!.lng, item.full_name)}>
                                                <Ionicons name="navigate-outline" size={18} color="white" />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </Swipeable>
                        )}
                        contentContainerStyle={{ paddingBottom: 100, flexGrow: 1 }}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => { setRefreshing(true); fetchGroupDetails({ silent: true }); }}
                                colors={['#2563EB']}
                                tintColor="#2563EB"
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <View style={styles.emptyIconCircle}>
                                    <Ionicons name="people-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text style={styles.emptyTitle}>{t('no_pilgrims_group')}</Text>
                                <Text style={styles.emptySubtitle}>{t('add_pilgrims_hint') || 'Tap the + button below to add pilgrims'}</Text>
                            </View>
                        }
                        ListFooterComponent={<View style={{ height: 20 }} />}
                    />
                )}

                {callTarget && (
                    <CallModal
                        visible={callModalVisible}
                        onClose={() => { setCallModalVisible(false); setCallTarget(null); }}
                        isCaller={isCaller}
                        remoteUser={callTarget}
                        socket={socketService.getSocket()}
                    />
                )}
            </View>

            <TouchableOpacity style={styles.fab} onPress={() => setShowActionMenu(true)}>
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>

            <Modal visible={showActionMenu} transparent={true} animationType="fade" onRequestClose={() => setShowActionMenu(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActionMenu(false)}>
                    <View style={styles.actionSheetContent}>
                        <Text style={styles.actionSheetTitle}>{t('group_options')}</Text>
                        <TouchableOpacity style={[styles.actionOption, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setShowActionMenu(false); setShowInviteModal(true); }}>
                            <Ionicons name="shield-checkmark-outline" size={22} color="#334155" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 16 }} />
                            <Text style={styles.actionOptionText}>{t('invite_moderator')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionOption, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setShowActionMenu(false); setShowAddModal(true); }}>
                            <Ionicons name="person-add-outline" size={22} color="#334155" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 16 }} />
                            <Text style={styles.actionOptionText}>{t('manually_add_pilgrim')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.actionOption, isRTL && { flexDirection: 'row-reverse' }]} onPress={() => { setShowActionMenu(false); setShowGroupCodeModal(true); }}>
                            <Ionicons name="qr-code-outline" size={22} color="#334155" style={{ [isRTL ? 'marginLeft' : 'marginRight']: 16 }} />
                            <Text style={styles.actionOptionText}>{t('view_group_code')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.cancelOption} onPress={() => setShowActionMenu(false)}>
                            <Text style={styles.cancelOptionText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ComposeMessageModal visible={showBroadcastModal} onClose={() => setShowBroadcastModal(false)} groupId={groupId} onSuccess={() => showToast(t('message_broadcasted'), 'success')} />
            <ComposeMessageModal
                visible={showDirectModal}
                onClose={() => { setShowDirectModal(false); setDirectRecipientId(null); setDirectRecipientName(''); }}
                groupId={groupId}
                recipientId={directRecipientId}
                submitPath="/messages/individual"
                title={directRecipientName ? `${t('alert_sent_success')} ${directRecipientName}` : t('send_alert')}
                onSuccess={() => showToast(t('alert_sent_success'), 'success')}
                onCall={directRecipientId ? () => {
                    setShowDirectModal(false);
                    setCallTarget({ id: directRecipientId, name: directRecipientName });
                    setIsCaller(true);
                    setCallModalVisible(true);
                } : undefined}
            />

            <Modal visible={showProfileModal} transparent={true} animationType="fade" onRequestClose={() => setShowProfileModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProfileModal(false)}>
                    <View style={styles.modalContentSmall}>
                        <View style={[styles.modalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.modalTitle}>{t('pilgrim_profile')}</Text>
                            <TouchableOpacity onPress={() => setShowProfileModal(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                        </View>
                        <View style={[styles.profileHeaderRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{profilePilgrim?.full_name?.charAt(0) || 'P'}</Text></View>
                            <View style={isRTL && { alignItems: 'flex-end' }}>
                                <Text style={styles.profileName}>{profilePilgrim?.full_name || '-'}</Text>
                                <Text style={styles.profileSub}>{profilePilgrim?.phone_number || t('no_phone')}</Text>
                            </View>
                        </View>
                        <View style={[styles.profileRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.profileLabel}>{t('national_id')}</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.national_id || '-'}</Text>
                        </View>
                        <View style={[styles.profileRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.profileLabel}>{t('email')}</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.email || '-'}</Text>
                        </View>
                        <View style={[styles.profileRow, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.profileLabel}>{t('battery')}</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.battery_percent !== undefined ? `${profilePilgrim.battery_percent}%` : '-'}</Text>
                        </View>
                        <View style={styles.modalActionsContainer}>
                            <View style={[styles.primaryActionsRow, isRTL && { flexDirection: 'row-reverse' }]}>
                                {profilePilgrim?.phone_number && (
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.callBuildAction]}
                                        onPress={() => Linking.openURL(`tel:${profilePilgrim.phone_number}`)}
                                    >
                                        <Ionicons name="call" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>{t('call_pilgrim')}</Text>
                                    </TouchableOpacity>
                                )}

                                {profilePilgrim?.location?.lat !== undefined && profilePilgrim?.location?.lng !== undefined && (
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.shareBuildAction]}
                                        onPress={() => profilePilgrim && handleShareLocation(profilePilgrim)}
                                    >
                                        <Ionicons name="share-outline" size={20} color="white" />
                                        <Text style={styles.actionButtonText}>{t('share_location')}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            <TouchableOpacity
                                style={[styles.removeButton, isRTL && { flexDirection: 'row-reverse' }]}
                                onPress={() => { setShowProfileModal(false); setSelectedPilgrim({ id: profilePilgrim!._id, name: profilePilgrim!.full_name }); setShowDeletePilgrimModal(true); }}
                            >
                                <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8, marginLeft: 8 }} />
                                <Text style={styles.removeButtonText}>{t('remove_pilgrim_title')}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            <Modal visible={showAddModal} transparent={true} animationType="slide" onRequestClose={() => setShowAddModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={[styles.modalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.modalTitle}>{t('add_pilgrim')}</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView>
                            <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('identifier_label')}</Text>
                            <TextInput
                                style={[styles.input, isRTL && { textAlign: 'right' }]}
                                placeholder={t('identifier_placeholder')}
                                value={existingIdentifier}
                                onChangeText={setExistingIdentifier}
                                autoCapitalize="none"
                            />
                            <TouchableOpacity style={[styles.addButton, adding && styles.buttonDisabled]} onPress={handleAddPilgrim} disabled={adding}>
                                <Text style={styles.addButtonText}>{adding ? t('adding') : t('add_pilgrim')}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <ConfirmationModal
                visible={showDeletePilgrimModal}
                title={t('remove_pilgrim_title')}
                message={t('remove_pilgrim_confirm', { name: selectedPilgrim?.name })}
                onConfirm={confirmRemovePilgrim}
                onCancel={() => setShowDeletePilgrimModal(false)}
                confirmText={t('remove')}
                isDestructive={true}
            />

            <ConfirmationModal
                visible={showDeleteGroupModal}
                title={t('delete_group_question', { groupName })}
                message={t('delete_group_confirm', { groupName })}
                onConfirm={confirmDeleteGroup}
                onCancel={() => setShowDeleteGroupModal(false)}
                confirmText={t('delete_group_link')}
                isDestructive={true}
            />

            <Modal visible={showInviteModal} transparent={true} animationType="fade" onRequestClose={() => setShowInviteModal(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <View style={[styles.modalHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                            <Text style={styles.modalTitle}>{t('invite_moderator')}</Text>
                            <TouchableOpacity onPress={() => setShowInviteModal(false)}><Text style={styles.closeText}>✕</Text></TouchableOpacity>
                        </View>
                        <Text style={[styles.label, isRTL && { textAlign: 'right' }]}>{t('email')}</Text>
                        <TextInput
                            style={[styles.input, isRTL && { textAlign: 'right' }]}
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <TouchableOpacity style={[styles.addButton, inviting && styles.buttonDisabled]} onPress={handleInviteModerator} disabled={inviting}>
                            <Text style={styles.addButtonText}>{inviting ? t('sending') : t('send_invitation')}</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            <GroupCodeModal visible={showGroupCodeModal} onClose={() => setShowGroupCodeModal(false)} groupId={groupId} groupName={groupName} />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: 'white',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 16,
        paddingTop: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF0F2',
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#1A1A1A',
        letterSpacing: 0.5,
    },
    content: {
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 24,
    },
    mapCard: {
        height: 220,
        backgroundColor: 'white',
        borderRadius: 16,
        overflow: 'hidden',
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 4,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'white',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    statsLabel: {
        fontSize: 15,
        color: '#64748B',
        fontWeight: '500',
    },
    statsCount: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    messageActions: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    messageActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: '#EFF6FF',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    messageActionText: {
        color: '#2563EB',
        fontWeight: '600',
        fontSize: 12,
        flexShrink: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    searchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        padding: 0,
    },
    pilgrimCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    pilgrimInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 8,
    },
    avatarSmall: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarTextSmall: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
    },
    pilgrimName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1E293B',
        marginBottom: 1,
    },
    pilgrimId: {
        fontSize: 12,
        color: '#94A3B8',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 2,
    },
    pilgrimCardSelected: {
        borderColor: '#2563EB',
        backgroundColor: '#EFF6FF',
    },
    avatarSmallSelected: {
        backgroundColor: '#DBEAFE',
    },
    pilgrimActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pilgrimIconBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pilgrimIconBtnPrimary: {
        backgroundColor: '#2563EB',
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    statusText: {
        fontSize: 11,
        color: '#64748B',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)',
        justifyContent: 'flex-end',
    },
    actionSheetContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        paddingBottom: 40,
    },
    actionSheetTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 20,
        textAlign: 'center',
    },
    actionOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    actionOptionText: {
        fontSize: 16,
        color: '#334155',
        fontWeight: '500',
    },
    cancelOption: {
        marginTop: 16,
        paddingVertical: 16,
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
    },
    cancelOptionText: {
        fontSize: 16,
        color: '#64748B',
        fontWeight: '600',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '85%',
    },
    modalContentSmall: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '90%',
        alignSelf: 'center',
        marginBottom: 'auto',
        marginTop: 'auto',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#0F172A',
    },
    closeText: {
        fontSize: 24,
        color: '#94A3B8',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 8,
        marginTop: 16,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 16,
        fontSize: 16,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    addButton: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        paddingVertical: 18,
        alignItems: 'center',
        marginTop: 40,
        marginBottom: 20,
    },
    buttonDisabled: {
        backgroundColor: '#93C5FD',
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    },
    profileHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    profileAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    profileAvatarText: {
        color: '#1E293B',
        fontWeight: '700',
        fontSize: 16,
    },
    profileName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    profileSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    profileRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F7',
    },
    profileLabel: {
        color: '#64748B',
        fontSize: 13,
        fontWeight: '600',
    },
    profileValue: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '600',
        maxWidth: '60%'
    },
    modalActionsContainer: {
        marginTop: 24,
        gap: 16,
    },
    primaryActionsRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        gap: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    callBuildAction: {
        backgroundColor: '#10B981', // Emerald 500
    },
    shareBuildAction: {
        backgroundColor: '#3B82F6', // Blue 500
    },
    actionButtonText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    removeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#FEF2F2', // Red 50
        borderWidth: 1,
        borderColor: '#FEE2E2', // Red 100
    },
    removeButtonText: {
        color: '#EF4444', // Red 500
        fontWeight: '600',
        fontSize: 14,
    },
    navToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    navToggleLabel: {
        fontSize: 13,
        color: '#475569',
        fontWeight: '500',
        flexShrink: 1,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: '600',
        color: '#475569',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#94A3B8',
        textAlign: 'center',
        paddingHorizontal: 30,
    },
    deleteGroupButton: {
        marginTop: 40,
        paddingVertical: 16,
        alignItems: 'center',
    },
    deleteGroupText: {
        color: '#EF4444',
        fontSize: 15,
        fontWeight: '600',
    },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        backgroundColor: '#2563EB',
        width: 56,
        height: 56,
        borderRadius: 28,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 6,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    deletePilgrimButton: {
        padding: 8,
        marginLeft: 8,
    },
    swipeDeleteBtn: {
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        width: 80,
        borderRadius: 12,
        marginBottom: 8,
        marginLeft: 8,
    },
    swipeDeleteText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
});
