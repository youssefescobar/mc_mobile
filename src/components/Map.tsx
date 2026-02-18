import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';

interface MapMarker {
    id: string;
    latitude: number;
    longitude: number;
    title?: string;
    description?: string;
    pinColor?: string;
    image?: any; // For custom marker icons if needed
}

interface MapProps {
    onLocationUpdate?: (location: any) => void;
    markers?: MapMarker[];
    initialRegion?: Region;
    highlightedMarkerId?: string | null;
    followsUserLocation?: boolean;
    showsUserLocation?: boolean;
    region?: Region;
    style?: any;
}

const Map = ({
    onLocationUpdate,
    markers = [],
    initialRegion,
    highlightedMarkerId,
    followsUserLocation = true,
    showsUserLocation = true,
    region
}: MapProps) => {
    const mapRef = useRef<MapView>(null);

    // Default to Mecca (Masjid al-Haram) if no region provided
    const defaultRegion = {
        latitude: 21.4225,
        longitude: 39.8262,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
    };

    useEffect(() => {
        if (highlightedMarkerId && mapRef.current) {
            const marker = markers.find(m => m.id === highlightedMarkerId);
            if (marker) {
                mapRef.current.animateToRegion({
                    latitude: marker.latitude,
                    longitude: marker.longitude,
                    latitudeDelta: 0.005,
                    longitudeDelta: 0.005,
                }, 1000);
            }
        }
    }, [highlightedMarkerId, markers]);

    useEffect(() => {
        if (region && mapRef.current) {
            mapRef.current.animateToRegion(region, 1000);
        }
    }, [region]);

    const handleRecenter = () => {
        // Triggers the map to center on user location if showsUserLocation is true
        // and we have permission.
        // There isn't a direct "centerOnUser" method reliable across both platforms without location state,
        // but typically setting followsUserLocation prop or just manual camera move works.
        // For now, we will rely on the standard button if available or just resetting to initial.
        if (mapRef.current) {
            // This is a bit of a hack since we don't have direct access to user location here without props,
            // but usually the parent handles "followsUserLocation".
            // If we really want to force it, we'd need to pass current location down.
        }
    };

    return (
        <View style={styles.container}>
            <MapView
                ref={mapRef}
                style={styles.map}
                provider={PROVIDER_GOOGLE}
                initialRegion={initialRegion || defaultRegion}
                showsUserLocation={showsUserLocation}
                showsMyLocationButton={true} // Native Google Maps button
                showsCompass={true}
                toolbarEnabled={false} // Hide "Open in Maps" toolbar on Android to keep them in-app
                moveOnMarkerPress={false}
                zoomEnabled={true}
                rotateEnabled={true}
            >
                {markers.map((marker) => (
                    <Marker
                        key={marker.id}
                        coordinate={{
                            latitude: marker.latitude,
                            longitude: marker.longitude,
                        }}
                        title={marker.title}
                        description={marker.description}
                        pinColor={marker.pinColor}
                        identifier={marker.id}
                    />
                ))}
            </MapView>

            {/* Custom overlay controls could go here if native buttons aren't enough */}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#e0e0e0',
        overflow: 'hidden', // Ensure map doesn't bleed out
        borderRadius: 16, // Match parent container radius usually
    },
    map: {
        width: '100%',
        height: '100%',
    },
});

export default Map;
