import { useWindowDimensions } from 'react-native';

export function useWideLayout() {
  const { width } = useWindowDimensions();
  return process.env.EXPO_OS === 'web' && width >= 900;
}
