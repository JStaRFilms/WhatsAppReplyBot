import * as SecureStore from 'expo-secure-store';
export async function readSetting(key: string): Promise<string | null> {
  if (process.env.EXPO_OS === 'web') return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function saveSetting(key: string, value: string): Promise<void> {
  if (process.env.EXPO_OS === 'web') { window.sessionStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
