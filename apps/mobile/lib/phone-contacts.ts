import { Platform } from 'react-native';
import * as Contacts from 'expo-contacts/legacy';
import type { Conversation } from '@replybot/core/contracts';
import { collectMatchedNames, type MatchedNames } from './contact-matching';
export const canReadPhoneContacts = Platform.OS === 'android';
// Called only by the explicit foreground Sync matched names gesture.
export async function readMatchedNames(conversations: readonly Conversation[], accountId: string, valid: () => boolean): Promise<MatchedNames> {
  if (!canReadPhoneContacts || !valid()) throw new Error('Name sync is available only in the active Android app.');
  let permission = await Contacts.getPermissionsAsync();
  if (!valid()) throw new Error('Name sync stopped. Nothing was imported.');
  if (!permission.granted && permission.canAskAgain) permission = await Contacts.requestPermissionsAsync();
  if (!valid()) throw new Error('Name sync stopped. Nothing was imported.');
  if (!permission.granted) throw new Error('Contacts permission is denied or restricted. WhatsApp and number fallbacks remain. Enable Contacts in Android settings, then choose Sync matched names.');
  return collectMatchedNames(conversations, accountId, async pageOffset => {
    if (!valid()) throw new Error('Name sync stopped. Nothing was imported.');
    const checked = await Contacts.getPermissionsAsync();
    if (!valid() || !checked.granted) throw new Error('Contacts permission is no longer available. Nothing was imported.');
    return Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers], pageSize: 100, pageOffset });
  }, valid);
}
