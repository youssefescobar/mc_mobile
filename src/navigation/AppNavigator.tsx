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
import AdminDashboard from '../screens/AdminDashboard';
import { ToastProvider } from '../components/ToastContext';

import * as Linking from 'expo-linking';
import PilgrimSignUpScreen from '../screens/PilgrimSignUpScreen';
import PilgrimMessagesScreen from '../screens/PilgrimMessagesScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking = {
    prefixes: [Linking.createURL('/'), 'mc_mobile://'],
    config: {
        screens: {
            Login: 'login',
            PilgrimSignUp: 'pilgrim-signup',
            GroupDetails: 'group/:groupId',
        },
    },
};

export default function AppNavigator() {
    return (
        <ToastProvider>
            <NavigationContainer linking={linking}>
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
                    <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
                    <Stack.Screen name="EditProfile" component={EditProfileScreen} />
                    <Stack.Screen name="PilgrimSignUp" component={PilgrimSignUpScreen} />
                    <Stack.Screen name="PilgrimMessagesScreen" component={PilgrimMessagesScreen} />
                </Stack.Navigator>
            </NavigationContainer>
        </ToastProvider>
    );
}
