import { ApiClient, History } from './api';
export class HistoryCache {
  private readonly entries = new Map<string,History>();
  private readonly pending = new Map<string,Promise<History>>();
  private readonly listeners = new Set<() => void>();
  constructor(private readonly client: ApiClient) {}
  get = (id: string): History | undefined => this.entries.get(id);
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  load(id: string, refresh = false): Promise<History> {
    const running = this.pending.get(id); if (running) return running;
    const saved = this.entries.get(id); if (saved && !refresh) return Promise.resolve(saved);
    const request = this.client.request('/v1/conversations/'+encodeURIComponent(id)+'/history',History).then(history => {
      this.entries.delete(id); this.entries.set(id,history);
      if (this.entries.size > 20) { const oldest = this.entries.keys().next().value; if (oldest) this.entries.delete(oldest); }
      for (const listener of this.listeners) listener();
      return history;
    }).finally(() => { this.pending.delete(id); });
    this.pending.set(id,request); return request;
  }
}
