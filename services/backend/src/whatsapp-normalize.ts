import { normalizeMessageContent, jidNormalizedUser, type WAMessage, type WAMessageContent } from '@whiskeysockets/baileys';
import { type Message } from '@replybot/core';
export function directJid(jid: string): boolean {
  return /^(\d+)@(s\.whatsapp\.net|lid)$/.test(jid);
}
export function messageId(chat: string, id: string): string { return 'wa:'+chat+':'+id; }
export function isViewOnce(raw: WAMessage): boolean {
  if (raw.key.isViewOnce) return true;
  let content: WAMessageContent | null | undefined = raw.message;
  for (let depth = 0; content && depth < 10; depth++) {
    if (content.viewOnceMessage || content.viewOnceMessageV2 || content.viewOnceMessageV2Extension) return true;
    content = content.ephemeralMessage?.message ?? content.documentWithCaptionMessage?.message ?? content.editedMessage?.message ?? content.deviceSentMessage?.message;
  }
  return false;
}
export function normalizeWhatsApp(raw: WAMessage, accountId: string, chat: string, source: Message['source']): Message | null {
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
  const media = photo ? { kind: 'image' as const, access: 'missing' as const }
    : sticker ? { kind: sticker.isAnimated ? 'animated_sticker' as const : 'sticker' as const, access: 'missing' as const }
    : video ? { kind: video.gifPlayback ? 'gif' as const : 'video' as const, access: 'unsupported' as const }
    : content.audioMessage ? { kind: 'audio' as const, access: 'unsupported' as const }
    : content.documentMessage ? { kind: 'document' as const, access: 'unsupported' as const } : null;
  const context = extended?.contextInfo ?? photo?.contextInfo ?? sticker?.contextInfo ?? video?.contextInfo;
  const quoteChat = context?.remoteJid ? jidNormalizedUser(context.remoteJid) : chat;
  const quoted = context?.stanzaId && quoteChat === chat ? messageId(chat, context.stanzaId) : null;
  const seconds = Number(raw.messageTimestamp ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const unsupported = !!(content.audioMessage || content.documentMessage || video && !video.gifPlayback);
  return {
    id: messageId(chat, raw.key.id), transportId: raw.key.id, accountId, conversationId: chat,
    direction: raw.key.fromMe ? 'outbound' : 'inbound',
    authorship: raw.key.fromMe ? 'owner_written' : 'contact_written',
    text: viewOnce ? '' : (content.conversation ?? extended?.text ?? photo?.caption ?? video?.caption ?? (unsupported ? '[Unsupported attachment]' : '')),
    occurredAt: seconds*1000, source, quotedMessageId: quoted,
    statusReply: context?.remoteJid === 'status@broadcast', statusContext: null, reaction: null,
    media: media ? { ...media, fixture: null, description: 'WhatsApp '+media.kind, viewOnce, expiresAt: null } : null,
  };
}
