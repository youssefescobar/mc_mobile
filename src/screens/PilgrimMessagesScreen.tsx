import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimMessagesScreen'>;

interface Message {
    _id: string;
    type: 'text' | 'voice' | 'image';
    content?: string;
    media_url?: string;
    created_at: string;
    sender_id: {
        full_name: string;
        role: string;
    };
}

export default function PilgrimMessagesScreen({ navigation, route }: Props) {
    const { groupId, groupName } = route.params;
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [sound, setSound] = useState<Audio.Sound | null>(null);
    const [playingId, setPlayingId] = useState<string | null>(null);

    useEffect(() => {
        fetchMessages();
        return () => {
            if (sound) {
                sound.unloadAsync();
            }
        };
    }, []);

    const fetchMessages = async () => {
        try {
            const response = await api.get(`/messages/group/${groupId}`);
            setMessages(response.data.data);
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
                setPlayingId(null);
                if (playingId === id) return; // Toggle off
            }

            const { sound: newSound } = await Audio.Sound.createAsync({ uri: `${BASE_URL}/uploads/${url}` });
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

    const renderItem = ({ item }: { item: Message }) => {
        const isVoice = item.type === 'voice';
        const isPlaying = playingId === item._id;

        return (
            <View style={styles.messageCard}>
                <View style={styles.headerRow}>
                    <Text style={styles.senderName}>{item.sender_id.full_name}</Text>
                    <Text style={styles.senderRole}>{item.sender_id.role}</Text>
                </View>

                {item.type === 'text' && (
                    <Text style={styles.content}>{item.content}</Text>
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
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
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
        backgroundColor: '#007AFF',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        overflow: 'hidden',
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
        alignSelf: 'flex-end',
    },
});
