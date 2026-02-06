import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { Group, Pilgrim } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useToast } from '../components/ToastContext';
import ConfirmationModal from '../components/ConfirmationModal';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen({ route, navigation }: Props) {
    const { groupId, groupName } = route.params;
    const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const { showToast } = useToast();

    // Add Pilgrim Form State
    const [newPilgrimName, setNewPilgrimName] = useState('');
    const [newPilgrimNationalId, setNewPilgrimNationalId] = useState('');
    const [newPilgrimPhone, setNewPilgrimPhone] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchGroupDetails = async () => {
        try {
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

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.header} edges={['top']}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Text style={styles.backButtonText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{groupName}</Text>
                <View style={{ width: 40 }} />
            </SafeAreaView>

            <View style={styles.content}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryLabel}>Total Pilgrims</Text>
                    <Text style={styles.summaryCount}>{pilgrims.length}</Text>
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Pilgrim List</Text>
                    <TouchableOpacity onPress={() => setShowInviteModal(true)}>
                        <Text style={styles.inviteLink}>+ Invite Moderator</Text>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color="#007AFF" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={pilgrims}
                        keyExtractor={item => item._id}
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
                                                <View style={[styles.statusDot, { backgroundColor: '#4CD964' }]} />
                                                <Text style={styles.statusText}>Online</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRemovePilgrim(item._id, item.full_name)}
                                    style={styles.deletePilgrimButton}
                                >
                                    <Text style={styles.deletePilgrimText}>✕</Text>
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

            <TouchableOpacity
                style={styles.fab}
                onPress={() => setShowAddModal(true)}
            >
                <Text style={styles.fabText}>+</Text>
            </TouchableOpacity>

            {/* Add Pilgrim Modal */}
            <Modal
                visible={showAddModal}
                animationType="slide"
                transparent={true}
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
        </View >
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
        paddingHorizontal: 15,
        paddingBottom: 15,
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    backButton: {
        padding: 5,
    },
    backButtonText: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    summaryCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        marginBottom: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    summaryLabel: {
        color: '#666',
        fontSize: 14,
        marginBottom: 5,
    },
    summaryCount: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    inviteLink: {
        fontSize: 14,
        color: '#007AFF',
        fontWeight: '600',
    },
    modalContentSmall: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        width: '90%',
        alignSelf: 'center',
    },
    pilgrimCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    pilgrimInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarSmall: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    avatarTextSmall: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#007AFF',
    },
    pilgrimName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
    },
    pilgrimId: {
        fontSize: 12,
        color: '#999',
    },
    statusIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 12,
        color: '#666',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 25,
        borderTopRightRadius: 25,
        padding: 24,
        height: '70%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#333',
    },
    closeText: {
        fontSize: 24,
        color: '#999',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 8,
        marginTop: 10,
    },
    input: {
        backgroundColor: '#f9f9f9',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#333',
        borderWidth: 1,
        borderColor: '#eee',
    },
    addButton: {
        backgroundColor: '#007AFF',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 40,
    },
    buttonDisabled: {
        backgroundColor: '#A0C4FF',
    },
    addButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    deletePilgrimButton: {
        marginLeft: 8,
        backgroundColor: '#FFEBEE',
        borderRadius: 16,
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
    },
    deletePilgrimText: {
        fontSize: 14,
        color: '#FF3B30',
        fontWeight: 'bold',
        marginTop: -2, // Micro-adjustment to visually center the X
    },
    deleteGroupButton: {
        backgroundColor: '#FFE5E5',
        borderRadius: 12,
        paddingVertical: 16,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 40,
        borderWidth: 1,
        borderColor: '#FF3B30',
    },
    deleteGroupText: {
        color: '#FF3B30',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
