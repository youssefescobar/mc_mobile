import AsyncStorage from '@react-native-async-storage/async-storage';

export const getUserId = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('user_id');
};

export const getUserName = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('full_name');
};

export const getUserRole = async (): Promise<string | null> => {
  return await AsyncStorage.getItem('role');
};
