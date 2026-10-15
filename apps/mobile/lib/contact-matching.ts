import { ContactNamesImportInput } from '@replybot/core/api';
import type { Conversation } from '@replybot/core/contracts';
export interface ContactPage {
  data: readonly { name?: string; phoneNumbers?: readonly { number?: string }[] }[];
  hasNextPage: boolean;
}
export type MatchedNames = ContactNamesImportInput['entries'];
export function internationalNumber(value: string): string | null {
  const number = value.replace(/[\s().-]/g, '');
  return /^\+[1-9][0-9]{5,14}$/.test(number) ? number.slice(1) : null;
}
export async function collectMatchedNames(conversations: readonly Conversation[], accountId: string,
  readPage: (offset: number) => Promise<ContactPage>, valid: () => boolean): Promise<MatchedNames> {
  const eligible = new Map<string, string[]>();
  for (const chat of conversations) {
    if (chat.accountId !== accountId || chat.kind !== 'direct' || chat.nameSource === 'wa_saved'
      || !/^[1-9][0-9]{5,14}@s\.whatsapp\.net$/.test(chat.contactId)) continue;
    const number = chat.contactId.slice(0, chat.contactId.indexOf('@'));
    eligible.set(number, [...(eligible.get(number) ?? []), chat.id]);
  }
  const names = new Map<string, string | null>();
  for (let offset = 0; offset < 10000; offset += 100) {
    if (!valid()) throw new Error('Name sync stopped. No import was submitted.');
    const page = await readPage(offset);
    if (!valid()) throw new Error('Name sync stopped. No import was submitted.');
    if (page.data.length > 100 || page.hasNextPage && page.data.length === 0) throw new Error('Contact paging was inconsistent. Nothing was imported.');
    for (const contact of page.data) {
      const name = contact.name;
      for (const phone of contact.phoneNumbers ?? []) {
        const number = phone.number ? internationalNumber(phone.number) : null;
        if (!number || !eligible.has(number)) continue;
        // Invalid or conflicting labels cannot select a phone alias.
        const label = name !== undefined && ContactNamesImportInput.shape.entries.element.shape.name.safeParse(name).success ? name : null;
        if (!names.has(number)) names.set(number, label);
        else if (names.get(number) !== label) names.set(number, null);
      }
    }
    // Only matched names survive this page. No full-book cache or raw IDs are kept.
    if (!page.hasNextPage) {
      const entries: MatchedNames = [];
      for (const [number, name] of names) if (name) for (const conversationId of eligible.get(number) ?? []) entries.push({ conversationId, name });
      if (entries.length > 500) throw new Error('More than 500 matched chats. Nothing was imported.');
      return entries;
    }
  }
  throw new Error('Contact book exceeds the foreground scan limit. Nothing was imported.');
}
