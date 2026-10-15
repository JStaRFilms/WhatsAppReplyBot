import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ProfileScope, type PcDisplay } from '@replybot/core/api';

const Identity = z.object({ rootId: z.string(), instanceId: z.string(), profileScope: ProfileScope });
export const PcDisplayIntent = Identity.extend({ type: z.literal('otherme-pc-display'), requestId: z.string().min(1).max(96), nonce: z.string().uuid() }).strict();
export type PcDisplayIntent = z.infer<typeof PcDisplayIntent>;
const Ack = Identity.extend({ type: z.literal('otherme-pc-display-ack'), requestId: z.string().min(1).max(96), nonce: z.string().uuid(), state: z.enum(['ready', 'unavailable', 'expired']) }).strict();

export class PcQrDisplay {
  private active: { intent: PcDisplayIntent; state: PcDisplay['state']; expires: number } | undefined;
  constructor(private readonly identity: z.infer<typeof Identity>, private readonly now = Date.now) {}
  request(requestId: string, available: boolean): PcDisplayIntent {
    const intent: PcDisplayIntent = { ...this.identity, type: 'otherme-pc-display', requestId, nonce: randomUUID() };
    this.active = { intent, state: available ? 'requested' : 'unavailable', expires: this.now() + 60000 };
    return intent;
  }
  acknowledge(value: unknown): void {
    const result = Ack.safeParse(value); const active = this.active;
    if (!result.success || !active) return;
    const ack = result.data; const intent = active.intent;
    if (ack.requestId !== intent.requestId || ack.nonce !== intent.nonce || ack.rootId !== intent.rootId || ack.instanceId !== intent.instanceId
      || ack.profileScope.profileId !== intent.profileScope.profileId || ack.profileScope.accountId !== intent.profileScope.accountId
      || ack.profileScope.revision !== intent.profileScope.revision) return;
    this.snapshot();
    if (active.state === 'requested' || active.state === 'ready') active.state = ack.state;
  }
  unavailable(intent: PcDisplayIntent): void {
    if (this.active?.intent === intent && this.active.state === 'requested') this.active.state = 'unavailable';
  }
  expire(): void {
    if (this.active && ['requested', 'ready'].includes(this.active.state)) this.active.state = 'expired';
  }
  snapshot(): PcDisplay | undefined {
    if (!this.active) return;
    if (this.now() >= this.active.expires) this.expire();
    return { requestId: this.active.intent.requestId, state: this.active.state };
  }
}
