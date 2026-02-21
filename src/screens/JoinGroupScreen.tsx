import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { CameraView, useCameraPermissions } from 'expo-camera';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinGroup'>;

export default function JoinGroupScreen({ navigation, route }: Props) {
    const { t, i18n } = useTranslation();
    const isRTL = useIsRTL();
    const [groupCode, setGroupCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    const barcodeSettings = useMemo(() => ({
        barcodeTypes: ['qr'] as any,
    }), []);

    const handleJoin = async (code: string) => {
        if (!code.trim()) return;
        setLoading(true);
        try {
            const response = await api.post('/groups/join', { group_code: code.trim() });
            if (response.data.success) {
                Alert.alert(t('success'), t('joined_group_successfully'));
                navigation.replace('PilgrimDashboard', { userId: route.params.userId });
            } else {
                Alert.alert(t('error'), response.data.message || t('failed_to_join_group'));
            }
        } catch (error: any) {
            Alert.alert(t('error'), error.response?.data?.message || t('failed_to_join_group'));
        } finally {
            setLoading(false);
        }
    };

    const startScanner = async () => {
        const { status } = await requestPermission();
        if (status === 'granted') {
            setShowScanner(true);
        } else {
            Alert.alert(t('error'), t('camera_permission_denied'));
        }
    };

    const handleBarCodeScanned = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        setShowScanner(false);
        setGroupCode(data);
        handleJoin(data);
        // Reset scanned state after a delay or when closing scanner
        setTimeout(() => setScanned(false), 2000);
    };

    if (showScanner) {
        if (!permission) {
            return (
                <View style={[styles.container, styles.center]}>
                    <ActivityIndicator size="large" color="#2563eb" />
                </View>
            );
        }

        if (!permission.granted) {
            return (
                <View style={[styles.container, styles.center, { padding: 20 }]}>
                    <Ionicons name="camera-outline" size={64} color="#64748b" style={{ marginBottom: 16 }} />
                    <Text style={[styles.instructions, { marginBottom: 24 }]}>
                        {t('camera_permission_required')}
                    </Text>
                    <TouchableOpacity style={styles.button} onPress={requestPermission}>
                        <Text style={styles.buttonText}>{t('grant_permission')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.scannerButton, { marginTop: 12 }]} onPress={() => setShowScanner(false)}>
                        <Text style={styles.scannerButtonText}>{t('cancel')}</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.container}>
                <View style={styles.scannerHeader}>
                    <TouchableOpacity onPress={() => setShowScanner(false)} style={styles.scannerBackButton}>
                        <Ionicons name={isRTL ? "arrow-forward" : "arrow-back"} size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.scannerTitle}>{t('scan_qr_code')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.cameraContainer}>
                    <CameraView
                        style={styles.camera}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={barcodeSettings}
                    >
                        <View style={styles.scannerOverlay}>
                            <View style={styles.scannerFrame} />
                            <Text style={styles.scannerInstructions}>
                                {t('position_qr_code')}
                            </Text>
                        </View>
                    </CameraView>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
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
                    placeholder={t('enter_group_code')}
                    value={groupCode}
                    onChangeText={setGroupCode}
                    autoCapitalize="characters"
                    maxLength={10}
                />

                <TouchableOpacity
                    style={[styles.button, (!groupCode.trim() || loading) && styles.buttonDisabled]}
                    onPress={() => handleJoin(groupCode)}
                    disabled={!groupCode.trim() || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.buttonText}>{t('join_group_button')}</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.scannerButton}
                    onPress={startScanner}
                >
                    <Ionicons name="camera-outline" size={20} color="#2563eb" style={{ marginRight: 8 }} />
                    <Text style={styles.scannerButtonText}>{t('scan_qr_button')}</Text>
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
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#1e293b',
        marginLeft: 8,
    },
    content: {
        flex: 1,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#eff6ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
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
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 18,
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#1e293b',
        marginBottom: 16,
    },
    button: {
        width: '100%',
        backgroundColor: '#2563eb',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 16,
    },
    buttonDisabled: {
        backgroundColor: '#94a3b8',
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    scannerButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
    },
    scannerButtonText: {
        color: '#2563eb',
        fontSize: 16,
        fontWeight: '600',
    },
    cameraContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    scannerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 20,
        paddingHorizontal: 16,
        paddingBottom: 16,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    scannerBackButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    scannerOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scannerFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#2563eb',
        backgroundColor: 'transparent',
        borderRadius: 20,
    },
    scannerInstructions: {
        color: '#fff',
        fontSize: 14,
        marginTop: 24,
        textAlign: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
});
