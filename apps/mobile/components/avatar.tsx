import { Text, View } from 'react-native';
import { useApp } from '../lib/app-state';
import { fonts } from '../lib/theme';
export function Avatar({ name, size = 48, unread = 0 }: { name: string; size?: number; unread?: number }) {
  const { palette } = useApp();
  const initials = name.split(/\s+/).slice(0,2).map(part => part[0] ?? '').join('').toUpperCase();
  return <View style={{ width: size, height: size, flexShrink: 0, borderRadius: size/2, backgroundColor: palette.outgoing, alignItems: 'center', justifyContent: 'center' }}>
    <Text style={{ fontFamily: fonts.semibold, color: palette.text, fontSize: size > 40 ? 15 : 12 }}>{initials}</Text>
    {unread>0&&<View accessibilityLabel={unread+' unread messages in Otherme'} style={{position:'absolute',right:-4,bottom:-3,minWidth:22,minHeight:22,paddingHorizontal:4,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:palette.auto,borderWidth:2,borderColor:palette.background}}>
      <Text style={{fontFamily:fonts.semibold,fontSize:11,color:palette.background}}>{unread>99?'99+':unread}</Text>
    </View>}
  </View>;
}
