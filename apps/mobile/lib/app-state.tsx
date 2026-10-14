import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import Constants from 'expo-constants';
import { z } from 'zod';
import { ClientSnapshot } from '@replybot/core/api';
import { ApiClient } from './api';
import { readSetting, saveSetting } from './storage';
import { palettes, type Palette, type ThemeChoice } from './theme';

interface Controller {
  snapshot: ClientSnapshot | null; status: 'offline' | 'connecting' | 'online'; error: string | null;
  palette: Palette; dark: boolean; themeChoice: ThemeChoice; baseUrl: string; client: ApiClient;
  refresh: () => Promise<void>; clearError: () => void; reportError: (message: string) => void;
  connect: (url: string, token?: string) => Promise<void>;
  setTheme: (choice: ThemeChoice) => void;
  perform: <T>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>) => Promise<T | undefined>;
}
const Context = createContext<Controller | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>('system');
  const [baseUrl, setBaseUrl] = useState(() => {
    const host = process.env.EXPO_OS === 'web' ? globalThis.location?.hostname : Constants.expoConfig?.hostUri?.split(':')[0];
    return 'http://'+(host || '127.0.0.1')+':3210';
  });
  const [token, setToken] = useState('');
  const [snapshot, setSnapshot] = useState<ClientSnapshot | null>(null);
  const [status, setStatus] = useState<Controller['status']>('offline');
  const [error, setError] = useState<string | null>(null);
  const client = useMemo(() => new ApiClient(baseUrl, token), [baseUrl, token]);
  const dark = themeChoice === 'dark' || (themeChoice === 'system' && system === 'dark');
  useEffect(() => {
    let active = true;
    void Promise.all([readSetting('replybot-session'), readSetting('replybot-theme')]).then(([session, theme]) => {
      if (!active) return;
      if (theme === 'light' || theme === 'dark' || theme === 'system') setThemeChoice(theme);
      if (session) {
        const parsed = z.object({ url: z.string().url(), token: z.string() }).parse(JSON.parse(session));
        setBaseUrl(parsed.url); setToken(parsed.token);
      }
    }).catch(() => { if (active) setError('Saved connection could not be restored. Reconnect this client.'); });
    return () => { active = false; };
  }, []);
  const refresh = useCallback(async () => {
    if (!token) return;
    try { setSnapshot(await client.request('/v1/snapshot', ClientSnapshot)); setStatus('online'); }
    catch (e) { setStatus('offline'); setError(e instanceof Error ? e.message : 'Service unavailable.'); }
  }, [client, token]);
  useEffect(() => {
    if (!token) return;
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(timer);
  }, [refresh, token]);
  const connect = async (url: string, enteredToken?: string) => {
    setStatus('connecting'); setError(null);
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('Use an HTTP or HTTPS service address.');
      const secret = enteredToken?.trim() || await ApiClient.provision(url);
      const candidate = new ApiClient(url, secret);
      const data = await candidate.request('/v1/snapshot', ClientSnapshot);
      await saveSetting('replybot-session', JSON.stringify({ url, token: secret }));
      setBaseUrl(url); setToken(secret); setSnapshot(data); setStatus('online');
    } catch (e) { setStatus('offline'); setError(e instanceof Error ? e.message : 'Connection failed.'); }
  };
  const perform = async <T,>(path: string, schema: z.ZodType<T>, payload?: Record<string, unknown>): Promise<T | undefined> => {
    setError(null);
    try { const result = await client.request(path, schema, payload); await refresh(); return result; }
    catch (e) { setError(e instanceof Error ? e.message : 'Action failed.'); return undefined; }
  };
  return <Context value={{ snapshot, status, error, palette: dark ? palettes.dark : palettes.light, dark,
    themeChoice, baseUrl, client, refresh, connect, perform, clearError: () => setError(null), reportError: setError,
    setTheme: choice => { setThemeChoice(choice); void saveSetting('replybot-theme', choice).catch(() => setError('Theme preference could not be saved.')); } }}>
    {children}
  </Context>;
}
export function useApp(): Controller {
  const controller = use(Context);
  if (!controller) throw new Error('AppProvider is missing');
  return controller;
}
