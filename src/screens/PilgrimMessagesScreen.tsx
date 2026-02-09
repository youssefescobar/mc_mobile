import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimMessages'>;

export default function PilgrimMessagesScreen({ route, navigation }: Props) {
    const { groupId, groupName } = route.params;
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        fetchMessages();
        // Mark all messages in this group as read
        api.post(`/messages/group/${groupId}/mark-read`).catch(() => {});
        return () => {
            // Cleanup on unmount
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
            Speech.stop();
        };
    }, []);

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
        const senderName = item.sender_id?.full_name || 'Unknown';
        const isModeratorSender = item.sender_model === 'User';
        const isPlaying = playingId === item._id;

        const playVoice = async (filename: string, id: string) => {
            try {
                if (isPlaying && soundRef.current) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                    soundRef.current = null;
                    setPlayingId(null);
                    return;
                }
                // Stop any current playback
                if (soundRef.current) {
                    await soundRef.current.stopAsync();
                    await soundRef.current.unloadAsync();
                }
                Speech.stop();

                const serverBase = BASE_URL.replace('/api', '');
                const uri = `${serverBase}/uploads/${filename}`;
                const { sound } = await Audio.Sound.createAsync({ uri });
                soundRef.current = sound;
                setPlayingId(id);

                sound.setOnPlaybackStatusUpdate((status: any) => {
                    if (status.didJustFinish) {
                        setPlayingId(null);
                        sound.unloadAsync();
                        soundRef.current = null;
                    }
                });
                await sound.playAsync();
            } catch (e) {
                console.error('Error playing voice:', e);
                setPlayingId(null);
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
            if (soundRef.current) {
                soundRef.current.stopAsync();
                soundRef.current.unloadAsync();
                soundRef.current = null;
            }
            Speech.stop();

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
                item.is_urgent && styles.urgentMessage
            ]}>
                <View style={styles.cardHeader}>
                    <View style={styles.senderBlock}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                                {senderName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.senderName}>{senderName}</Text>
                            <View style={styles.metaRow}>
                                <Text style={[
                                    styles.senderRole,
                                    isModeratorSender ? styles.roleModerator : styles.rolePilgrim
                                ]}>
                                    {isModeratorSender ? (item.sender_id?.role || 'Moderator') : 'Pilgrim'}
                                </Text>
                                <Text style={styles.time}>
                                    {new Date(item.created_at).toLocaleString()}
                                </Text>
                                {item.is_urgent && (
                                    <View style={styles.urgentBadge}>
                                        <Ionicons name="alert" size={10} color="white" />
                                        <Text style={styles.urgentText}>URGENT</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>

                {item.type === 'text' && (
                    <Text style={styles.content}>{item.content}</Text>
                )}

                {isTts && (
                    <View>
                        <View style={styles.ttsHeader}>
                            <Ionicons name="volume-high" size={20} color="#2563EB" />
                            <Text style={styles.ttsLabel}>Text-to-Speech Message</Text>
                        </View>
                        <Text style={styles.ttsText}>{item.original_text}</Text>
                        <TouchableOpacity
                            style={[styles.playButton, (isPlaying && isSpeaking) && styles.playingButton]}
                            onPress={() => playTts(item.original_text!, item._id)}
                        >
                            <Ionicons name={(isPlaying && isSpeaking) ? "pause" : "play"} size={20} color="white" />
                            <Text style={styles.playText}>{(isPlaying && isSpeaking) ? 'Playing...' : 'Play'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isVoice && (
                    <TouchableOpacity
                        style={[styles.playButton, isPlaying && styles.playingButton]}
                        onPress={() => playVoice(item.media_url!, item._id)}
                    >
                        <Ionicons name={isPlaying ? "pause" : "play"} size={20} color="white" />
                        <Text style={styles.playText}>{isPlaying ? 'Playing...' : 'Play Voice'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>{groupName}</Text>
                    <Text style={styles.subtitle}>Broadcasts & Updates</Text>
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
                    ListEmptyComponent={<Text style={styles.empty}>No messages yet.</Text>}
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
});
