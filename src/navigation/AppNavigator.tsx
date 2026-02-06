import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import PilgrimDashboard from '../screens/PilgrimDashboard';
import ModeratorDashboard from '../screens/ModeratorDashboard';
import PilgrimProfileScreen from '../screens/PilgrimProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import SignUpScreen from '../screens/SignUpScreen';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';
import CreateGroupScreen from '../screens/CreateGroupScreen';
import GroupDetailsScreen from '../screens/GroupDetailsScreen';
import { ToastProvider } from '../components/ToastContext';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
    return (
        <ToastProvider>
            <NavigationContainer>
                <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Login" component={LoginScreen} />
                    <Stack.Screen name="SignUp" component={SignUpScreen} />
                    <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
                    <Stack.Screen name="CreateGroup" component={CreateGroupScreen} />
                    <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
                    <Stack.Screen name="PilgrimDashboard" component={PilgrimDashboard} />
                    <Stack.Screen name="PilgrimProfile" component={PilgrimProfileScreen} />
                    <Stack.Screen name="Notifications" component={NotificationsScreen} />
                    <Stack.Screen name="ModeratorDashboard" component={ModeratorDashboard} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </ToastProvider>
    );
}
