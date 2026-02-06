import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, ActivityIndicator, Keyboard, TouchableWithoutFeedback, KeyboardAvoidingView, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { useToast } from '../components/ToastContext';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateGroup'>;

export default function CreateGroupScreen({ navigation }: Props) {
    const [groupName, setGroupName] = useState('');
    const [loading, setLoading] = useState(false);
    const { showToast } = useToast();

    const handleCreateGroup = async () => {
        const trimmedName = groupName.trim();

        if (!trimmedName) {
            showToast('Please enter a group name', 'error', { title: 'Missing Name' });
            return;
        }

        if (trimmedName.length < 3) {
            showToast('Group name must be at least 3 characters long', 'error', { title: 'Name Too Short' });
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/groups/create', {
                group_name: groupName
            });

            if (response.data && response.data._id) {
                // Direct redirect as requested - no toast
                navigation.replace('GroupDetails', {
                    groupId: response.data._id,
                    groupName: response.data.group_name
                });
            }
        } catch (error: any) {
            console.error(error);
            const errorMessage = error.response?.data?.message || 'Failed to create group. Please try again.';
            showToast(errorMessage, 'error', { title: 'Error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                    <View style={styles.content}>
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                                <Text style={styles.backButtonText}>←</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Icon and Title */}
                        <View style={styles.headerContent}>
                            <View style={styles.iconCircle}>
                                <Text style={styles.iconText}>👥</Text>
                            </View>
                            <Text style={styles.title}>Create New Group</Text>
                            <Text style={styles.subtitle}>
                                Give your group a name to start{'\n'}tracking and managing pilgrims.
                            </Text>
                        </View>

                        {/* Form */}
                        <View style={styles.formContainer}>
                            <View style={styles.inputWrapper}>
                                <Text style={styles.label}>Group Name</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="e.g. Hajj Group 2026"
                                    placeholderTextColor="#999"
                                    value={groupName}
                                    onChangeText={setGroupName}
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity
                                style={[styles.button, loading && styles.buttonDisabled, !groupName.trim() && styles.buttonInactive]}
                                onPress={handleCreateGroup}
                                disabled={loading || !groupName.trim()}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.buttonText}>Create Group</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    content: {
        flex: 1,
        padding: 24,
    },
    header: {
        marginBottom: 20,
    },
    backButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    backButtonText: {
        fontSize: 24,
        color: '#007AFF',
    },
    headerContent: {
        alignItems: 'center',
        marginBottom: 40,
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#E3F2FD',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconText: {
        fontSize: 36,
    },
    title: {
        fontSize: 28,
        fontWeight: '800',
        color: '#1A1A1A',
        marginBottom: 10,
        textAlign: 'center',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
    formContainer: {
        backgroundColor: 'white',
        borderRadius: 16,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
        marginBottom: 24,
    },
    inputWrapper: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#333',
        marginBottom: 10,
    },
    input: {
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        fontSize: 17,
        color: '#333',
        borderWidth: 1.5,
        borderColor: '#E8E8E8',
    },
    button: {
        backgroundColor: '#007AFF',
        paddingVertical: 18,
        borderRadius: 14,
        alignItems: 'center',
        shadowColor: '#007AFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    buttonDisabled: {
        backgroundColor: '#A0C4FF',
        shadowOpacity: 0,
    },
    buttonInactive: {
        backgroundColor: '#CCC',
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    tipsContainer: {
        backgroundColor: '#FFF9E6',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: '#FFD700',
    },
    tipsTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#333',
        marginBottom: 10,
    },
    tipText: {
        fontSize: 14,
        color: '#666',
        marginBottom: 6,
        lineHeight: 20,
    },
});
