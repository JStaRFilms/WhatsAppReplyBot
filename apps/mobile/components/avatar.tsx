import { Text, View } from 'react-native';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function Avatar({ name, size = 48 }: { name: string; size?: number }) {
  const { palette } = useApp();
  const initials = name.split(/\s+/).slice(0,2).map(part => part[0] ?? '').join('').toUpperCase();
  return <View style={{ width: size, height: size, borderRadius: size/2, backgroundColor: palette.outgoing, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: fonts.semibold, color: palette.text, fontSize: size > 40 ? 15 : 12 }}>{initials}</Text>
  </View>;
}
