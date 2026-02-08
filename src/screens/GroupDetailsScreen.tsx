
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { Group, Pilgrim } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';
import GroupCodeModal from '../components/GroupCodeModal';

import ComposeMessageModal from '../components/ComposeMessageModal';
import { Ionicons } from '@expo/vector-icons';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen({ route, navigation }: Props) {
    const { groupId, groupName } = route.params;
    const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const { showToast } = useToast();

    // Add Pilgrim Form State
    const [newPilgrimName, setNewPilgrimName] = useState('');
    const [newPilgrimNationalId, setNewPilgrimNationalId] = useState('');
    const [newPilgrimPhone, setNewPilgrimPhone] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            setLoading(true);
            const response = await api.get(`/groups/${groupId}`);
            // Backend returns group object directly for single group
            if (response.data) {
                setPilgrims(response.data.pilgrims || []);
            }
        } catch (error: any) {
            console.error(error);
            showToast('Failed to load pilgrims', 'error', { title: 'Error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    const handleAddPilgrim = async () => {
        if (!newPilgrimName || !newPilgrimNationalId) {
            showToast('Name and National ID are required.', 'error', { title: 'Missing Info' });
            return;
        }

        setAdding(true);
        try {
            const response = await api.post(`/groups/${groupId}/add-pilgrim`, {
                full_name: newPilgrimName,
                national_id: newPilgrimNationalId,
                phone_number: newPilgrimPhone,
                age: 30,
                gender: 'male',
                medical_history: 'None'
            });

            if (response.data.success) {
                showToast(`${newPilgrimName} has been added to the group.`, 'success', { title: 'Pilgrim Added!' });
                setShowAddModal(false);
                setNewPilgrimName('');
                setNewPilgrimNationalId('');
                setNewPilgrimPhone('');
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

    // Invite Pilgrim State
    const [showInvitePilgrimModal, setShowInvitePilgrimModal] = useState(false);
    const [invitePilgrimEmail, setInvitePilgrimEmail] = useState('');
    const [invitingPilgrim, setInvitingPilgrim] = useState(false);

    // Group Code Modal State
    const [showGroupCodeModal, setShowGroupCodeModal] = useState(false);

    const handleInvitePilgrim = async () => {
        if (!invitePilgrimEmail) {
            showToast('Please enter an email address', 'error');
            return;
        }

        setInvitingPilgrim(true);
        try {
            await api.post(`/groups/${groupId}/invite-pilgrim`, { email: invitePilgrimEmail });
            showToast('Pilgrim invitation sent successfully', 'success');
            setShowInvitePilgrimModal(false);
            setInvitePilgrimEmail('');
        } catch (error: any) {
            console.error('Invite pilgrim error:', error);
            showToast(error.response?.data?.message || 'Failed to send invitation', 'error');
        } finally {
            setInvitingPilgrim(false);
        }
    };

    const handleRemovePilgrim = (pilgrimId: string, pilgrimName: string) => {
        setSelectedPilgrim({ id: pilgrimId, name: pilgrimName });
        setShowDeletePilgrimModal(true);
    };

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

                {/* Stats Row */}
                <View style={styles.statsRow}>
                    <Text style={styles.statsLabel}>Total Pilgrims</Text>
                    <Text style={styles.statsCount}>{pilgrims.length}</Text>
                </View>

                {/* Minimal Section Header */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pilgrim List</Text>
                    {/* Actions moved to FAB */}
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#2563EB" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={pilgrims}
                        keyExtractor={item => item._id}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <View style={styles.pilgrimCard}>
                                <View style={styles.pilgrimInfo}>
                                    <View style={styles.avatarSmall}>
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
                                <TouchableOpacity
                                    onPress={() => handleRemovePilgrim(item._id, item.full_name)}
                                    style={styles.deletePilgrimButton}
                                >
                                    <Ionicons name="close-circle-outline" size={22} color="#CBD5E1" />
                                </TouchableOpacity>
                            </View>
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
                            onPress={() => { setShowActionMenu(false); setShowBroadcastModal(true); }}
                        >
                            <Ionicons name="megaphone-outline" size={22} color="#334155" style={styles.actionOptionIcon} />
                            <Text style={styles.actionOptionText}>Broadcast Message</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionOption}
                            onPress={() => { setShowActionMenu(false); setShowInvitePilgrimModal(true); }}
                        >
                            <Ionicons name="mail-outline" size={22} color="#334155" style={styles.actionOptionIcon} />
                            <Text style={styles.actionOptionText}>Invite Pilgrim via Email</Text>
                        </TouchableOpacity>

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
                            <Text style={styles.modalTitle}>Add New Pilgrim</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            <Text style={styles.label}>Full Name</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="e.g. Ahmed Ali"
                                value={newPilgrimName}
                                onChangeText={setNewPilgrimName}
                            />

                            <Text style={styles.label}>National ID</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="National ID or Passport"
                                value={newPilgrimNationalId}
                                onChangeText={setNewPilgrimNationalId}
                                keyboardType="numeric"
                            />

                            <Text style={styles.label}>Phone Number (Optional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+966..."
                                value={newPilgrimPhone}
                                onChangeText={setNewPilgrimPhone}
                                keyboardType="phone-pad"
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

            {/* Invite Pilgrim Modal */}
            <Modal
                visible={showInvitePilgrimModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowInvitePilgrimModal(false)}
            >
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                    <View style={styles.modalContentSmall}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Invite Pilgrim</Text>
                            <TouchableOpacity onPress={() => setShowInvitePilgrimModal(false)}>
                                <Text style={styles.closeText}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>Pilgrim's Email Address</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="pilgrim@example.com"
                            value={invitePilgrimEmail}
                            onChangeText={setInvitePilgrimEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TouchableOpacity
                            style={[styles.addButton, invitingPilgrim && styles.buttonDisabled]}
                            onPress={handleInvitePilgrim}
                            disabled={invitingPilgrim}
                        >
                            <Text style={styles.addButtonText}>{invitingPilgrim ? "Sending..." : "Send Invitation"}</Text>
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
        color: '#0F172A', // Slate 900
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
        color: '#94A3B8', // Slate 400 - Uppercase style label
        textTransform: 'uppercase',
        letterSpacing: 1,
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
