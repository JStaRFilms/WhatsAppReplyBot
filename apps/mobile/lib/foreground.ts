import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

export function isForeground() {
  return (AppState.currentState === 'active' || AppState.currentState === null)
    && (typeof document === 'undefined' || document.visibilityState === 'visible' && document.hasFocus());
}
export function useForeground() {
  const [visible, setVisible] = useState(isForeground);
  useEffect(() => {
    const update = () => setVisible(isForeground());
    const subscription = AppState.addEventListener('change', update);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', update);
    if (typeof window !== 'undefined') { window.addEventListener('focus',update); window.addEventListener('blur',update); }
    update();
    return () => {
      subscription.remove();
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', update);
      if (typeof window !== 'undefined') { window.removeEventListener('focus',update); window.removeEventListener('blur',update); }
    };
  }, []);
  return visible;
}
