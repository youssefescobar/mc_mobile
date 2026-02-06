import React, { createContext, useContext, useState, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Toast, { ToastType } from './Toast';

interface ToastState {
    visible: boolean;
    message: string;
    type: ToastType;
    title?: string;
    actionLabel?: string;
    onAction?: () => void;
}

interface ToastContextType {
    showToast: (
        message: string,
        type: ToastType,
        options?: {
            title?: string;
            actionLabel?: string;
            onAction?: () => void;
        }
    ) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toast, setToast] = useState<ToastState>({
        visible: false,
        message: '',
        type: 'info',
    });

    const showToast = (
        message: string,
        type: ToastType,
        options?: {
            title?: string;
            actionLabel?: string;
            onAction?: () => void;
        }
    ) => {
        setToast({
            visible: true,
            message,
            type,
            title: options?.title,
            actionLabel: options?.actionLabel,
            onAction: options?.onAction,
        });
    };

    const hideToast = () => {
        setToast((prev) => ({ ...prev, visible: false }));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            <View style={styles.container}>
                {children}
                <Toast
                    visible={toast.visible}
                    message={toast.message}
                    type={toast.type}
                    title={toast.title}
                    actionLabel={toast.actionLabel}
                    onAction={toast.onAction}
                    onDismiss={hideToast}
                />
            </View>
        </ToastContext.Provider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
