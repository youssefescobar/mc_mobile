import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

interface CallTypeModalProps {
    visible: boolean;
    onClose: () => void;
    onInternetCall: () => void;
    phoneNumber?: string;
    name: string;
}

export default function CallTypeModal({ visible, onClose, onInternetCall, phoneNumber, name }: CallTypeModalProps) {
    const { t } = useTranslation();

    const handlePhoneCall = () => {
        if (phoneNumber) {
            let phoneUrl = `tel:${phoneNumber}`;
            if (Platform.OS === 'android') {
                phoneUrl = `tel:${phoneNumber}`;
            }
            Linking.canOpenURL(phoneUrl)
                .then(supported => {
                    if (!supported) {
                        console.log('Phone number is not available');
                    } else {
                        return Linking.openURL(phoneUrl);
                    }
                })
                .catch(err => console.error('An error occurred', err));
        }
        onClose();
    };

    const handleInternetCall = () => {
        onInternetCall();
        onClose();
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <View style={styles.modalContainer}>
                    <Text style={styles.title}>{t('call')} {name}</Text>

                    <TouchableOpacity style={styles.optionButton} onPress={handleInternetCall}>
                        <View style={[styles.iconContainer, { backgroundColor: '#E3F2FD' }]}>
                            <Ionicons name="call" size={24} color="#2196F3" />
                        </View>
                        <View style={styles.textContainer}>
                            <Text style={styles.optionTitle}>{t('internet_call')}</Text>
                            <Text style={styles.optionSubtitle}>{t('free_app_call')}</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
                    </TouchableOpacity>

                    {phoneNumber && (
                        <TouchableOpacity style={styles.optionButton} onPress={handlePhoneCall}>
                            <View style={[styles.iconContainer, { backgroundColor: '#E8F5E9' }]}>
                                <Ionicons name="keypad" size={24} color="#4CAF50" />
                            </View>
                            <View style={styles.textContainer}>
                                <Text style={styles.optionTitle}>{t('phone_call')}</Text>
                                <Text style={styles.optionSubtitle}>{phoneNumber}</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#BDBDBD" />
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContainer: {
        backgroundColor: 'white',
        borderRadius: 20,
        width: '100%',
        padding: 24,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 24,
        color: '#212121',
        textAlign: 'center',
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    textContainer: {
        flex: 1,
    },
    optionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#212121',
        marginBottom: 4,
    },
    optionSubtitle: {
        fontSize: 14,
        color: '#757575',
    },
    cancelButton: {
        marginTop: 12,
        padding: 12,
    },
    cancelButtonText: {
        fontSize: 16,
        color: '#F44336',
        fontWeight: '600',
    },
});
