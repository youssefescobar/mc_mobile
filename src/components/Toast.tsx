import React, { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity, Dimensions, View } from 'react-native';

const { width } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
    visible: boolean;
    message: string;
    type: ToastType;
    title?: string;
    onDismiss: () => void;
    duration?: number;
    actionLabel?: string;
    onAction?: () => void;
}

const COLORS = {
    success: {
        bg: '#10B981',
        icon: '✓',
    },
    error: {
        bg: '#EF4444',
        icon: '✕',
    },
    info: {
        bg: '#3B82F6',
        icon: 'ℹ',
    },
};

export default function Toast({
    visible,
    message,
    type,
    title,
    onDismiss,
    duration = 3000,
    actionLabel,
    onAction,
}: ToastProps) {
    const translateY = useRef(new Animated.Value(-150)).current;
    const opacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            // Slide in
            Animated.parallel([
                Animated.spring(translateY, {
                    toValue: 0,
                    useNativeDriver: true,
                    tension: 50,
                    friction: 8,
                }),
                Animated.timing(opacity, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true,
                }),
            ]).start();

            // Auto dismiss
            if (duration > 0) {
                const timer = setTimeout(() => {
                    handleDismiss();
                }, duration);
                return () => clearTimeout(timer);
            }
        }
    }, [visible]);

    const handleDismiss = () => {
        Animated.parallel([
            Animated.timing(translateY, {
                toValue: -150,
                duration: 200,
                useNativeDriver: true,
            }),
            Animated.timing(opacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }),
        ]).start(() => {
            onDismiss();
        });
    };

    const handleAction = () => {
        if (onAction) {
            onAction();
        }
        handleDismiss();
    };

    if (!visible) return null;

    const colors = COLORS[type];

    return (
        <Animated.View
            style={[
                styles.container,
                { backgroundColor: colors.bg },
                { transform: [{ translateY }], opacity },
            ]}
        >
            <TouchableOpacity
                style={styles.content}
                onPress={handleDismiss}
                activeOpacity={0.9}
            >
                <View style={styles.iconContainer}>
                    <Text style={styles.iconText}>{colors.icon}</Text>
                </View>
                <View style={styles.textContainer}>
                    {title && <Text style={styles.title}>{title}</Text>}
                    <Text style={styles.message} numberOfLines={2}>{message}</Text>
                </View>
                {actionLabel && (
                    <TouchableOpacity style={styles.actionButton} onPress={handleAction}>
                        <Text style={styles.actionText}>{actionLabel}</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 10,
        left: 20,
        right: 20,
        maxWidth: width - 40,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 10,
        zIndex: 9999,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    iconText: {
        fontSize: 16,
        color: 'white',
        fontWeight: 'bold',
    },
    textContainer: {
        flex: 1,
    },
    title: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    message: {
        color: 'rgba(255,255,255,0.95)',
        fontSize: 14,
        fontWeight: '500',
    },
    actionButton: {
        backgroundColor: 'rgba(255,255,255,0.25)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginLeft: 8,
    },
    actionText: {
        color: 'white',
        fontWeight: '600',
        fontSize: 13,
    },
});
