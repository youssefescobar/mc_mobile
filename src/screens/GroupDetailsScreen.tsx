
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert, Linking } from 'react-native';
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

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen({ route, navigation }: Props) {
    const { groupId, groupName, focusPilgrimId, openProfile } = route.params;
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

    // Add Pilgrim Form State
    const [existingIdentifier, setExistingIdentifier] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchGroupDetails = async (options?: { silent?: boolean }) => {
        try {
            if (!options?.silent) setLoading(true);
            const response = await api.get(`/groups/${groupId}`);
            // Backend returns group object directly for single group
            if (response.data) {
                setPilgrims(response.data.pilgrims || []);
            }
        } catch (error: any) {
            console.error(error);
            if (!options?.silent) showToast('Failed to load pilgrims', 'error', { title: 'Error' });
        } finally {
            if (!options?.silent) setLoading(false);
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
        const interval = setInterval(() => fetchGroupDetails({ silent: true }), 15000);
        return () => clearInterval(interval);
    }, [isFocused, groupId]);

    const handleAddPilgrim = async () => {
        if (!existingIdentifier.trim()) {
            showToast('Email, phone number, or national ID is required.', 'error', { title: 'Missing Info' });
            return;
        }

        setAdding(true);
        try {
            const response = await api.post(`/groups/${groupId}/add-pilgrim`, {
                identifier: existingIdentifier.trim()
            });

            if (response.data.success) {
                const successName = existingIdentifier.trim();
                showToast(`${successName} has been added to the group.`, 'success', { title: 'Pilgrim Added!' });
                setShowAddModal(false);
                setExistingIdentifier('');
                fetchGroupDetails();
            }
        } catch (error: any) {
            console.error(error);
            showToast(error.response?.data?.message || 'Failed to add pilgrim', 'error', { title: 'Error' });
        } finally {
            setAdding(false);
        }
    };

    // Delete Confirmation State
    const [showDeletePilgrimModal, setShowDeletePilgrimModal] = useState(false);
    const [selectedPilgrim, setSelectedPilgrim] = useState<{ id: string, name: string } | null>(null);
    const [showDeleteGroupModal, setShowDeleteGroupModal] = useState(false);

    // Invite Moderator State
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviting, setInviting] = useState(false);

    const handleInviteModerator = async () => {
        if (!inviteEmail) {
            showToast('Please enter an email address', 'error');
            return;
        }

        setInviting(true);
        try {
            await api.post(`/groups/${groupId}/invite`, { email: inviteEmail });
            showToast('Invitation sent successfully', 'success');
            setShowInviteModal(false);
            setInviteEmail('');
        } catch (error: any) {
            console.error('Invite error:', error);
            showToast(error.response?.data?.message || 'Failed to send invitation', 'error');
        } finally {
            setInviting(false);
        }
    };

    // Group Code Modal State
    const [showGroupCodeModal, setShowGroupCodeModal] = useState(false);

    const handleRemovePilgrim = (pilgrimId: string, pilgrimName: string) => {
        setSelectedPilgrim({ id: pilgrimId, name: pilgrimName });
        setShowDeletePilgrimModal(true);
    };

    const pilgrimsWithLocation = pilgrims.filter(p => p.location && p.location.lat && p.location.lng);
    const mapMarkers = pilgrimsWithLocation.map(p => ({
        id: p._id,
        latitude: p.location!.lat,
        longitude: p.location!.lng,
        title: p.full_name,
        description: `Battery: ${p.battery_percent || '?'}%`
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

    const selectedPilgrimForMap = selectedPilgrimId
        ? pilgrimsWithLocation.find(p => p._id === selectedPilgrimId)
        : undefined;

    const mapRegion = selectedPilgrimForMap
        ? {
            latitude: selectedPilgrimForMap.location!.lat,
            longitude: selectedPilgrimForMap.location!.lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01
        }
        : getInitialRegion();

    const confirmRemovePilgrim = async () => {
        if (!selectedPilgrim) return;

        try {
            await api.post(`/groups/${groupId}/remove-pilgrim`, { user_id: selectedPilgrim.id });
            showToast('Pilgrim removed successfully', 'success');
            setPilgrims(prev => prev.filter(p => p._id !== selectedPilgrim.id));
        } catch (error: any) {
            showToast('Failed to remove pilgrim', 'error');
        } finally {
            setShowDeletePilgrimModal(false);
            setSelectedPilgrim(null);
        }
    };

    const handleDeleteGroup = async () => {
        setShowDeleteGroupModal(true);
    };

    const confirmDeleteGroup = async () => {
        try {
            setLoading(true);
            await api.delete(`/groups/${groupId}`);
            showToast('Group deleted successfully', 'success');
            setShowDeleteGroupModal(false);
            navigation.goBack();
        } catch (error: any) {
            showToast('Failed to delete group', 'error');
            setLoading(false);
            setShowDeleteGroupModal(false);
        }
    };

    // Action Menu State
    const [showActionMenu, setShowActionMenu] = useState(false);

    // ... (rest of logic) ...

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.header} edges={['top']}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1A1A1A" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{groupName}</Text>
                <View style={{ width: 32 }} />
            </SafeAreaView>

            <View style={styles.content}>
                {/* Map */}
                <View style={styles.mapCard}>
                    <Map
                        initialRegion={mapRegion}
                        markers={mapMarkers}
                        highlightedMarkerId={selectedPilgrimId}
                        followsUserLocation={false}
                        showsUserLocation={false}
                    />
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Total Pilgrims</Text>
                    <Text style={styles.statsCount}>{pilgrims.length}</Text>
                </View>

                {/* Message Action Buttons */}
                <View style={styles.messageActions}>
                    <TouchableOpacity
                        style={styles.messageActionBtn}
                        onPress={() => setShowBroadcastModal(true)}
                    >
                        <Ionicons name="megaphone-outline" size={18} color="#2563EB" />
                        <Text style={styles.messageActionText}>Broadcast Message</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.messageActionBtn}
                        onPress={() => navigation.navigate('ModeratorMessagesScreen', { groupId, groupName })}
                    >
                        <Ionicons name="chatbubbles-outline" size={18} color="#2563EB" />
                        <Text style={styles.messageActionText}>Sent Messages</Text>
                    </TouchableOpacity>
                </View>

                {/* Minimal Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pilgrim List</Text>
                </View>

                {/* Search Bar */}
                <View style={styles.searchContainer}>
                    <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search by name, ID, or phone..."
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
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.pilgrimCard, selectedPilgrimId === item._id && styles.pilgrimCardSelected]}
                                onPress={() => setSelectedPilgrimId(item._id)}
                                activeOpacity={0.9}
                            >
                                <View style={styles.pilgrimInfo}>
                                    <View style={[styles.avatarSmall, selectedPilgrimId === item._id && styles.avatarSmallSelected]}>
                                        <Text style={styles.avatarTextSmall}>{item.full_name.charAt(0)}</Text>
                                    </View>
                                    <View>
                                        <Text style={styles.pilgrimName}>{item.full_name}</Text>
                                        <Text style={styles.pilgrimId}>ID: {item.national_id}</Text>
                                        {item.location && (
                                            <View style={styles.statusIndicator}>
                                                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                                <Text style={styles.statusText}>Online</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <View style={styles.pilgrimActions}>
                                    <TouchableOpacity
                                        style={styles.pilgrimActionButton}
                                        onPress={() => {
                                            setProfilePilgrim(item);
                                            setShowProfileModal(true);
                                        }}
                                    >
                                        <Text style={styles.pilgrimActionText}>Show Profile</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.pilgrimActionButton, styles.pilgrimActionPrimary]}
                                        onPress={() => {
                                            setSelectedPilgrimId(item._id);
                                            setDirectRecipientId(item._id);
                                            setDirectRecipientName(item.full_name);
                                            setShowDirectModal(true);
                                        }}
                                    >
                                        <Text style={[styles.pilgrimActionText, styles.pilgrimActionTextPrimary]}>Send Alert</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        )}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No pilgrims in this group yet.</Text>}
                        ListFooterComponent={
                            <TouchableOpacity
                                style={styles.deleteGroupButton}
                                onPress={handleDeleteGroup}
                            >
                                <Text style={styles.deleteGroupText}>Delete Group</Text>
                            </TouchableOpacity>
                        }
                    />
                )}
            </View>

            {/* FAB triggers Action Menu */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowActionMenu(true)}
            >
                <Ionicons name="add" size={30} color="white" />
            </TouchableOpacity>

            {/* Action Menu Modal (Bottom Sheet Style) */}
            <Modal
                visible={showActionMenu}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowActionMenu(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowActionMenu(false)}
                >
                    <View style={styles.actionSheetContent}>
                        <Text style={styles.actionSheetTitle}>Group Options</Text>

                        <TouchableOpacity
                            style={styles.actionOption}
                            onPress={() => { setShowActionMenu(false); setShowInviteModal(true); }}
                        >
                            <Ionicons name="shield-checkmark-outline" size={22} color="#334155" style={styles.actionOptionIcon} />
                            <Text style={styles.actionOptionText}>Invite Moderator</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionOption}
                            onPress={() => { setShowActionMenu(false); setShowAddModal(true); }}
                        >
                            <Ionicons name="person-add-outline" size={22} color="#334155" style={styles.actionOptionIcon} />
                            <Text style={styles.actionOptionText}>Manually Add Pilgrim</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionOption}
                            onPress={() => { setShowActionMenu(false); setShowGroupCodeModal(true); }}
                        >
                            <Ionicons name="qr-code-outline" size={22} color="#334155" style={styles.actionOptionIcon} />
                            <Text style={styles.actionOptionText}>View Group Code</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.cancelOption}
                            onPress={() => setShowActionMenu(false)}
                        >
                            <Text style={styles.cancelOptionText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ComposeMessageModal
                visible={showBroadcastModal}
                onClose={() => setShowBroadcastModal(false)}
                groupId={groupId}
                onSuccess={() => showToast('Message broadcasted successfully', 'success')}
            />
            <ComposeMessageModal
                visible={showDirectModal}
                onClose={() => {
                    setShowDirectModal(false);
                    setDirectRecipientId(null);
                    setDirectRecipientName('');
                }}
                groupId={groupId}
                recipientId={directRecipientId}
                submitPath="/messages/individual"
                title={directRecipientName ? `Alert ${directRecipientName}` : 'Send Alert'}
                onSuccess={() => showToast('Alert sent successfully', 'success')}
            />

            {/* Pilgrim Profile Modal */}
            <Modal
                visible={showProfileModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowProfileModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowProfileModal(false)}
                >
                    <View style={styles.modalContentSmall}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Pilgrim Profile</Text>
                            <TouchableOpacity onPress={() => setShowProfileModal(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.profileHeaderRow}>
                            <View style={styles.profileAvatar}>
                                <Text style={styles.profileAvatarText}>
                                    {profilePilgrim?.full_name?.charAt(0) || 'P'}
                                </Text>
                            </View>
                            <View>
                                <Text style={styles.profileName}>{profilePilgrim?.full_name || '-'}</Text>
                                <Text style={styles.profileSub}>{profilePilgrim?.phone_number || 'No phone on file'}</Text>
                            </View>
                        </View>

                        <View style={styles.profileRow}>
                            <Text style={styles.profileLabel}>National ID</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.national_id || '-'}</Text>
                        </View>
                        <View style={styles.profileRow}>
                            <Text style={styles.profileLabel}>Email</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.email || '-'}</Text>
                        </View>
                        <View style={styles.profileRow}>
                            <Text style={styles.profileLabel}>Battery</Text>
                            <Text style={styles.profileValue}>{profilePilgrim?.battery_percent !== undefined ? `${profilePilgrim.battery_percent}%` : '-'}</Text>
                        </View>
                        {profilePilgrim?.phone_number && (
                            <View style={styles.profileActionRow}>
                                <TouchableOpacity
                                    style={styles.callButton}
                                    onPress={() => Linking.openURL(`tel:${profilePilgrim.phone_number}`)}
                                >
                                    <Ionicons name="call" size={16} color="white" style={{ marginRight: 6 }} />
                                    <Text style={styles.callButtonText}>Call Pilgrim</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
            {/* Add Pilgrim Modal */}
            <Modal
                visible={showAddModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowAddModal(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Add Pilgrim</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.label}>Email, Phone, or National ID</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. user@example.com, +966..., or ID"
                                value={existingIdentifier}
                                onChangeText={setExistingIdentifier}
                                autoCapitalize="none"
                            />

                            <TouchableOpacity
                                style={[styles.addButton, adding && styles.buttonDisabled]}
                                onPress={handleAddPilgrim}
                                disabled={adding}
                            >
                                <Text style={styles.addButtonText}>{adding ? "Adding..." : "Add Pilgrim"}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>

            </Modal>
            {/* Confirmation Modals */}
            <ConfirmationModal
                visible={showDeletePilgrimModal}
                title="Remove Pilgrim"
                message={`Are you sure you want to remove ${selectedPilgrim?.name} from this group?`}
                onConfirm={confirmRemovePilgrim}
                onCancel={() => setShowDeletePilgrimModal(false)}
                confirmText="Remove"
                isDestructive={true}
            />

            <ConfirmationModal
                visible={showDeleteGroupModal}
                title="Delete Group"
                message={`Are you sure you want to delete "${groupName}"? This action cannot be undone.`}
                onConfirm={confirmDeleteGroup}
                onCancel={() => setShowDeleteGroupModal(false)}
                confirmText="Delete Group"
                isDestructive={true}
            />

            {/* Invite Moderator Modal */}
            <Modal
                visible={showInviteModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowInviteModal(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Invite Moderator</Text>
                            <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity
                            style={[styles.addButton, inviting && styles.buttonDisabled]}
                            onPress={handleInviteModerator}
                            disabled={inviting}
                        >
                            <Text style={styles.addButtonText}>{inviting ? "Sending..." : "Send Invitation"}</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Group Code Modal */}
            <GroupCodeModal
                visible={showGroupCodeModal}
                onClose={() => setShowGroupCodeModal(false)}
                groupId={groupId}
                groupName={groupName}
            />
        </View >
    );
}

const styles = StyleSheet.create({
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
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA', // Professional light grey
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
    backButtonText: {
        fontSize: 24,
        color: '#1A1A1A', // Darker, less "link-blue"
        fontWeight: '300',
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
        color: '#64748B', // Slate 500
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
        gap: 6,
        backgroundColor: '#EFF6FF',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DBEAFE',
    },
    messageActionText: {
        color: '#2563EB',
        fontWeight: '600',
        fontSize: 13,
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
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9', // Very subtle border
    },
    pilgrimInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatarSmall: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: '#F1F5F9', // Slate 100
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    avatarTextSmall: {
        fontSize: 16,
        fontWeight: '600',
        color: '#475569', // Slate 600
    },
    pilgrimName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1E293B', // Slate 800
        marginBottom: 2,
    },
    pilgrimId: {
        fontSize: 13,
        color: '#94A3B8', // Slate 400
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
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
        gap: 8,
    },
    statusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: '#64748B',
    },
    deletePilgrimButton: {
        padding: 8,
        marginLeft: 8,
    },
    pilgrimActionButton: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        minWidth: 110,
        alignItems: 'center',
    },
    pilgrimActionPrimary: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
        elevation: 3,
    },
    pilgrimActionText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#334155',
    },
    pilgrimActionTextPrimary: {
        color: 'white',
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
    profileActionRow: {
        marginTop: 14,
        alignItems: 'flex-start',
    },
    callButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10B981',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
    },
    callButtonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 14,
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
    deletePilgrimText: {
        fontSize: 18,
        color: '#CBD5E1', // Very subtle X, turns red on action if needed, but keeping it neutral until pressed helps minimalism
    },
    emptyText: {
        textAlign: 'center',
        color: '#94A3B8',
        marginTop: 40,
        fontSize: 15,
    },
    fab: {
        position: 'absolute',
        bottom: 32,
        right: 24,
        backgroundColor: '#2563EB', // Blue 600
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
    fabText: {
        color: 'white',
        fontSize: 32,
        marginTop: -4,
        fontWeight: '300',
    },
    // Modal & Sheet Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.4)', // Slate 900 with opacity
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
        height: '85%', // Taller for add form
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
    // Action Sheet Specific
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
    actionOptionIcon: {
        marginRight: 16,
        // Assuming Ionicons are used here
    },
    actionOptionText: {
        fontSize: 16,
        color: '#334155', // Slate 700
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
    // Form Inputs
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 32,
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
    deleteGroupButton: {
        marginTop: 40,
        paddingVertical: 16,
        alignItems: 'center',
    },
    deleteGroupText: {
        color: '#EF4444', // Red 500
        fontSize: 15,
        fontWeight: '600',
    },
});
