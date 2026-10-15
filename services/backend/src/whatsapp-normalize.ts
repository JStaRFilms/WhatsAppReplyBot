import { createHash } from 'node:crypto';
import { proto, normalizeMessageContent, jidNormalizedUser, type WAMessage, type WAMessageContent } from '@whiskeysockets/baileys';
import { type Message, type RawHistoryEvidence } from '@replybot/core';
export function decodeStoredMessage(payload: string | undefined): WAMessage | undefined {
  if (!payload) return undefined;
  try {
    const value: unknown = JSON.parse(payload);
    if (!value || typeof value !== 'object' || !('protobuf' in value) || typeof value.protobuf !== 'string') return undefined;
    const raw = proto.WebMessageInfo.decode(Buffer.from(value.protobuf,'base64'));
    return raw.key ? {...raw,key:raw.key} : undefined;
  } catch { return undefined; }
}
export function attachmentIdentity(raw: WAMessage): string | null {
  const content = normalizeMessageContent(raw.message);
  const item = content?.imageMessage ?? content?.stickerMessage ?? content?.videoMessage ?? content?.audioMessage;
  if (item?.fileSha256?.length !== 32 || item.mediaKey?.length !== 32) return null;
  const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  return createHash('sha256').update(JSON.stringify([digest(item.fileSha256),digest(item.mediaKey),Number(item.fileLength ?? 0),
    item.mimetype ?? null,'width' in item ? item.width : null,'height' in item ? item.height : null,'seconds' in item ? item.seconds : null,
    content?.imageMessage ? 'image' : content?.stickerMessage ? 'sticker' : content?.videoMessage ? 'video' : 'audio'])).digest('hex');
}
export function inspectHistoryRaw(payload: string): RawHistoryEvidence {
  const value:unknown=JSON.parse(payload);
  const record=!!value && typeof value==='object' ? value : {};
  const conflict='historyConflict' in record && record.historyConflict===true;
  const viewOnce='historyViewOnce' in record && record.historyViewOnce===true;
  const expiresAt='historyExpiresAt' in record && typeof record.historyExpiresAt==='number' ? record.historyExpiresAt : null;
  const raw = decodeStoredMessage(payload);
  if (!raw) {
    return {conflict,deleted:!!value && typeof value === 'object' && 'deleted' in value && value.deleted === true,
      viewOnce,expiresAt,mediaIdentity:null};
  }
  const content=normalizeMessageContent(raw.message);
  const context=content?.extendedTextMessage?.contextInfo ?? content?.imageMessage?.contextInfo ?? content?.videoMessage?.contextInfo
    ?? content?.stickerMessage?.contextInfo ?? content?.audioMessage?.contextInfo;
  const seconds=Number(raw.messageTimestamp ?? 0);
  const rawExpiry=context?.expiration && seconds>0 ? (seconds+context.expiration)*1000 : null;
  return {conflict,deleted:false,viewOnce:viewOnce || isViewOnce(raw),
    expiresAt:rawExpiry===null ? expiresAt : Math.min(rawExpiry,expiresAt ?? Infinity),mediaIdentity:attachmentIdentity(raw)};
}
export function directJid(jid: string): boolean {
  return /^(\d+)@(s\.whatsapp\.net|lid)$/.test(jid);
}
export function messageId(chat: string, id: string): string { return 'wa:'+chat+':'+id; }
export function isViewOnce(raw: WAMessage): boolean {
  if (raw.key.isViewOnce) return true;
  let content: WAMessageContent | null | undefined = raw.message;
  for (let depth = 0; content && depth < 10; depth++) {
    if (content.viewOnceMessage || content.viewOnceMessageV2 || content.viewOnceMessageV2Extension || content.audioMessage?.viewOnce) return true;
    content = content.ephemeralMessage?.message ?? content.documentWithCaptionMessage?.message ?? content.editedMessage?.message ?? content.deviceSentMessage?.message;
  }
  return false;
}
export function normalizeWhatsApp(raw: WAMessage, accountId: string, chat: string, source: Message['source'], verifiedQuoteChat = (id:string) => id === chat): Message | null {
  if (!raw.key.id || !raw.message || !directJid(chat)) return null;
  const original = raw.message;
  const viewOnce = isViewOnce(raw);
  const content = normalizeMessageContent(original);
  if (!content || content.protocolMessage || content.reactionMessage) return null;
  if (viewOnce && !content.imageMessage && !content.stickerMessage && !content.videoMessage && !content.audioMessage && !content.documentMessage) return null;
  const photo = content.imageMessage;
  const sticker = content.stickerMessage;
  const video = content.videoMessage;
  const extended = content.extendedTextMessage;
  const media = photo ? { kind: 'image' as const, access: 'available' as const }
    : sticker ? { kind: sticker.isAnimated ? 'animated_sticker' as const : 'sticker' as const, access: 'available' as const }
    : video ? video.gifPlayback ? { kind:'gif' as const,access:'available' as const } : {kind:'video' as const,access:'unsupported' as const}
    : content.audioMessage ? { kind: 'audio' as const, access: 'available' as const }
    : content.documentMessage ? { kind: 'document' as const, access: 'unsupported' as const } : null;
  const context = extended?.contextInfo ?? photo?.contextInfo ?? sticker?.contextInfo ?? video?.contextInfo ?? content.audioMessage?.contextInfo;
  const quoteChat = context?.remoteJid ? jidNormalizedUser(context.remoteJid) : chat;
  const quoted = context?.stanzaId && directJid(quoteChat) && verifiedQuoteChat(quoteChat) ? messageId(quoteChat, context.stanzaId) : null;
  const seconds = Number(raw.messageTimestamp ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const unsupported = !!(content.documentMessage || video && !video.gifPlayback);
  return {
    id: messageId(chat, raw.key.id), transportId: raw.key.id, accountId, conversationId: chat,
    contentState: !media && !(content.conversation ?? extended?.text ?? '').trim()
      && Object.keys(content).every(key=>key==='conversation' || key==='extendedTextMessage') ? 'partial' : 'complete',
    direction: raw.key.fromMe ? 'outbound' : 'inbound',
    authorship: raw.key.fromMe ? 'owner_written' : 'contact_written',
    text: viewOnce ? '' : (content.conversation ?? extended?.text ?? photo?.caption ?? video?.caption ?? (unsupported ? '[Unsupported attachment]' : '')),
    occurredAt: seconds*1000, source, quotedMessageId: quoted,
    statusReply: context?.remoteJid === 'status@broadcast', statusContext: null, reaction: null,
    media: media ? { ...media, fixture: null, description: 'WhatsApp '+media.kind, viewOnce,
      ...((photo ?? sticker ?? video) ? {mime:(photo ?? sticker ?? video)?.mimetype ?? undefined,
        width:(photo ?? sticker ?? video)?.width || undefined,height:(photo ?? sticker ?? video)?.height || undefined,
        ...(video ? {duration:Number(video.seconds ?? 0)} : {})} : {}),
      ...(content.audioMessage ? {mime:content.audioMessage.mimetype ?? 'audio/ogg',duration:Number(content.audioMessage.seconds ?? 0)} : {}),
      expiresAt: context?.expiration && context.expiration > 0 ? (seconds+context.expiration)*1000 : null } : null,
  };
}
