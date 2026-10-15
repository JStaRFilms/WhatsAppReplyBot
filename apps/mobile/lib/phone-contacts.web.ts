import type { MatchedNames } from './contact-matching';
import type { Conversation } from '@replybot/core/contracts';
export const canReadPhoneContacts = false;
export async function readMatchedNames(_conversations: readonly Conversation[], _accountId: string, _valid: () => boolean): Promise<MatchedNames> {
  throw new Error('Browser cannot read phone contacts. Sync matched names explicitly in the Android app.');
}
