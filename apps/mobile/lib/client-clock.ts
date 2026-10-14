import { useSyncExternalStore } from 'react';

// Only countdown consumers subscribe, so ticking never rerenders the provider.
export class ClientClock {
  private serverTime = Date.now();
  private calibratedAt = performance.now();
  private value = this.serverTime;
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  now = () => this.serverTime + performance.now() - this.calibratedAt;
  get = () => this.value;
  calibrate(serverTime: number) {
    if (serverTime <= 0) return;
    this.serverTime = serverTime;
    this.calibratedAt = performance.now();
    this.tick();
  }
  private tick = () => {
    this.value = this.now();
    for (const listener of this.listeners) listener();
  };
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.timer) {
      this.tick();
      this.timer = setInterval(this.tick, 1000);
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) { clearInterval(this.timer); this.timer = undefined; }
    };
  };
}
const idleSubscribe = () => () => {};
export function useClientNow(clock: ClientClock, ticking = true) {
  return useSyncExternalStore(ticking ? clock.subscribe : idleSubscribe, clock.get, clock.get);
}
