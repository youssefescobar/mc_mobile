import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
import { socketService } from '../services/socket';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';
import { useToast } from '../components/ToastContext';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimMessagesScreen'>;

// --- Voice Message Component ---
const VoiceMessage = ({
    item,
    isPlaying,
    onPlay,
    playbackStatus,
    isRTL,
    isModerator
}: {
    item: any,
    isPlaying: boolean,
    onPlay: () => void,
    playbackStatus: { position: number, duration: number } | null,
    isRTL: boolean,
    isModerator: boolean
}) => {
    // Generate random waveform bars seeded by ID (consistent for same message)
    const generateBars = (id: string) => {
        const bars = [];
        const seed = id.charCodeAt(id.length - 1) || 10;
        for (let i = 0; i < 20; i++) {
            const height = 10 + ((seed * (i + 1)) % 25);
            bars.push(height);
        }
        return bars;
    };

    const bars = useRef(generateBars(item._id)).current;

    // Calculate progress
    const progress = (isPlaying && playbackStatus && playbackStatus.duration > 0)
        ? playbackStatus.position / playbackStatus.duration
        : 0;

    // Format duration
    const formatTime = (millis: number) => {
        const totalSeconds = Math.floor(millis / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const durationDisplay = (isPlaying && playbackStatus)
        ? formatTime(playbackStatus.position)
        : (item.duration ? formatTime(item.duration * 1000) : "0:00"); // Fallback if no duration stored

    return (
        <View style={[styles.voiceContainer, isModerator ? styles.voiceModerator : styles.voicePilgrim]}>
            <TouchableOpacity onPress={onPlay} style={styles.voicePlayBtn}>
                <Ionicons name={isPlaying ? "pause" : "play"} size={20} color={isModerator ? "#64748B" : "#2563EB"} />
            </TouchableOpacity>

            <View style={styles.voiceContent}>
                <View style={[styles.waveformContainer, isRTL && { flexDirection: 'row-reverse' }]}>
                    {bars.map((height, index) => {
                        // Simple visual progress: bars before the relative progress index are filled
                        const barProgress = index / bars.length;
                        const isFilled = isPlaying && barProgress < progress;

                        return (
                            <View
                                key={index}
                                style={[
                                    styles.waveBar,
                                    { height, backgroundColor: isFilled ? (isModerator ? '#64748B' : '#2563EB') : '#CBD5E1' }
                                ]}
                            />
                        );
                    })}
                </View>
                <Text style={styles.voiceTime}>{durationDisplay}</Text>
            </View>
        </View>
    );
};


export default function PilgrimMessagesScreen({ route, navigation }: Props) {
    const { t, i18n } = useTranslation();
    const { showToast } = useToast();
    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';
    const { groupId, groupName } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [playbackStatus, setPlaybackStatus] = useState<{ position: number, duration: number } | null>(null);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        fetchMessages();
        // Mark all messages in this group as read
        api.post(`/messages/group/${groupId}/mark-read`).catch(() => { });

        // Socket Connection
        socketService.connect();
        socketService.joinGroup(groupId);

        const handleNewMessage = (message: any) => {
            console.log('New message received via socket:', message);
            setMessages(prev => [message, ...prev]);
            // Mark as read if screen is focused (optional, for now just strict append)
        };

        socketService.onNewMessage(handleNewMessage);

        return () => {
            socketService.offNewMessage(handleNewMessage);
            socketService.leaveGroup(groupId);
            cleanupAudio();
        };
    }, []);

    const cleanupAudio = async () => {
        if (soundRef.current) {
            try {
                await soundRef.current.unloadAsync();
            } catch (e) {
                // Ignore unload errors
            }
            soundRef.current = null;
        }
        Speech.stop();
    };

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/messages/group/${groupId}`);
            if (response.data.success) {
                setMessages(response.data.data);
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }: { item: any }) => {
        const isTts = item.type === 'tts';
        const isVoice = item.type === 'voice';
        const senderName = item.sender_id?.full_name || t('unknown');
        const isModeratorSender = item.sender_model === 'User';
        const isPlaying = playingId === item._id;

        const playVoice = async (filename: string, id: string) => {
            try {
                if (isPlaying && soundRef.current) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                    soundRef.current = null;
                    setPlayingId(null);
                    setPlaybackStatus(null);
                    return;
                }

                // Stop any current playback
                await cleanupAudio();
                setPlayingId(null);
                setPlaybackStatus(null);

                const serverBase = BASE_URL.replace('/api', '');
                const uri = `${serverBase}/uploads/${filename}`;

                const { sound } = await Audio.Sound.createAsync(
                    { uri },
                    { shouldPlay: true }
                );

                soundRef.current = sound;
                setPlayingId(id);

                sound.setOnPlaybackStatusUpdate((status: any) => {
                    if (status.isLoaded) {
                        setPlaybackStatus({
                            position: status.positionMillis,
                            duration: status.durationMillis || 0
                        });

                        if (status.didJustFinish) {
                            setPlayingId(null);
                            setPlaybackStatus(null);
                            sound.unloadAsync();
                            soundRef.current = null;
                        }
                    } else if (status.error) {
                        console.log(`Player error: ${status.error}`);
                    }
                });

            } catch (e) {
                // Suppress raw error, show clean toast
                console.log('Voice playback failed (suppressed error)');
                setPlayingId(null);
                setPlaybackStatus(null);
                showToast(t('Audio Unavailable') || 'Audio unavailable', 'error');
            }
        };

        const playTts = (text: string, id: string) => {
            if (isPlaying && isSpeaking) {
                Speech.stop();
                setPlayingId(null);
                setIsSpeaking(false);
                return;
            }
            // Stop any current playback
            cleanupAudio();

            setPlayingId(id);
            setIsSpeaking(true);
            Speech.speak(text, {
                onDone: () => { setPlayingId(null); setIsSpeaking(false); },
                onError: () => { setPlayingId(null); setIsSpeaking(false); },
            });
        };

        const isMe = item.sender_id?._id === route.params?.userId; // Assuming userId is passed or retrieved globally
        // Fallback if userId not available immediately, relying on sender_model
        const isMyMessage = item.sender_model === 'Pilgrim' && !isModeratorSender;

        return (
            <View style={[
                styles.messageRow,
                isModeratorSender ? styles.rowLeft : styles.rowRight,
                isRTL && { flexDirection: isModeratorSender ? 'row-reverse' : 'row' }
            ]}>
                {/* Avatar only for Moderator (Left side) */}
                {isModeratorSender && (
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                            {senderName.charAt(0).toUpperCase()}
                        </Text>
                    </View>
                )}

                <View style={[
                    styles.messageBubble,
                    isModeratorSender ? styles.bubbleModerator : styles.bubblePilgrim,
                    item.is_urgent && styles.urgentBubble
                ]}>
                    <View style={styles.bubbleHeader}>
                        {isModeratorSender && (
                            <Text style={styles.senderName}>{senderName}</Text>
                        )}
                        {item.is_urgent && (
                            <View style={styles.urgentBadge}>
                                <Ionicons name="alert" size={10} color="#DC2626" />
                                <Text style={styles.urgentText}>{t('urgent_caps') || 'URGENT'}</Text>
                            </View>
                        )}
                    </View>

                    {item.type === 'text' && (
                        <Text style={[
                            styles.content,
                            isModeratorSender ? styles.textModerator : styles.textPilgrim
                        ]}>{item.content}</Text>
                    )}

                    {isTts && (
                        <View style={styles.ttsContainer}>
                            <View style={styles.ttsHeader}>
                                <Ionicons name="volume-high" size={16} color={isModeratorSender ? "#475569" : "#E0E7FF"} />
                                <Text style={[styles.ttsLabel, isModeratorSender ? { color: '#475569' } : { color: '#E0E7FF' }]}>
                                    {t('tts_message') || 'Announcement'}
                                </Text>
                            </View>
                            <Text style={[styles.ttsText, isModeratorSender ? styles.textModerator : styles.textPilgrim]}>
                                {item.original_text}
                            </Text>
                            <TouchableOpacity
                                style={[styles.playButton, isModeratorSender ? { backgroundColor: '#E2E8F0' } : { backgroundColor: 'rgba(255,255,255,0.2)' }]}
                                onPress={() => playTts(item.original_text!, item._id)}
                            >
                                <Ionicons name={(isPlaying && isSpeaking) ? "pause" : "play"} size={16} color={isModeratorSender ? "#0F172A" : "#FFFFFF"} />
                                <Text style={[styles.playText, isModeratorSender ? { color: '#0F172A' } : { color: '#FFFFFF' }]}>
                                    {(isPlaying && isSpeaking) ? (t('playing') || 'Playing') : 'Play Announcement'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {isVoice && (
                        <VoiceMessage
                            item={item}
                            isPlaying={isPlaying}
                            onPlay={() => playVoice(item.media_url!, item._id)}
                            playbackStatus={playbackStatus}
                            isRTL={isRTL}
                            isModerator={isModeratorSender}
                        />
                    )}

                    <Text style={[styles.time, isModeratorSender ? { color: '#64748B' } : { color: '#E0E7FF', alignSelf: 'flex-end' }]}>
                        {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, isRTL && { marginRight: 0, marginLeft: 16 }]}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#0F172A" />
                </TouchableOpacity>
                <View style={[styles.headerContent, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={styles.title}>{groupName}</Text>
                    <Text style={styles.subtitle}>{t('broadcasts_updates') || 'Group Updates'}</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#007AFF" style={styles.loader} />
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.list}
                    inverted  // Newest at bottom
                    ListEmptyComponent={
                        <View style={[styles.emptyContainer, { transform: [{ scaleY: -1 }] }]}>
                            <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.empty}>{t('no_messages_yet') || 'No messages yet'}</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC', // Slate 50
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        zIndex: 10,
    },
    backBtn: {
        marginRight: 16,
        padding: 4,
    },
    headerContent: {
        flex: 1,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
        color: '#0F172A',
        letterSpacing: -0.3,
    },
    subtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 1,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 20,
        paddingTop: 16,
    },
    loader: {
        marginTop: 50,
    },
    emptyContainer: {
        alignItems: 'center',
        marginTop: 80,
    },
    empty: {
        textAlign: 'center',
        marginTop: 12,
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '500',
    },
    // Message Row
    messageRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'flex-end',
        gap: 8,
    },
    rowLeft: {
        justifyContent: 'flex-start',
    },
    rowRight: {
        justifyContent: 'flex-end',
    },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
    },
    // Bubbles
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 18,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    bubbleModerator: {
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    bubblePilgrim: {
        backgroundColor: '#2563EB', // Blue 600
        borderBottomRightRadius: 4,
    },
    urgentBubble: {
        backgroundColor: '#FEF2F2', // Red 50
        borderColor: '#FECACA',
        borderWidth: 1,
    },
    bubbleHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
        gap: 8,
    },
    senderName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B', // Slate 500
        marginBottom: 2,
    },
    urgentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
        gap: 4,
    },
    urgentText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#DC2626',
        letterSpacing: 0.5,
    },
    // Content
    content: {
        fontSize: 15,
        lineHeight: 22,
    },
    textModerator: {
        color: '#1E293B', // Slate 800
    },
    textPilgrim: {
        color: '#FFFFFF',
    },
    time: {
        fontSize: 10,
        marginTop: 6,
    },
    // TTS Specific
    ttsContainer: {
        marginTop: 4,
    },
    ttsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 6,
        gap: 6,
    },
    ttsLabel: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    ttsText: {
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 24,
        marginBottom: 10,
        fontStyle: 'italic',
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
        gap: 8,
    },
    playText: {
        fontSize: 13,
        fontWeight: '600',
    },
    // Voice Message
    voiceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 4,
        overflow: 'hidden', // Prevent overflow
    },
    voiceModerator: {},
    voicePilgrim: {},
    voicePlayBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.9)',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
        flexShrink: 0, // Prevent button from shrinking
    },
    voiceContent: {
        flex: 1,
        justifyContent: 'center',
        marginRight: 8, // Add spacing
        overflow: 'hidden', // Contain waveform
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        gap: 2,
        marginBottom: 4,
        flexWrap: 'nowrap', // Force single line
        overflow: 'hidden', // Hide extra bars
        maxWidth: '100%', // Ensure it fits
    },
    waveBar: {
        width: 3,
        borderRadius: 2,
        minWidth: 3, // Enforce width
    },
    voiceTime: {
        fontSize: 10,
        color: '#94A3B8', // Slate 400
        fontWeight: '500',
    },
});
