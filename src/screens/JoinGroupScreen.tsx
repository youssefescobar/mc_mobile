import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToast } from '../components/ToastContext';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTranslation } from 'react-i18next';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ navigation, route }: Props) {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const { showToast } = useToast();
    const { t, i18n } = useTranslation();
    const isRTL = i18n.language === 'ar' || i18n.language === 'ur';
    const userId = route.params?.userId;

    const handleJoin = async (groupCode?: string) => {
        const codeToJoin = groupCode || code;

        if (!codeToJoin) {
            showToast(t('enter_group_code'), 'error');
            return;
        }

        if (codeToJoin.length !== 6) {
            showToast(t('group_code_length'), 'error');
            return;
        }

        setLoading(true);
        try {
            const response = await api.post('/groups/join', { group_code: codeToJoin });

            showToast(response.data.message || t('joined_group_success'), 'success');

            // Navigate to Dashboard with refresh param or similar
            navigation.replace('PilgrimDashboard', { userId });

        } catch (error: any) {
            const msg = error.response?.data?.message || t('failed_join_group');
            showToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        setShowScanner(false);
        setCode(data.toUpperCase());
        handleJoin(data.toUpperCase());
    };

    const openScanner = async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                showToast(t('camera_permission_required'), 'error');
                return;
            }
        }
        setShowScanner(true);
    };

    if (showScanner) {
        return (
            <View style={styles.container}>
                <View style={styles.scannerHeader}>
                    <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.backButton}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.scannerTitle}>{t('scan_qr_code')}</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr'],
                        }}
                    />
                    <View style={styles.scannerOverlay}>
                        <View style={styles.scannerFrame} />
                        <Text style={styles.scannerInstructions}>
                            {t('position_qr_code')}
                        </Text>
                    </View>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={[styles.header, isRTL && { flexDirection: 'row-reverse' }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, isRTL && { marginRight: 0, marginLeft: 16 }]}>
                    <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#1e293b" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('join_group_title')}</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.iconContainer}>
                    <Ionicons name="qr-code-outline" size={64} color="#2563eb" />
                </View>

                <Text style={styles.instructions}>
                    {t('join_group_instructions')}
                </Text>

                <TextInput
                    style={styles.input}
                    placeholder="e.g. AB12CD"
                    placeholderTextColor="#94a3b8"
                    value={code}
                    onChangeText={(text) => setCode(text.toUpperCase())}
                    maxLength={6}
                    autoCapitalize="characters"
                    autoCorrect={false}
                />

                <TouchableOpacity
                    style={[styles.button, (!code || loading) && styles.buttonDisabled]}
                    onPress={() => handleJoin()}
                    disabled={!code || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{t('join_group_link')}</Text>
                    )}
                </TouchableOpacity>

                <View style={[styles.divider, isRTL && { flexDirection: 'row-reverse' }]}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>{t('or')}</Text>
                    <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                    style={[styles.scanButton, isRTL && { flexDirection: 'row-reverse' }]}
                    onPress={openScanner}
                    disabled={loading}
                >
                    <Ionicons name="scan" size={24} color="#2563eb" />
                    <Text style={[styles.scanButtonText, isRTL && { marginLeft: 0, marginRight: 8 }]}>{t('scan_qr_code')}</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
        borderRadius: 8,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
    },
    content: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        paddingTop: 32,
    },
    iconContainer: {
        width: 120,
        height: 120,
        backgroundColor: '#eff6ff',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 32,
        borderWidth: 1,
        borderColor: '#bfdbfe',
    },
    instructions: {
        fontSize: 16,
        color: '#64748b',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 24,
    },
    input: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        fontSize: 24,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        letterSpacing: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginBottom: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    button: {
        width: '100%',
        backgroundColor: '#2563eb',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#2563eb',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    buttonDisabled: {
        backgroundColor: '#93c5fd',
        shadowOpacity: 0,
    },
    buttonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#e2e8f0',
    },
    dividerText: {
        color: '#94a3b8',
        fontSize: 14,
        fontWeight: '600',
        marginHorizontal: 16,
    },
    scanButton: {
        width: '100%',
        backgroundColor: '#eff6ff',
        paddingVertical: 18,
        borderRadius: 16,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#bfdbfe',
    },
    scanButtonText: {
        color: '#2563eb',
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    camera: {
        flex: 1,
    },
    cameraContainer: {
        flex: 1,
        position: 'relative',
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
    },
    scannerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    scannerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#fff',
        borderRadius: 16,
        backgroundColor: 'transparent',
    },
    scannerInstructions: {
        color: '#fff',
        fontSize: 16,
        marginTop: 24,
        textAlign: 'center',
        paddingHorizontal: 32,
    },
});
