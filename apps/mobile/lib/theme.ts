export type ThemeChoice = 'system' | 'light' | 'dark';
export const palettes = {
  dark: { background: '#111418', surface: '#22262D', text: '#F3F5F7', muted: '#A2AAB4',
    border: '#30363E', accent: '#7AA9FF', accentText: '#111418', outgoing: '#293B55', accentSoft: '#1D2A3C', danger: '#FFB0B0' },
  light: { background: '#F7F8FA', surface: '#FFFFFF', text: '#151B23', muted: '#617081',
    border: '#E0E5EC', accent: '#2C68D4', accentText: '#FFFFFF', outgoing: '#DCE8FA', accentSoft: '#EAF0FC', danger: '#AB2634' },
};
export type Palette = typeof palettes.dark;
export const fonts = { regular: 'Inter_400Regular', medium: 'Inter_500Medium', semibold: 'Inter_600SemiBold', bold: 'Inter_700Bold' };
