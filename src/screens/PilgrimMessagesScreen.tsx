import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimMessagesScreen'>;

interface Message {
    _id: string;
    type: 'text' | 'voice' | 'image' | 'tts';
    content?: string;
    media_url?: string;
    is_urgent?: boolean;
    original_text?: string;
    created_at: string;
    sender_id: {
        _id: string;
        full_name: string;
        role?: string; // Role might be undefined for Pilgrims if not explicitly set
        profile_picture?: string;
    };
    sender_model: 'User' | 'Pilgrim';
}

export default function PilgrimMessagesScreen({ navigation, route }: Props) {
    const { groupId, groupName } = route.params;
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);

    useEffect(() => {
        fetchMessages();

        return () => {
            if (sound) {
                sound.unloadAsync();
            }
            // Stop any ongoing speech
            Speech.stop();
        };
    }, []);

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/messages/group/${groupId}`);

            // Sort messages by createdAt ascending (oldest first, newest at bottom)
            const fetchedMessages = response.data.data.sort((a: Message, b: Message) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
            setMessages(fetchedMessages);

            // Auto-play urgent TTS messages if app is in foreground
            const appState = AppState.currentState;
            if (appState === 'active') {
                const urgentTts = fetchedMessages.find(
                    (msg: Message) => msg.type === 'tts' && msg.is_urgent
                );
                if (urgentTts && urgentTts.original_text) {
                    // Small delay to let UI render
                    setTimeout(() => {
                        playTts(urgentTts.original_text!, urgentTts._id);
                    }, 500);
                }
            }
        } catch (error) {
            console.error('Fetch messages error:', error);
        } finally {
            setLoading(false);
        }
    };

    const playVoice = async (url: string, id: string) => {
        try {
            if (sound) {
                await sound.unloadAsync();
                setSound(null);
                setPlayingId(null);
                if (playingId === id) return; // Toggle off
            }

            // Get auth token for authenticated request
            const token = await AsyncStorage.getItem('token');
            // Remove /api from BASE_URL since uploads are at root level
            const uploadsUrl = BASE_URL.replace('/api', '');
            const { sound: newSound } = await Audio.Sound.createAsync(
                {
                    uri: `${uploadsUrl}/uploads/${url}`,
                    headers: token ? { 'Authorization': `Bearer ${token}` } : undefined
                }
            );
            setSound(newSound);
            setPlayingId(id);
            await newSound.playAsync();

            newSound.setOnPlaybackStatusUpdate((status) => {
                if (status.isLoaded && status.didJustFinish) {
                    setPlayingId(null);
                }
            });
        } catch (error) {
            console.error('Playback error:', error);
        }
    };

    const playTts = async (text: string, id: string) => {
        try {
            // If already playing this message, stop it
            if (playingId === id && isSpeaking) {
                Speech.stop();
                setPlayingId(null);
                setIsSpeaking(false);
                return;
            }

            // Stop any current TTS
            if (isSpeaking) {
                Speech.stop();
            }

            setPlayingId(id);
            setIsSpeaking(true);

            Speech.speak(text, {
                language: 'en-US',
                pitch: 1.0,
                rate: 0.75,
                onDone: () => {
                    setIsSpeaking(false);
                    setPlayingId(null);
                },
                onStopped: () => {
                    setIsSpeaking(false);
                    setPlayingId(null);
                },
                onError: () => {
                    setIsSpeaking(false);
                    setPlayingId(null);
                }
            });
        } catch (error) {
            console.error('TTS error:', error);
            setIsSpeaking(false);
            setPlayingId(null);
        }
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isVoice = item.type === 'voice';
        const isTts = item.type === 'tts';
        const isPlaying = playingId === item._id;

        return (
            <View style={[
                styles.messageCard,
                item.sender_model === 'Pilgrim' ? styles.messageCardPilgrim : styles.messageCardModerator,
                item.is_urgent && styles.urgentMessage
            ]}>
                <View style={styles.headerRow}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.senderName}>{item.sender_id.full_name}</Text>
                        {item.is_urgent && (
                            <View style={styles.urgentBadge}>
                                <Ionicons name="alert-circle" size={14} color="white" />
                                <Text style={styles.urgentText}>URGENT</Text>
                            </View>
                        )}
                    </View>
                    <Text style={[
                        styles.senderRole,
                        item.sender_model === 'Pilgrim' ? styles.rolePilgrim : styles.roleModerator
                    ]}>
                        {item.sender_model === 'Pilgrim' ? 'Pilgrim' : (item.sender_id.role || 'Moderator')}
                    </Text>
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
                            <Ionicons name={(isPlaying && isSpeaking) ? "pause" : "play"} size={24} color="white" />
                            <Text style={styles.playText}>{(isPlaying && isSpeaking) ? 'Speaking...' : 'Play TTS'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isVoice && (
                    <TouchableOpacity
                        style={[styles.playButton, isPlaying && styles.playingButton]}
                        onPress={() => playVoice(item.media_url!, item._id)}
                    >
                        <Ionicons name={isPlaying ? "pause" : "play"} size={24} color="white" />
                        <Text style={styles.playText}>{isPlaying ? 'Playing...' : 'Play Voice Note'}</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>{groupName} Updates</Text>
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
        backgroundColor: '#F5F5F5',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E0E0E0',
    },
    backBtn: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#333',
    },
    list: {
        padding: 16,
    },
    loader: {
        marginTop: 50,
    },
    empty: {
        textAlign: 'center',
        marginTop: 50,
        color: '#999',
    },
    messageCard: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    messageCardModerator: {
        backgroundColor: 'white',
        borderLeftWidth: 4,
        borderLeftColor: '#007AFF', // Blue for moderators
    },
    messageCardPilgrim: {
        backgroundColor: '#F0F9FF', // Light blue/white for pilgrims
        borderLeftWidth: 4,
        borderLeftColor: '#64748B', // Grey/Slate for pilgrims
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    senderName: {
        fontWeight: 'bold',
        fontSize: 16,
        marginRight: 8,
    },
    senderRole: {
        fontSize: 12,
        color: 'white',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
    },
    roleModerator: {
        backgroundColor: '#007AFF',
    },
    rolePilgrim: {
        backgroundColor: '#64748B',
    },
    content: {
        fontSize: 16,
        color: '#333',
        marginBottom: 8,
    },
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#34C759',
        padding: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    playingButton: {
        backgroundColor: '#FF3B30',
    },
    playText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 8,
    },
    time: {
        fontSize: 12,
        color: '#999',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    urgentMessage: {
        borderLeftColor: '#EF4444',
        borderLeftWidth: 6,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    urgentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    urgentText: {
        color: 'white',
        fontSize: 10,
        fontWeight: 'bold',
        marginLeft: 4,
    },
    ttsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    ttsLabel: {
        fontSize: 14,
        color: '#2563EB',
        fontWeight: '600',
        marginLeft: 6,
    },
    ttsText: {
        fontSize: 16,
        color: '#333',
        marginBottom: 12,
        fontStyle: 'italic',
    },
});
