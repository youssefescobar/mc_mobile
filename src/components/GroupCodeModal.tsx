import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';

interface GroupCodeModalProps {
    visible: boolean;
    onClose: () => void;
    groupId: string;
    groupName: string;
}

export default function GroupCodeModal({ visible, onClose, groupId, groupName }: GroupCodeModalProps) {
    const [groupCode, setGroupCode] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [sharing, setSharing] = useState(false);
    const viewShotRef = useRef<ViewShot>(null);

    useEffect(() => {
        if (visible && groupId) {
            fetchGroupCode();
        }
    }, [visible, groupId]);

    const fetchGroupCode = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/groups/${groupId}`);
            if (response.data && response.data.group_code) {
                setGroupCode(response.data.group_code);
            }
        } catch (error) {
            console.error('Error fetching group code:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        if (!viewShotRef.current?.capture) return;

        setSharing(true);
        try {
            // Capture the QR code as an image
            const uri = await viewShotRef.current.capture();

            // Create a well-formatted message
            const message = `🕌 Join "${groupName}"

📱 Scan the QR code or enter this code in the app:

🔑 Group Code: ${groupCode}

Download the Munawwara Care app and join our group!`;

            // Check if sharing is available
            const isAvailable = await Sharing.isAvailableAsync();

            if (isAvailable) {
                // Share with both image and message
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: `Join ${groupName}`,
                    UTI: 'public.png',
                });
            } else {
                // Fallback to text-only sharing
                await Share.share({
                    message: message,
                });
            }
        } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to text sharing on error
            try {
                await Share.share({
                    message: `Join "${groupName}" using code: ${groupCode}`,
                });
            } catch (fallbackError) {
                console.error('Fallback share failed:', fallbackError);
            }
        } finally {
            setSharing(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Group Code</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={28} color="#64748b" />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <ActivityIndicator size="large" color="#2563eb" style={styles.loader} />
                    ) : (
                        <>
                            <Text style={styles.groupName}>{groupName}</Text>

                            {/* Simple display in modal */}
                            <View style={styles.qrDisplayContainer}>
                                <QRCode
                                    value={groupCode}
                                    size={200}
                                    backgroundColor="white"
                                    color="#1e293b"
                                />
                            </View>

                            <View style={styles.codeContainer}>
                                <Text style={styles.codeLabel}>Group Code</Text>
                                <Text style={styles.code}>{groupCode}</Text>
                            </View>

                            <Text style={styles.instructions}>
                                Tap share to send invitation with QR code
                            </Text>

                            {/* Hidden card for sharing - rendered off-screen */}
                            <View style={styles.hiddenCard}>
                                <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
                                    <View style={styles.shareCard}>
                                        <View style={styles.shareCardHeader}>
                                            <Text style={styles.shareCardGroupName}>{groupName}</Text>
                                        </View>

                                        <View style={styles.qrContainer}>
                                            <QRCode
                                                value={groupCode}
                                                size={200}
                                                backgroundColor="white"
                                                color="#1e293b"
                                            />
                                        </View>

                                        <View style={styles.shareCardCode}>
                                            <Text style={styles.shareCardCodeLabel}>Group Code</Text>
                                            <Text style={styles.shareCardCodeValue}>{groupCode}</Text>
                                        </View>

                                        <View style={styles.shareCardFooter}>
                                            <Text style={styles.shareCardInstructions}>
                                                📱 Scan QR or enter code in Munawwara Care app
                                            </Text>
                                        </View>
                                    </View>
                                </ViewShot>
                            </View>

                            <TouchableOpacity
                                style={styles.shareButton}
                                onPress={handleShare}
                                disabled={sharing}
                            >
                                {sharing ? (
                                    <ActivityIndicator color="white" size="small" />
                                ) : (
                                    <>
                                        <Ionicons name="share-social" size={20} color="white" />
                                        <Text style={styles.shareButtonText}>Share Group Code</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    groupName: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 24,
    },
    qrDisplayContainer: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#f8fafc',
        borderRadius: 16,
        marginBottom: 24,
    },
    hiddenCard: {
        position: 'absolute',
        left: -9999,
        top: -9999,
    },
    qrContainer: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#ffffff',
        borderRadius: 16,
    },
    shareCard: {
        backgroundColor: '#ffffff',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 3,
        borderColor: '#2563eb',
    },
    shareCardHeader: {
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
    },
    shareCardGroupName: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
    },
    shareCardCode: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        marginTop: 20,
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#bfdbfe',
    },
    shareCardCodeLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
        fontWeight: '600',
    },
    shareCardCodeValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#2563eb',
        letterSpacing: 6,
    },
    shareCardFooter: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        width: '100%',
    },
    shareCardInstructions: {
        fontSize: 13,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 18,
    },
    codeContainer: {
        backgroundColor: '#eff6ff',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
        marginTop: 16,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    codeLabel: {
        fontSize: 12,
        color: '#64748b',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    code: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#2563eb',
        letterSpacing: 4,
    },
    instructions: {
        fontSize: 14,
        color: '#64748b',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 24,
    },
    shareButton: {
        backgroundColor: '#2563eb',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        borderRadius: 12,
        gap: 8,
    },
    shareButtonHalf: {
        flex: 1,
        marginHorizontal: 4,
    },
    shareButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    buttonRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 8,
    },
    loader: {
        marginVertical: 40,
    },
});
