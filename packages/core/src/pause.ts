import type { Conversation, PauseState } from './contracts.ts';
export const OWNER_COOLDOWN = 5*60*1000;
export function pauseState(c: Conversation): PauseState {
  return c.pause ? { ...c.pause } : { until:null,indefinite:c.control === 'manual',handover:false,composing:false,typingUntil:null,sending:false,catchUpMessageId:null };
}
export function held(p: PauseState, now: number): boolean {
  return p.indefinite || p.handover || p.composing || p.sending || (p.until ?? 0)>now || (p.typingUntil ?? 0)>now;
}
