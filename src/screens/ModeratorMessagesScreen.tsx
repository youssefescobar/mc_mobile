import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api, BASE_URL } from '../services/api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { useTranslation } from 'react-i18next';


type Props = NativeStackScreenProps<RootStackParamList, 'ModeratorMessagesScreen'>;

interface Message {
    _id: string;
    type: 'text' | 'voice' | 'tts';
    content?: string;
    media_url?: string;
    original_text?: string;
    is_urgent?: boolean;
    sender_id: {
        _id: string;
        full_name: string;
        role?: string;
    };
    sender_model: 'User' | 'Pilgrim';
    created_at: string;
}

export default function ModeratorMessagesScreen({ navigation, route }: Props) {
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';
    const { groupId, groupName } = route.params;
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const soundRef = useRef<Audio.Sound | null>(null);

    useEffect(() => {
        fetchMessages();
        return () => {
            if (soundRef.current) soundRef.current.unloadAsync();
            Speech.stop();
        };
    }, []);

    const playVoice = async (filename: string, id: string) => {
        try {
            if (playingId === id && soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
                soundRef.current = null;
                setPlayingId(null);
                return;
            }
            if (soundRef.current) {
                await soundRef.current.stopAsync();
                await soundRef.current.unloadAsync();
            }
            Speech.stop();
            setIsSpeaking(false);

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
        if (playingId === id && isSpeaking) {
            Speech.stop();
            setPlayingId(null);
            setIsSpeaking(false);
            return;
        }
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

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/messages/group/${groupId}`);

            // Sort messages by createdAt descending (newest first for moderator view)
            const fetchedMessages = response.data.data.sort((a: Message, b: Message) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            );
            setMessages(fetchedMessages);
        } catch (error) {
            console.error('Fetch messages error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (messageId: string) => {
        Alert.alert(
            t('delete_message'),
            t('delete_message_confirm'),
            [
                { text: t('cancel'), style: 'cancel' },
                {
                    text: t('delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await api.delete(`/messages/${messageId}`);
                            setMessages(prev => prev.filter(msg => msg._id !== messageId));
                        } catch (error) {
                            console.error('Delete error:', error);
                            Alert.alert(t('error'), t('failed_delete_notif'));
                        }
                    }
                }
            ]
        );
    };

    const renderItem = ({ item }: { item: Message }) => {
        const isVoice = item.type === 'voice';
        const isTts = item.type === 'tts';
        const isPlaying = playingId === item._id;

        return (
            <View style={[
                styles.messageCard,
                item.is_urgent && styles.urgentMessage,
                isRTL && { direction: 'rtl' }
            ]}>
                <View style={[styles.headerRow, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={[styles.headerLeft, isRTL && { flexDirection: 'row-reverse' }]}>
                        <Ionicons
                            name={
                                isTts ? "volume-high" :
                                    isVoice ? "mic" :
                                        "chatbubble-ellipses"
                            }
                            size={18}
                            color={item.is_urgent ? "#EF4444" : "#3B82F6"}
                        />
                        <Text style={[styles.typeLabel, isRTL && { marginLeft: 0, marginRight: 6 }]}>
                            {isTts ? t('tts') : isVoice ? t('voice') : t('text')}
                        </Text>
                        {item.is_urgent && (
                            <View style={[styles.urgentBadge, isRTL && { marginLeft: 0, marginRight: 8 }]}>
                                <Text style={styles.urgentText}>{t('urgent_caps')}</Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={() => handleDelete(item._id)}
                        style={styles.deleteButton}
                    >
                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                </View>

                {item.type === 'text' && (
                    <Text style={[styles.content, isRTL && { textAlign: 'right' }]}>{item.content}</Text>
                )}

                {isTts && (
                    <View>
                        <Text style={[styles.content, isRTL && { textAlign: 'right' }]}>{item.original_text}</Text>
                        <TouchableOpacity
                            style={[styles.playButton, (isPlaying && isSpeaking) && styles.playingButton, isRTL && { flexDirection: 'row-reverse', alignSelf: 'flex-end' }]}
                            onPress={() => playTts(item.original_text!, item._id)}
                        >
                            <Ionicons name={(isPlaying && isSpeaking) ? 'pause' : 'play'} size={18} color="white" />
                            <Text style={styles.playText}>{(isPlaying && isSpeaking) ? t('playing') : t('listen')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {isVoice && (
                    <TouchableOpacity
                        style={[styles.playButton, isPlaying && styles.playingButton, isRTL && { flexDirection: 'row-reverse', alignSelf: 'flex-end' }]}
                        onPress={() => playVoice(item.media_url!, item._id)}
                    >
                        <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color="white" />
                        <Text style={styles.playText}>{isPlaying ? t('playing') : t('play_voice')}</Text>
                    </TouchableOpacity>
                )}

                <View style={[styles.footer, isRTL && { flexDirection: 'row-reverse' }]}>
                    <Text style={styles.time}>
                        {new Date(item.created_at).toLocaleString()}
                    </Text>
                    <Text style={styles.sender}>
                        {t('sent_by', { name: item.sender_id.full_name })}
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
                <View style={[styles.headerTextContainer, isRTL && { alignItems: 'flex-end' }]}>
                    <Text style={styles.title}>{groupName}</Text>
                    <Text style={styles.subtitle}>{t('sent_messages')}</Text>
                </View>
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#3B82F6" style={styles.loader} />
            ) : (
                <FlatList
                    data={messages}
                    renderItem={renderItem}
                    keyExtractor={item => item._id}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.empty}>{t('no_messages_sent_yet')}</Text>}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
    },
    backBtn: {
        marginRight: 16,
        padding: 4,
    },
    headerTextContainer: {
        flex: 1,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
    },
    subtitle: {
        fontSize: 13,
        color: '#64748B',
        marginTop: 2,
    },
    list: {
        padding: 16,
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
        borderRadius: 12,
        marginBottom: 12,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 2,
    },
    urgentMessage: {
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FEE2E2',
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    typeLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#3B82F6',
        marginLeft: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    urgentBadge: {
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        marginLeft: 8,
    },
    urgentText: {
        color: 'white',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    deleteButton: {
        padding: 8,
    },
    content: {
        fontSize: 15,
        color: '#334155',
        lineHeight: 21,
        marginBottom: 10,
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
        marginBottom: 10,
    },
    playingButton: {
        backgroundColor: '#EF4444',
    },
    playText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 14,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
    },
    time: {
        fontSize: 11,
        color: '#94A3B8',
    },
    sender: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '500',
    },
});
