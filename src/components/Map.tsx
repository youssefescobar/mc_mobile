import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MapProps {
    onLocationUpdate?: (location: any) => void;
    markers?: any[];
}

const Map = ({ onLocationUpdate, markers }: MapProps) => {
    return (
        <View style={styles.container}>
            <Text style={styles.text}>Map is disabled for testing.</Text>
            <Text style={styles.subtext}>Notifications & TTS can now be tested.</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        height: '100%',
        backgroundColor: '#e0e0e0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
    },
    subtext: {
        fontSize: 14,
        color: '#666',
        marginTop: 10,
    },
});

export default Map;
