import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
let clientIdentity: Promise<string> | undefined;
export function getClientId(): Promise<string> {
  return clientIdentity ??= (async()=>{
    if(process.env.EXPO_OS === 'web' && typeof window !== 'undefined') {
      const saved=window.localStorage.getItem('replybot-client-id') ?? window.sessionStorage.getItem('replybot-client-id');
      const id=saved ?? randomUUID();window.localStorage.setItem('replybot-client-id',id);return id;
    }
    const saved=await readSetting('replybot-client-id');if(saved)return saved;
    const id=randomUUID();await saveSetting('replybot-client-id',id);return id;
  })();
}
export async function readSetting(key: string): Promise<string | null> {
  if (process.env.EXPO_OS === 'web') return typeof window === 'undefined' ? null : window.sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
export async function saveSetting(key: string, value: string): Promise<void> {
  if (process.env.EXPO_OS === 'web') { window.sessionStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}
