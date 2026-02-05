import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { Group, Pilgrim } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'GroupDetails'>;

export default function GroupDetailsScreen({ route, navigation }: Props) {
    const { groupId, groupName } = route.params;
    const [pilgrims, setPilgrims] = useState<Pilgrim[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    // Add Pilgrim Form State
    const [newPilgrimName, setNewPilgrimName] = useState('');
    const [newPilgrimNationalId, setNewPilgrimNationalId] = useState('');
    const [newPilgrimPhone, setNewPilgrimPhone] = useState('');
    const [adding, setAdding] = useState(false);

    const fetchGroupDetails = async () => {
        try {
            setLoading(true);
            // using the same dashboard endpoint for now, filtering locally, 
            // OR ideally we should have a get_group_by_id endpoint.
            // For now, let's re-fetch the specific group details if possible or assume the backend provides one.
            // Checking backend routes... we might not have a specific 'get group details' for mobile optimized
            // actually group_routes.js has router.get('/:id', group_controller.get_group_by_id); logic? 
            // Let's try that.
            const response = await api.get(`/groups/${groupId}`);
            if (response.data.success) {
                // The backend likely returns the group object directly or wrapped
                const groupData: Group = response.data.data;
                setPilgrims(groupData.pilgrims || []);
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', 'Failed to load pilgrims');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGroupDetails();
    }, [groupId]);

    const handleAddPilgrim = async () => {
        if (!newPilgrimName || !newPilgrimNationalId) {
            Alert.alert('Missing Info', 'Name and National ID are required.');
            return;
        }

        setAdding(true);
        try {
            const response = await api.post(`/groups/${groupId}/add-pilgrim`, {
                full_name: newPilgrimName,
                national_id: newPilgrimNationalId,
                phone_number: newPilgrimPhone,
                // defaults
                age: 30,
                gender: 'male',
                medical_history: 'None'
            });

            if (response.data.success) {
                Alert.alert('Success', 'Pilgrim added successfully!');
                setShowAddModal(false);
                setNewPilgrimName('');
                setNewPilgrimNationalId('');
                setNewPilgrimPhone('');
                fetchGroupDetails(); // Refresh list
            }
        } catch (error: any) {
            console.error(error);
            Alert.alert('Error', error.response?.data?.message || 'Failed to add pilgrim');
        } finally {
            setAdding(false);
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

                <Text style={styles.sectionTitle}>Pilgrim List</Text>

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
                                    </View>
                                </View>
                                <View style={styles.statusIndicator}>
                                    <View style={[styles.statusDot, { backgroundColor: item.location ? '#4CD964' : '#FF9500' }]} />
                                    <Text style={styles.statusText}>{item.location ? 'Online' : 'Offline'}</Text>
                                </View>
                            </View>
                        )}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        ListEmptyComponent={<Text style={styles.emptyText}>No pilgrims in this group yet.</Text>}
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
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 15,
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
});
