import React from 'react';
import { View, StyleSheet } from 'react-native';
import Map from '../components/Map';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { api } from '../services/api';
import * as Location from 'expo-location';

type Props = NativeStackScreenProps<RootStackParamList, 'PilgrimDashboard'>;

export default function PilgrimDashboard({ route }: Props) {
    const { userId } = route.params;

    const handleLocationUpdate = async (location: Location.LocationObject) => {
        try {
            // Send location to backend
            // We don't have a dedicated "update location" endpoint yet, but we can assume we'll update the pilgrim profile
            // api.put('/pilgrim/location', { ... }) 
            console.log("Location updated", location.coords);
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <Map onLocationUpdate={handleLocationUpdate} />
        </View>
    );
}
