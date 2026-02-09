import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { api } from '../services/api';

interface Props {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    onSuccess: () => void;
    title?: string;
    submitPath?: string;
    recipientId?: string | null;
}

export default function ComposeMessageModal({
    visible,
    onClose,
    groupId,
    onSuccess,
    title = 'Broadcast Message',
    submitPath = '/messages',
    recipientId = null
}: Props) {
    const [message, setMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [mode, setMode] = useState<'text' | 'voice' | 'tts'>('text');
    const [isUrgent, setIsUrgent] = useState(false);

    // Audio recording state
    const [recording, setRecording] = useState<Audio.Recording | null>(null);
    const [recordingStatus, setRecordingStatus] = useState<'idle' | 'recording' | 'recorded'>('idle');
    const [audioUri, setAudioUri] = useState<string | null>(null);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    useEffect(() => {
        return () => {
            if (recording) recording.stopAndUnloadAsync();
            if (sound) sound.unloadAsync();
        };
    }, []);

    const startRecording = async () => {
        try {
            const permission = await Audio.requestPermissionsAsync();
            if (permission.status !== 'granted') {
                Alert.alert('Permission needed', 'Please grant microphone permission to record voice notes.');
                return;
            }

            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );
            setRecording(recording);
            setRecordingStatus('recording');
        } catch (err) {
            console.error('Failed to start recording', err);
        }
    };

    const stopRecording = async () => {
        if (!recording) return;
        setRecordingStatus('idle'); // Temporary state while processing
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);
        setRecording(null);
        setRecordingStatus('recorded');
    };

    const playRecording = async () => {
        if (!audioUri) return;
        try {
            // If already playing, pause it
            if (sound && isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
                return;
            }

            // If paused, resume
            if (sound && !isPlaying) {
                await sound.playAsync();
                setIsPlaying(true);
                return;
            }

            // Set audio mode to play through speaker (not ear speaker)
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
                staysActiveInBackground: false,
            });

            const { sound: newSound } = await Audio.Sound.createAsync({ uri: audioUri });
            setSound(newSound);
            setIsPlaying(true);
            await newSound.playAsync();

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setIsPlaying(false);
                }
            });
        } catch (error) {
            console.error('Error playing sound', error);
        }
    };

    const discardRecording = () => {
        if (sound) {
            sound.unloadAsync();
            setSound(null);
        }
        setAudioUri(null);
        setRecordingStatus('idle');
        setIsPlaying(false);
    };

    const handleSend = async () => {
        if ((mode === 'text' || mode === 'tts') && !message.trim()) {
            Alert.alert('Error', 'Please enter a message');
            return;
        }
        if (mode === 'voice' && !audioUri) {
            Alert.alert('Error', 'Please record a message');
            return;
        }

        setSending(true);
        try {
            const formData = new FormData();
            formData.append('group_id', groupId);
            if (recipientId) {
                formData.append('recipient_id', recipientId);
            }
            formData.append('type', mode);
            formData.append('is_urgent', isUrgent.toString());

            if (mode === 'text') {
                formData.append('content', message);
            } else if (mode === 'tts') {
                formData.append('content', message);
                formData.append('original_text', message);
            } else if (mode === 'voice' && audioUri) {
                const filename = audioUri.split('/').pop() || 'voice.m4a';
                const match = /\.(\w+)$/.exec(filename);
                const type = match ? `audio/${match[1]}` : 'audio/m4a';

                // @ts-ignore: FormData expects Blob but React Native handles object with uri/type/name
                formData.append('file', {
                    uri: audioUri,
                    name: filename,
                    type,
                });
            }

            // Note: Use a modified api client or explicit headers for multipart if needed, 
            // but usually axios handles FormData correctly if passed directly.
            // Check api service implementation. Assuming it handles headers or we set Content-Type: multipart/form-data
            // Actually, axios often requires explicit header removal or specific setting for FormData in RN.
            // Let's rely on standard axios for now.

            await api.post(submitPath, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onSuccess();
            resetForm();
        } catch (error: any) {
            console.error('Send message error:', error);
            Alert.alert('Error', 'Failed to send message');
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setMessage('');
        setAudioUri(null);
        setRecordingStatus('idle');
        setMode('text');
        setIsUrgent(false);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View style={styles.container}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={styles.keyboardView}
                    >
                        <TouchableWithoutFeedback>
                            <View style={styles.content}>
                                <View style={styles.header}>
                                    <Text style={styles.title}>{title}</Text>
                                    <TouchableOpacity onPress={onClose}>
                                        <Ionicons name="close" size={24} color="#666" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    <View style={styles.tabs}>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'text' && styles.activeTab]}
                                            onPress={() => setMode('text')}
                                        >
                                            <Text style={[styles.tabText, mode === 'text' && styles.activeTabText]}>Text</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'voice' && styles.activeTab]}
                                            onPress={() => setMode('voice')}
                                        >
                                            <Text style={[styles.tabText, mode === 'voice' && styles.activeTabText]}>Voice</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'tts' && styles.activeTab]}
                                            onPress={() => setMode('tts')}
                                        >
                                            <Text style={[styles.tabText, mode === 'tts' && styles.activeTabText]}>TTS</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {mode === 'text' || mode === 'tts' ? (
                                        <>
                                            <TextInput
                                                style={styles.input}
                                                placeholder={mode === 'tts' ? "Type message to convert to speech..." : "Type your message..."}
                                                value={message}
                                                onChangeText={setMessage}
                                                multiline
                                                numberOfLines={4}
                                            />
                                            {mode === 'tts' && (
                                                <View style={styles.urgentContainer}>
                                                    <TouchableOpacity
                                                        style={styles.checkboxContainer}
                                                        onPress={() => setIsUrgent(!isUrgent)}
                                                    >
                                                        <View style={[styles.checkbox, isUrgent && styles.checkboxChecked]}>
                                                            {isUrgent && <Ionicons name="checkmark" size={16} color="white" />}
                                                        </View>
                                                        <Text style={styles.checkboxLabel}>Mark as Urgent (Auto-play)</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.urgentHint}>
                                                        Urgent messages will auto-play when pilgrims open the app
                                                    </Text>
                                                </View>
                                            )}
                                        </>
                                    ) : (
                                        <View style={styles.voiceContainer}>
                                            {recordingStatus === 'idle' && (
                                                <TouchableOpacity style={styles.recordButton} onPress={startRecording}>
                                                    <Ionicons name="mic" size={32} color="white" />
                                                </TouchableOpacity>
                                            )}
                                            {recordingStatus === 'recording' && (
                                                <TouchableOpacity style={[styles.recordButton, styles.recording]} onPress={stopRecording}>
                                                    <Ionicons name="stop" size={32} color="white" />
                                                </TouchableOpacity>
                                            )}
                                            {recordingStatus === 'recorded' && (
                                                <View style={styles.recordedControls}>
                                                    <TouchableOpacity onPress={playRecording} style={styles.controlBtn}>
                                                        <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="#2563EB" />
                                                        <Text style={styles.controlText}>{isPlaying ? 'Playing' : 'Play'}</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={discardRecording} style={styles.controlBtn}>
                                                        <Ionicons name="trash" size={24} color="#EF4444" />
                                                        <Text style={[styles.controlText, { color: '#EF4444' }]}>Discard</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                            <Text style={styles.hint}>
                                                {recordingStatus === 'idle' ? 'Tap to record' :
                                                    recordingStatus === 'recording' ? 'Recording...' : 'Recorded'}
                                            </Text>
                                        </View>
                                    )}

                                    <TouchableOpacity
                                        style={[styles.sendButton, sending && styles.disabled]}
                                        onPress={handleSend}
                                        disabled={sending}
                                    >
                                        {sending ? <ActivityIndicator color="white" /> : <Text style={styles.sendText}>Send Broadcast</Text>}
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                </View>
            </TouchableWithoutFeedback>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
    },
    content: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        minHeight: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 24,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 4,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderRadius: 6,
    },
    activeTab: {
        backgroundColor: 'white',
        shadowColor: 'black',
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    tabText: {
        fontWeight: '600',
        color: '#6B7280',
    },
    activeTabText: {
        color: '#2563EB',
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        height: 120,
        textAlignVertical: 'top',
        fontSize: 16,
        marginBottom: 20,
    },
    voiceContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 150,
        marginBottom: 20,
    },
    recordButton: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#2563EB',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        elevation: 4,
    },
    recording: {
        backgroundColor: '#EF4444',
    },
    hint: {
        color: '#6B7280',
        fontSize: 14,
    },
    recordedControls: {
        flexDirection: 'row',
        gap: 32,
        marginBottom: 16,
    },
    controlBtn: {
        alignItems: 'center',
    },
    controlText: {
        marginTop: 4,
        fontWeight: '500',
        color: '#2563EB',
    },
    sendButton: {
        backgroundColor: '#2563EB',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 10, // Ensure spacing check
    },
    disabled: {
        backgroundColor: '#93C5FD',
    },
    sendText: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: 16,
    },
    urgentContainer: {
        marginBottom: 20,
    },
    checkboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderWidth: 2,
        borderColor: '#2563EB',
        borderRadius: 4,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#2563EB',
    },
    checkboxLabel: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
    },
    urgentHint: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 34,
    },
});
