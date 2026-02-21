import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, Platform, KeyboardAvoidingView, Animated } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import { useToast } from '../components/ToastContext';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';

type Props = NativeStackScreenProps<RootStackParamList, 'EditProfile'>;

export default function EditProfileScreen({ navigation }: Props) {
    const { t, i18n } = useTranslation();
    const isRTL = useIsRTL();
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [age, setAge] = useState('');
    const [gender, setGender] = useState('');
    const [medicalHistory, setMedicalHistory] = useState('');
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [isPilgrim, setIsPilgrim] = useState(false);
    const { showToast } = useToast();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: true,
        }).start();
    }, []);

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const response = await api.get('/auth/me');
            if (response.data) {
                setName(response.data.full_name);
                setPhone(response.data.phone_number);

                // Check if this is a pilgrim (has national_id field)
                if (response.data.national_id) {
                    setIsPilgrim(true);
                    setAge(response.data.age?.toString() || '');
                    setGender(response.data.gender || '');
                    setMedicalHistory(response.data.medical_history || '');
                }
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
            showToast(t('failed_load_profile'), 'error');
        } finally {
            setInitialLoading(false);
        }
    };

    const handleSave = async () => {
        if (!name || !phone) {
            showToast(t('name_phone_required'), 'error');
            return;
        }

        setLoading(true);
        try {
            const payload: any = {
                full_name: name,
                phone_number: phone
            };

            // Add pilgrim-specific fields if user is a pilgrim
            if (isPilgrim) {
                if (age) payload.age = age;
                if (gender) payload.gender = gender;
                if (medicalHistory !== undefined) payload.medical_history = medicalHistory;
            }

            await api.put('/auth/update-profile', payload);

            showToast(t('profile_updated_success'), 'success');
            navigation.goBack();
        } catch (error: any) {
            console.error('Update error:', error);
            showToast(error.response?.data?.message || t('failed_update_profile'), 'error');
        } finally {
            setLoading(false);
        }
    };

    if (initialLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
            </View>
        );
    }



    return (
        <View style={styles.container}>
            <View style={styles.backgroundOrbOne} />
            <View style={styles.backgroundOrbTwo} />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#1F2A44" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('edit_profile')}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveButton}>
                    {loading ? <ActivityIndicator size="small" color="#1F6FEB" /> : <Text style={styles.saveButtonText}>{t('save')}</Text>}
                </TouchableOpacity>
            </View>

            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            >
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
                        {/* Profile Image UI Removed */}

                        <View style={styles.form}>
                            <Text style={styles.label}>{t('full_name')}</Text>
                            <TextInput
                                style={styles.input}
                                value={name}
                                onChangeText={setName}
                                placeholder={t('full_name_placeholder')}
                                placeholderTextColor="#94A3B8"
                            />

                            <Text style={styles.label}>{t('phone_number')}</Text>
                            <TextInput
                                style={[styles.input, { textAlign: 'left' }]} // Phone usually LTR
                                value={phone}
                                onChangeText={setPhone}
                                placeholder={t('phone_number_placeholder')}
                                placeholderTextColor="#94A3B8"
                                keyboardType="phone-pad"
                            />

                            {isPilgrim && (
                                <>
                                    <Text style={styles.label}>{t('age_optional')}</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={age}
                                        onChangeText={setAge}
                                        placeholder={t('age_placeholder')}
                                        placeholderTextColor="#94A3B8"
                                        keyboardType="numeric"
                                    />

                                    <Text style={styles.label}>{t('gender_optional')}</Text>
                                    <View style={styles.genderContainer}>
                                        <TouchableOpacity
                                            style={[styles.genderButton, gender === 'male' && styles.genderButtonActive]}
                                            onPress={() => setGender('male')}
                                        >
                                            <Text style={[styles.genderButtonText, gender === 'male' && styles.genderButtonTextActive]}>{t('male')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.genderButton, gender === 'female' && styles.genderButtonActive]}
                                            onPress={() => setGender('female')}
                                        >
                                            <Text style={[styles.genderButtonText, gender === 'female' && styles.genderButtonTextActive]}>{t('female')}</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.genderButton, gender === 'other' && styles.genderButtonActive]}
                                            onPress={() => setGender('other')}
                                        >
                                            <Text style={[styles.genderButtonText, gender === 'other' && styles.genderButtonTextActive]}>{t('other')}</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.label}>{t('medical_history')}</Text>

                                    <TextInput
                                        style={[styles.input, styles.textArea]}
                                        value={medicalHistory}
                                        onChangeText={setMedicalHistory}
                                        placeholder={t('medical_history_placeholder')}
                                        placeholderTextColor="#94A3B8"
                                        multiline
                                        numberOfLines={4}
                                    />
                                </>
                            )}
                        </View>
                    </Animated.View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F6F7FB',
    },
    backgroundOrbOne: {
        position: 'absolute',
        top: -80,
        right: -60,
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#E8EEFF',
        opacity: 0.6,
    },
    backgroundOrbTwo: {
        position: 'absolute',
        top: 200,
        left: -80,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#EAF7F2',
        opacity: 0.7,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F6F7FB',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingBottom: 8,
        paddingTop: 8,
    },
    backButton: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
    },
    saveButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#1F6FEB',
        borderRadius: 12,
    },
    saveButtonText: {
        fontSize: 15,
        color: 'white',
        fontWeight: '700',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2A44',
    },
    content: {
        padding: 16,
        paddingTop: 8,
    },
    imageContainer: {
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 8,
    },
    imageWrapper: {
        position: 'relative',
        marginBottom: 12,
    },
    profileImage: {
        width: 96,
        height: 96,
        borderRadius: 48,
        backgroundColor: '#E1E1E1',
        borderWidth: 3,
        borderColor: '#F6F7FB',
        shadowColor: '#1F2A44',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 14,
        elevation: 5,
    },
    placeholderImage: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E7EEFF',
    },
    placeholderText: {
        fontSize: 36,
        color: '#1F6FEB',
        fontWeight: '700',
    },
    editIconBadge: {
        position: 'absolute',
        bottom: 2,
        right: 2,
        backgroundColor: 'white',
        borderRadius: 14,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#EDF0F6',
        elevation: 3,
        shadowColor: '#1F2A44',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    changePhotoText: {
        color: '#1F6FEB',
        fontSize: 15,
        fontWeight: '600',
    },
    form: {
        backgroundColor: 'white',
        borderRadius: 18,
        padding: 20,
        shadowColor: '#1F2A44',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.08,
        shadowRadius: 18,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#EDF0F6',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#7B8191',
        marginBottom: 8,
        marginTop: 14,
        textTransform: 'uppercase',
        letterSpacing: 0.8,
    },
    input: {
        backgroundColor: '#F8F9FC',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#1F2A44',
        borderWidth: 1,
        borderColor: '#EDF0F6',
    },
    genderContainer: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 6,
    },
    genderButton: {
        flex: 1,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: '#F8F9FC',
        borderWidth: 1,
        borderColor: '#EDF0F6',
        alignItems: 'center',
    },
    genderButtonActive: {
        backgroundColor: '#1F6FEB',
        borderColor: '#1F6FEB',
    },
    genderButtonText: {
        fontSize: 14,
        color: '#7B8191',
        fontWeight: '600',
    },
    genderButtonTextActive: {
        color: 'white',
    },
    textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
        paddingTop: 14,
    },
});
