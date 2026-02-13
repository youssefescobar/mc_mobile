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
    /** If provided, shows a "Call" action button beside the send button */
    onCall?: () => void;
}

export default function ComposeMessageModal({
    visible,
    onClose,
    groupId,
    onSuccess,
    title = 'Broadcast Message',
    submitPath = '/messages',
    recipientId = null,
    onCall,
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
        setRecordingStatus('idle');
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setAudioUri(uri);
        setRecording(null);
        setRecordingStatus('recorded');
    };

    const playRecording = async () => {
        if (!audioUri) return;
        try {
            if (sound && isPlaying) {
                await sound.pauseAsync();
                setIsPlaying(false);
                return;
            }
            if (sound && !isPlaying) {
                await sound.playAsync();
                setIsPlaying(true);
                return;
            }

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

            await api.post(submitPath, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
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
                                {/* Handle bar */}
                                <View style={styles.handleBar} />

                                {/* Header */}
                                <View style={styles.header}>
                                    <View style={styles.headerLeft}>
                                        <View style={styles.headerIconBg}>
                                            <Ionicons name={recipientId ? 'person' : 'megaphone'} size={16} color="#2563EB" />
                                        </View>
                                        <Text style={styles.title} numberOfLines={1}>{title}</Text>
                                    </View>
                                    <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                                        <Ionicons name="close" size={22} color="#64748B" />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView
                                    keyboardShouldPersistTaps="handled"
                                    showsVerticalScrollIndicator={false}
                                >
                                    {/* Mode tabs */}
                                    <View style={styles.tabs}>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'text' && styles.activeTab]}
                                            onPress={() => setMode('text')}
                                        >
                                            <Ionicons name="chatbubble-outline" size={15} color={mode === 'text' ? '#2563EB' : '#94A3B8'} style={{ marginRight: 5 }} />
                                            <Text style={[styles.tabText, mode === 'text' && styles.activeTabText]}>Text</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'voice' && styles.activeTab]}
                                            onPress={() => setMode('voice')}
                                        >
                                            <Ionicons name="mic-outline" size={15} color={mode === 'voice' ? '#2563EB' : '#94A3B8'} style={{ marginRight: 5 }} />
                                            <Text style={[styles.tabText, mode === 'voice' && styles.activeTabText]}>Voice</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.tab, mode === 'tts' && styles.activeTab]}
                                            onPress={() => setMode('tts')}
                                        >
                                            <Ionicons name="volume-high-outline" size={15} color={mode === 'tts' ? '#2563EB' : '#94A3B8'} style={{ marginRight: 5 }} />
                                            <Text style={[styles.tabText, mode === 'tts' && styles.activeTabText]}>TTS</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {mode === 'text' || mode === 'tts' ? (
                                        <>
                                            <TextInput
                                                style={styles.input}
                                                placeholder={mode === 'tts' ? "Type message to convert to speech..." : "Type your message..."}
                                                placeholderTextColor="#94A3B8"
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

                                    {/* Action buttons */}
                                    <View style={styles.actionRow}>
                                        {onCall && (
                                            <TouchableOpacity style={styles.callButton} onPress={onCall} activeOpacity={0.8}>
                                                <Ionicons name="call" size={18} color="white" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.sendButton, sending && styles.disabled, onCall && { flex: 1 }]}
                                            onPress={handleSend}
                                            disabled={sending}
                                            activeOpacity={0.8}
                                        >
                                            {sending ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <View style={styles.sendContent}>
                                                    <Ionicons name="send" size={16} color="white" style={{ marginRight: 8 }} />
                                                    <Text style={styles.sendText}>
                                                        {recipientId ? 'Send Alert' : 'Send Broadcast'}
                                                    </Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>
                                    </View>
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
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end',
    },
    keyboardView: {
        width: '100%',
    },
    content: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        minHeight: 400,
    },
    handleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    headerIconBg: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        flex: 1,
    },
    closeBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        justifyContent: 'center',
        alignItems: 'center',
    },
    tabs: {
        flexDirection: 'row',
        marginBottom: 20,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
    },
    activeTab: {
        backgroundColor: 'white',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 1 },
        shadowRadius: 3,
        elevation: 1,
    },
    tabText: {
        fontWeight: '600',
        fontSize: 13,
        color: '#94A3B8',
    },
    activeTabText: {
        color: '#2563EB',
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 16,
        height: 120,
        textAlignVertical: 'top',
        fontSize: 15,
        color: '#0F172A',
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
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    recording: {
        backgroundColor: '#EF4444',
        shadowColor: '#EF4444',
    },
    hint: {
        color: '#64748B',
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
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 4,
    },
    callButton: {
        width: 50,
        height: 50,
        borderRadius: 14,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 3,
    },
    sendButton: {
        backgroundColor: '#2563EB',
        borderRadius: 14,
        paddingVertical: 15,
        alignItems: 'center',
        flex: 1,
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 6,
        elevation: 3,
    },
    disabled: {
        backgroundColor: '#93C5FD',
        shadowOpacity: 0,
    },
    sendContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sendText: {
        color: 'white',
        fontWeight: '700',
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
        borderRadius: 6,
        marginRight: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#2563EB',
    },
    checkboxLabel: {
        fontSize: 15,
        color: '#1F2937',
        fontWeight: '500',
    },
    urgentHint: {
        fontSize: 12,
        color: '#64748B',
        marginLeft: 34,
    },
});
