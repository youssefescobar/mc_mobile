import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';

interface Props {
    initialRegion?: {
        latitude: number;
        longitude: number;
        latitudeDelta: number;
        longitudeDelta: number;
    };
    markers?: Array<{
        id: string;
        latitude: number;
        longitude: number;
        title?: string;
        description?: string;
    }>;
    onLocationUpdate?: (location: Location.LocationObject) => void;
    highlightedMarkerId?: string | null;
    followsUserLocation?: boolean;
    showsUserLocation?: boolean;
}

export default function Map({
    initialRegion,
    markers = [],
    onLocationUpdate,
    highlightedMarkerId,
    followsUserLocation = true,
    showsUserLocation = true
}: Props) {
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setErrorMsg('Permission to access location was denied');
                return;
            }

            let location = await Location.getCurrentPositionAsync({});
            setLocation(location);
            if (onLocationUpdate) {
                onLocationUpdate(location);
            }
        })();
    }, []);

    if (errorMsg) {
        return (
            <View style={styles.container}>
                <Text>{errorMsg}</Text>
            </View>
        );
    }

    if (!location && !initialRegion) {
        return (
            <View style={styles.container}>
                <ActivityIndicator size="large" />
                <Text>Acquiring GPS...</Text>
            </View>
        );
    }

    const region = initialRegion || (location ? {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
    } : undefined);

    return (
        <View style={styles.container}>
            <MapView
                style={styles.map}
                region={region}
                showsUserLocation={showsUserLocation}
                followsUserLocation={followsUserLocation}
            >
                {markers.map(marker => (
                    <Marker
                        key={marker.id}
                        coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
                        title={marker.title}
                        description={marker.description}
                        pinColor={highlightedMarkerId === marker.id ? '#2563EB' : '#10B981'}
                    />
                ))}
            </MapView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        alignItems: 'center',
        justifyContent: 'center',
    },
    map: {
        width: Dimensions.get('window').width,
        height: '100%', // Take full height of container
    },
});
