import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
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
        return () => {
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

        return (
            <View style={[
                styles.messageCard,
                isModeratorSender ? styles.messageCardModerator : styles.messageCardPilgrim,
                item.is_urgent && styles.urgentMessage,
                isRTL && { direction: 'rtl' }
            ]}>
                <View style={[styles.cardHeader, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.senderBlock, isRTL && { flexDirection: 'row-reverse' }]}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {senderName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={{ flex: 1, alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.senderName}>{senderName}</Text>
                            <View style={[styles.metaRow, isRTL && { flexDirection: 'row-reverse' }]}>
                                <Text style={[
                                    styles.senderRole,
                                    isModeratorSender ? styles.roleModerator : styles.rolePilgrim
                                ]}>
                                    {isModeratorSender ? (item.sender_id?.role === 'moderator' ? t('moderator') : (item.sender_id?.role || t('moderator'))) : t('pilgrim')}
                                </Text>
                                <Text style={styles.time}>
                                    {new Date(item.created_at).toLocaleString()}
                                </Text>
                                {item.is_urgent && (
                                    <View style={[styles.urgentBadge, isRTL && { flexDirection: 'row-reverse' }]}>
                                        <Ionicons name="alert" size={10} color="white" />
                                        <Text style={styles.urgentText}>{t('urgent_caps')}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {item.type === 'text' && (
                    <Text style={[styles.content, isRTL && { textAlign: 'right' }]}>{item.content}</Text>
                )}

                {isTts && (
                    <View>
                        <View style={[styles.ttsHeader, isRTL && { flexDirection: 'row-reverse', alignSelf: 'flex-end' }]}>
                            <Ionicons name="volume-high" size={20} color="#2563EB" />
                            <Text style={[styles.ttsLabel, isRTL && { marginLeft: 0, marginRight: 5 }]}>{t('tts_message')}</Text>
                        </View>
                        <Text style={[styles.ttsText, isRTL && { textAlign: 'right' }]}>{item.original_text}</Text>
                        <TouchableOpacity
                            style={[styles.playButton, (isPlaying && isSpeaking) && styles.playingButton, isRTL && { flexDirection: 'row-reverse', alignSelf: 'flex-end' }]}
                            onPress={() => playTts(item.original_text!, item._id)}
                        >
                            <Ionicons name={(isPlaying && isSpeaking) ? "pause" : "play"} size={20} color="white" />
                            <Text style={styles.playText}>{(isPlaying && isSpeaking) ? t('playing') : t('play')}</Text>
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
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, isRTL && { marginRight: 0, marginLeft: 16 }]}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={isRTL && { alignItems: 'flex-end' }}>
                    <Text style={styles.title}>{groupName}</Text>
                    <Text style={styles.subtitle}>{t('broadcasts_updates')}</Text>
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
                    ListEmptyComponent={<Text style={styles.empty}>{t('no_messages_yet')}</Text>}
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#F6F7FB',
    },
    backBtn: {
        marginRight: 16,
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#0F172A',
    },
    subtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 32,
    },
    loader: {
        marginTop: 50,
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        color: '#94A3B8',
        fontSize: 15,
    },
    messageCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    messageCardModerator: {
        backgroundColor: '#FFFFFF',
    },
    messageCardPilgrim: {
        backgroundColor: '#F8FAFC',
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    senderBlock: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 10,
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E2E8F0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
    },
    senderName: {
        fontWeight: '700',
        fontSize: 15,
        color: '#0F172A',
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 4,
    },
    senderRole: {
        fontSize: 10,
        color: 'white',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        overflow: 'hidden',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    roleModerator: {
        backgroundColor: '#3B82F6',
    },
    rolePilgrim: {
        backgroundColor: '#64748B',
    },
    content: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 22,
        marginTop: 6,
    },
    time: {
        fontSize: 11,
        color: '#94A3B8',
    },
    urgentMessage: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    urgentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    urgentText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '700',
        marginLeft: 3,
        letterSpacing: 0.5,
    },
    ttsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        backgroundColor: '#DBEAFE',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    ttsLabel: {
        fontSize: 12,
        color: '#1E40AF',
        fontWeight: '600',
        marginLeft: 5,
    },
    ttsText: {
        fontSize: 15,
        color: '#1E293B',
        marginBottom: 10,
        lineHeight: 21,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3B82F6',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 10,
        alignSelf: 'flex-start',
        gap: 8,
    },
    playingButton: {
        backgroundColor: '#EF4444',
    },
    playText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    // Voice styles
    voiceContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 12,
        padding: 12,
        marginVertical: 4,
        gap: 12,
    },
    voiceModerator: {
        backgroundColor: '#F1F5F9',
    },
    voicePilgrim: {
        backgroundColor: '#EFF6FF',
    },
    voicePlayBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    voiceContent: {
        flex: 1,
        justifyContent: 'center',
    },
    waveformContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 24,
        gap: 2,
        marginBottom: 4,
    },
    waveBar: {
        width: 3,
        borderRadius: 2,
    },
    voiceTime: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '600',
    },
});
