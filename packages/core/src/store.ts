import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { HistoryCursor, historyDigest, eventIdentity, partialMessage, automaticTrigger, type RawHistoryEvidence, type HistorySource } from './history.ts';
import { z } from 'zod';
import { Conversation, Message, Draft, Grant, Outbox, Proposal, DomainError, ImageUpload, AudioUpload, AudioTranscript, AsrSource, AsrProvenance, OutgoingReceipt, type NameSource } from './contracts.ts';

import { AssistantTurn, OwnerInstructions, ContactNameSettings, type HistoryGroup, type HistoryPage } from './api.ts';

const Payload = z.object({ payload: z.string() });
const Cached = z.object({ payload_hash: z.string(), result: z.string() });
const AsrRow = z.object({attemptId:z.string(),state:z.enum(['reserved','complete','unknown','suppressed']),
  transcript:z.string().nullable(),provenance:z.string().nullable()});
type Table = 'conversations' | 'messages' | 'drafts' | 'delegations' | 'outbox' | 'owner_actions';
type RecordData = Conversation | Message | Draft | Grant | Outbox | Proposal;

export class SqliteStore {
  private readonly db: DatabaseSync;
  constructor(path = ':memory:') {
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)),
        UNIQUE(account_id,id));
      CREATE TABLE IF NOT EXISTS api_requests (
        account_id TEXT NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
        result TEXT NOT NULL, PRIMARY KEY(account_id,request_id));
      CREATE TABLE IF NOT EXISTS account_settings (
        account_id TEXT PRIMARY KEY, model_consent INTEGER NOT NULL DEFAULT 0 CHECK(model_consent IN (0,1)));
      CREATE TABLE IF NOT EXISTS history_versions (account_id TEXT NOT NULL,conversation_id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(account_id,conversation_id));
      CREATE TABLE IF NOT EXISTS conversation_views (account_id TEXT NOT NULL,conversation_id TEXT NOT NULL,last_rowid INTEGER NOT NULL,PRIMARY KEY(account_id,conversation_id));
      CREATE TABLE IF NOT EXISTS composer_holds (account_id TEXT NOT NULL,conversation_id TEXT NOT NULL,client_id TEXT NOT NULL,has_text INTEGER NOT NULL CHECK(has_text IN (0,1)),PRIMARY KEY(account_id,conversation_id,client_id));
      CREATE TABLE IF NOT EXISTS wa_aliases (account_id TEXT NOT NULL, alias TEXT NOT NULL, canonical TEXT NOT NULL, PRIMARY KEY(account_id,alias));
      CREATE TABLE IF NOT EXISTS wa_messages (account_id TEXT NOT NULL, conversation_id TEXT NOT NULL, transport_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)), PRIMARY KEY(account_id,conversation_id,transport_id));
      CREATE TABLE IF NOT EXISTS image_uploads (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        mime TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL, bytes BLOB NOT NULL,
        created_at INTEGER NOT NULL, FOREIGN KEY(account_id,conversation_id) REFERENCES conversations(account_id,id));
      CREATE TABLE IF NOT EXISTS audio_uploads (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        mime TEXT NOT NULL, duration REAL NOT NULL, bytes BLOB NOT NULL, created_at INTEGER NOT NULL,
        FOREIGN KEY(account_id,conversation_id) REFERENCES conversations(account_id,id));
      CREATE TABLE IF NOT EXISTS assistant_turns (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload)));`);
    for (const table of ['messages', 'drafts', 'delegations', 'outbox', 'owner_actions'] as const) {
      this.db.exec(`CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        payload TEXT NOT NULL CHECK(json_valid(payload)),
        FOREIGN KEY(account_id,conversation_id) REFERENCES conversations(account_id,id));
        CREATE INDEX IF NOT EXISTS ${table}_conversation ON ${table}(account_id,conversation_id);`);
    }
    const columns = new Set(this.db.prepare('PRAGMA table_info(account_settings)').all().map(row => row.name));
    for (const [column, declaration] of Object.entries({
      owner_instructions: "TEXT NOT NULL DEFAULT ''", owner_instructions_revision: 'INTEGER NOT NULL DEFAULT 0',
      contact_book_names_enabled: 'INTEGER NOT NULL DEFAULT 0', contact_names_revision: 'INTEGER NOT NULL DEFAULT 0',
      phone_names_synced_at: 'INTEGER', phone_names_import_request_id: 'TEXT', release_context_version: 'INTEGER NOT NULL DEFAULT 0',
      history_projection_version: 'INTEGER NOT NULL DEFAULT 0', media_cache_id: 'TEXT',
    })) if (!columns.has(column)) this.db.exec(`ALTER TABLE account_settings ADD COLUMN ${column} ${declaration}`);
    this.db.exec(`CREATE TABLE IF NOT EXISTS contact_names (
      account_id TEXT NOT NULL, conversation_id TEXT NOT NULL, source TEXT NOT NULL, name TEXT NOT NULL, updated_at INTEGER NOT NULL, phone_import_request_id TEXT,
      PRIMARY KEY(account_id,conversation_id,source),
      FOREIGN KEY(account_id,conversation_id) REFERENCES conversations(account_id,id));
      CREATE TABLE IF NOT EXISTS wa_receipts (
      account_id TEXT NOT NULL, conversation_id TEXT NOT NULL, transport_id TEXT NOT NULL,
      level TEXT NOT NULL, observed_at INTEGER NOT NULL, source TEXT NOT NULL,
      PRIMARY KEY(account_id,conversation_id,transport_id),
      FOREIGN KEY(account_id,conversation_id) REFERENCES conversations(account_id,id));`);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS history_group_state (account_id TEXT NOT NULL, conversation_id TEXT NOT NULL,
        revision INTEGER NOT NULL, source_epoch INTEGER NOT NULL, PRIMARY KEY(account_id,conversation_id));
      CREATE UNIQUE INDEX IF NOT EXISTS message_account_id ON messages(account_id,id);
      CREATE TABLE IF NOT EXISTS message_views (account_id TEXT NOT NULL,message_id TEXT NOT NULL,PRIMARY KEY(account_id,message_id),
        FOREIGN KEY(account_id,message_id) REFERENCES messages(account_id,id));
      CREATE INDEX IF NOT EXISTS message_paging ON messages(account_id,conversation_id,json_extract(payload,'$.occurredAt'),id);
      CREATE INDEX IF NOT EXISTS message_time ON messages(account_id,conversation_id,json_extract(payload,'$.occurredAt') DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS message_transport_id ON messages(
        account_id,conversation_id,json_extract(payload,'$.transportId'));
      CREATE UNIQUE INDEX IF NOT EXISTS outbox_request_id ON outbox(account_id,json_extract(payload,'$.requestId'));
      CREATE UNIQUE INDEX IF NOT EXISTS active_grant ON delegations(account_id,conversation_id)
        WHERE json_extract(payload,'$.state')='active';
      CREATE TABLE IF NOT EXISTS asr_attempts (
        account_id TEXT NOT NULL,profile_id TEXT NOT NULL,source_key TEXT NOT NULL,content_id TEXT NOT NULL,
        conversation_id TEXT NOT NULL,message_id TEXT NOT NULL,transport_id TEXT NOT NULL,attempt_id TEXT NOT NULL UNIQUE,
        state TEXT NOT NULL CHECK(state IN ('reserved','complete','unknown','suppressed')),
        transcript TEXT CHECK(transcript IS NULL OR json_valid(transcript)),provenance TEXT CHECK(provenance IS NULL OR json_valid(provenance)),
        expires_at REAL,last_used REAL NOT NULL,PRIMARY KEY(account_id,profile_id,source_key,content_id));
      CREATE INDEX IF NOT EXISTS asr_source ON asr_attempts(account_id,conversation_id,transport_id);
      UPDATE asr_attempts SET state='unknown' WHERE state='reserved';`);
    this.pruneAsr(Date.now());
  }
  private asrKey(source:AsrSource):string {
    return historyDigest([source.conversationId,source.messageId,source.transportId]);
  }
  pruneAsr(now:number):void {
    this.db.prepare(`UPDATE asr_attempts SET state='suppressed',transcript=NULL,provenance=NULL
      WHERE expires_at IS NOT NULL AND expires_at<=? AND state IN ('reserved','complete','unknown')`).run(now);
  }
  asrAttempt(input:AsrSource,now:number) {
    const source=AsrSource.parse(input);this.pruneAsr(now);
    const row=this.db.prepare(`SELECT attempt_id AS attemptId,state,transcript,provenance FROM asr_attempts
      WHERE account_id=? AND profile_id=? AND source_key=? AND content_id=?`)
      .get(source.accountId,source.profileId,this.asrKey(source),source.contentId);
    if(!row)return undefined;
    const saved=AsrRow.parse(row);
    if(saved.state==='complete' && saved.transcript!==null){
      this.db.prepare('UPDATE asr_attempts SET last_used=? WHERE account_id=? AND attempt_id=?').run(now,source.accountId,saved.attemptId);
      return {...saved,transcript:AudioTranscript.parse(JSON.parse(saved.transcript)),
        provenance:saved.provenance===null ? null : AsrProvenance.parse(JSON.parse(saved.provenance))};
    }
    return {...saved,transcript:null,provenance:null};
  }
  reserveAsr(input:AsrSource,expiresAt:number|null,now:number):string {
    const source=AsrSource.parse(input);
    return this.transaction(()=>{
      this.pruneAsr(now);
      if(expiresAt!==null && expiresAt<=now)throw new DomainError('audio_source_unavailable',410);
      if(this.asrAttempt(source,now))throw new DomainError('audio_attempt_unavailable',409);
      const count=this.db.prepare('SELECT COUNT(*) AS count FROM asr_attempts WHERE account_id=?').get(source.accountId);
      if(z.object({count:z.number()}).parse(count).count>=10000)throw new DomainError('audio_attempt_capacity',503);
      const id=randomUUID();
      this.db.prepare(`INSERT INTO asr_attempts(account_id,profile_id,source_key,content_id,conversation_id,message_id,
        transport_id,attempt_id,state,expires_at,last_used) VALUES(?,?,?,?,?,?,?,?,'reserved',?,?)`)
        .run(source.accountId,source.profileId,this.asrKey(source),source.contentId,source.conversationId,source.messageId,source.transportId,id,expiresAt,now);
      return id;
    });
  }
  completeAsr(input:AsrSource,attemptId:string,transcript:AudioTranscript,provenance:AsrProvenance,now:number):boolean {
    const source=AsrSource.parse(input),text=JSON.stringify(AudioTranscript.parse(transcript)),origin=JSON.stringify(AsrProvenance.parse(provenance));
    return this.transaction(()=>{
      this.pruneAsr(now);
      const updated=this.db.prepare(`UPDATE asr_attempts SET state='complete',transcript=?,provenance=?,last_used=?
        WHERE account_id=? AND profile_id=? AND source_key=? AND content_id=? AND attempt_id=? AND state='reserved'`)
        .run(text,origin,now,source.accountId,source.profileId,this.asrKey(source),source.contentId,attemptId);
      if(!updated.changes)return false;
      const retained=this.db.prepare(`SELECT account_id AS accountId,attempt_id AS id,length(CAST(transcript AS BLOB)) AS bytes
        FROM asr_attempts WHERE transcript IS NOT NULL ORDER BY last_used DESC,rowid DESC`).all();
      let count=0,bytes=0;
      for(const row of retained){
        const item=z.object({accountId:z.string(),id:z.string(),bytes:z.number()}).parse(row);count++;bytes+=item.bytes;
        if(count>1000 || bytes>4*1024*1024)this.db.prepare(`UPDATE asr_attempts SET state='suppressed',transcript=NULL,provenance=NULL
          WHERE account_id=? AND attempt_id=?`).run(item.accountId,item.id);
      }
      return true;
    });
  }
  unknownAsr(accountId:string,attemptId:string):void {
    this.db.prepare(`UPDATE asr_attempts SET state='unknown',transcript=NULL,provenance=NULL
      WHERE account_id=? AND attempt_id=? AND state='reserved'`).run(accountId,attemptId);
  }
  suppressAsr(accountId:string,conversationId?:string,transportId?:string):void {
    const members=conversationId===undefined ? undefined : JSON.stringify(this.historyGroup(accountId,conversationId).memberIds);
    this.db.prepare(`UPDATE asr_attempts SET state='suppressed',transcript=NULL,provenance=NULL WHERE account_id=?
      ${members===undefined ? '' : 'AND conversation_id IN (SELECT value FROM json_each(?))'} ${transportId===undefined ? '' : 'AND transport_id=?'}`)
      .run(accountId,...(members===undefined?[]:[members]),...(transportId===undefined?[]:[transportId]));
  }
  invalidateAsrContent(input:AsrSource):void {
    const source=AsrSource.parse(input);
    this.db.prepare(`UPDATE asr_attempts SET state='suppressed',transcript=NULL,provenance=NULL
      WHERE account_id=? AND profile_id=? AND source_key=? AND content_id<>?`)
      .run(source.accountId,source.profileId,this.asrKey(source),source.contentId);
  }
  // Backend supplies protobuf evidence without introducing transport types into core.
  inspectHistoryRaw: ((payload: string) => RawHistoryEvidence) | undefined;
  private rawEvidence(payload: string | undefined): RawHistoryEvidence {
    if (!payload) return {deleted:false,viewOnce:false,expiresAt:null,mediaIdentity:null};
    if (this.inspectHistoryRaw) return this.inspectHistoryRaw(payload);
    const value: unknown = JSON.parse(payload);
    return {deleted:z.object({deleted:z.literal(true)}).safeParse(value).success,
      conflict:z.object({historyConflict:z.literal(true)}).safeParse(value).success,
      viewOnce:z.object({historyViewOnce:z.literal(true)}).safeParse(value).success,
      expiresAt:z.object({historyExpiresAt:z.number()}).safeParse(value).data?.historyExpiresAt ?? null,
      mediaIdentity:historyDigest(value)};
  }
  historyProjectionVersion(accountId: string): number {
    const row = this.db.prepare('SELECT history_projection_version AS version FROM account_settings WHERE account_id=?').get(accountId);
    return row ? z.object({version:z.number()}).parse(row).version : 0;
  }
  saveHistoryProjectionVersion(accountId: string): void {
    this.db.prepare('INSERT INTO account_settings(account_id,history_projection_version) VALUES(?,1) ON CONFLICT(account_id) DO UPDATE SET history_projection_version=1').run(accountId);
  }
  mediaCacheId(accountId: string): string {
    const saved = this.db.prepare('SELECT media_cache_id AS id FROM account_settings WHERE account_id=?').get(accountId);
    const id = saved ? z.object({id:z.string().nullable()}).parse(saved).id : null;
    if (id) return id;
    this.db.prepare('INSERT INTO account_settings(account_id,media_cache_id) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET media_cache_id=COALESCE(media_cache_id,excluded.media_cache_id)').run(accountId,randomUUID());
    return z.object({id:z.string()}).parse(this.db.prepare('SELECT media_cache_id AS id FROM account_settings WHERE account_id=?').get(accountId)).id;
  }
  historyGroup(accountId: string, conversationId: string): HistoryGroup {
    const mapped = this.waCanonical(accountId,conversationId);
    const canonical = (mapped === conversationId || /^\d+@lid$/.test(conversationId))
      && /^\d+@s\.whatsapp\.net$/.test(mapped) && this.waCanonical(accountId,mapped) === mapped
      && this.conversation(accountId,mapped)?.kind === 'direct' ? mapped : conversationId;
    const aliases = /^\d+@s\.whatsapp\.net$/.test(canonical) && this.waCanonical(accountId,canonical) === canonical
      && this.conversation(accountId,canonical)?.kind === 'direct'
      ? this.db.prepare('SELECT alias FROM wa_aliases WHERE account_id=? AND canonical=? ORDER BY alias').all(accountId,canonical)
        .map(row => z.object({alias:z.string()}).parse(row).alias).filter(id => /^\d+@lid$/.test(id) && !!this.conversation(accountId,id)) : [];
    const memberIds = [...new Set([canonical,...aliases])].sort();
    const state = this.db.prepare('SELECT revision,source_epoch AS sourceEpoch FROM history_group_state WHERE account_id=? AND conversation_id=?').get(accountId,canonical);
    const versions = state ? z.object({revision:z.number(),sourceEpoch:z.number()}).parse(state)
      : {revision:z.object({revision:z.number()}).parse(this.db.prepare('SELECT COALESCE(MAX(revision),0) AS revision FROM history_versions WHERE account_id=? AND conversation_id IN (SELECT value FROM json_each(?))').get(accountId,JSON.stringify(memberIds))).revision,sourceEpoch:0};
    const last = this.historyRows(accountId,memberIds,Number.MAX_SAFE_INTEGER,1)[0];
    const aiBlocked = mapped !== conversationId && canonical === conversationId || memberIds.some(id => {
      const c = this.conversation(accountId,id);
      return !c || c.excluded || c.mode === 'never_reply' || c.kind !== 'direct' && !(c.kind === 'unknown' && /^\d+@lid$/.test(id) && canonical !== id);
    });
    return {id:canonical,memberIds,...versions,lastMessageId:last?.id ?? null,aiBlocked};
  }
  bumpHistory(accountId: string, conversationId: string, source: boolean, revision = 0, epoch = 0): void {
    const group = this.historyGroup(accountId,conversationId);
    const id = group.id; revision = Math.max(revision,group.revision); epoch = Math.max(epoch,group.sourceEpoch);
    this.db.prepare(`INSERT INTO history_group_state VALUES(?,?,?,?) ON CONFLICT(account_id,conversation_id)
      DO UPDATE SET revision=MAX(revision,?)+1,source_epoch=MAX(source_epoch,?)+?`)
      .run(accountId,id,revision+1,epoch+(source?1:0),revision,epoch,source?1:0);
  }
  private historyRows(accountId: string, memberIds: string[], fence: number, limit: number,
    edge?: {at:number;id:string;direction:'before'|'after'}, filter?:'inbound'|'style'): Message[] {
    const op = edge?.direction === 'after' ? '>' : '<';
    const order = edge?.direction === 'after' ? 'ASC' : 'DESC';
    const members = JSON.stringify(memberIds);
    // The earliest physical row is the representative even when scanning a fenced window.
    const where = edge ? `AND (json_extract(m.payload,'$.occurredAt') ${op} ? OR
      (json_extract(m.payload,'$.occurredAt')=? AND m.id ${op} ?))` : '';
    const params = edge ? [edge.at,edge.at,edge.id] : [];
    const eligibility = filter === 'inbound' ? "AND json_extract(m.payload,'$.direction')='inbound'"
      : filter === 'style' ? "AND json_extract(m.payload,'$.direction')='outbound' AND json_extract(m.payload,'$.authorship')='owner_written' AND length(trim(json_extract(m.payload,'$.text'))) BETWEEN 1 AND 600" : '';
    return this.db.prepare(`SELECT result.payload FROM json_each(?) member JOIN messages result ON result.rowid IN (
      SELECT m.rowid FROM messages m WHERE m.account_id=? AND m.conversation_id=member.value AND m.rowid<=?
      AND m.rowid=(SELECT MIN(d.rowid) FROM messages d WHERE d.account_id=m.account_id
        AND d.conversation_id IN (SELECT value FROM json_each(?))
        AND json_extract(d.payload,'$.transportId')=json_extract(m.payload,'$.transportId')) ${where} ${eligibility}
      ORDER BY json_extract(m.payload,'$.occurredAt') ${order},m.id ${order} LIMIT ?)
      ORDER BY json_extract(result.payload,'$.occurredAt') ${order},result.id ${order} LIMIT ?`)
      .all(members,accountId,fence,members,...params,limit,limit).map(row => this.projectMessage(Message.parse(JSON.parse(Payload.parse(row).payload))));
  }
  eventMessages(accountId: string, conversationId: string, transportId: string): Message[] {
    const group = this.historyGroup(accountId,conversationId);
    return this.db.prepare(`SELECT payload FROM messages WHERE account_id=? AND conversation_id IN (SELECT value FROM json_each(?))
      AND json_extract(payload,'$.transportId')=? ORDER BY rowid`).all(accountId,JSON.stringify(group.memberIds),transportId)
      .map(row => this.projectMessage(Message.parse(JSON.parse(Payload.parse(row).payload))));
  }
  historySource(accountId: string, conversationId: string, messageId: string, now = Date.now()): HistorySource | undefined {
    const group = this.historyGroup(accountId,conversationId);
    let original = this.message(accountId,messageId);
    if (!original) {
      const reference = /^wa:([^:]+):(.+)$/.exec(messageId);
      if (!reference || !group.memberIds.includes(reference[1] ?? '')) return undefined;
      original = this.eventMessages(accountId,conversationId,reference[2] ?? '')[0];
    }
    if (!original || !group.memberIds.includes(original.conversationId)) return undefined;
    const candidates = this.eventMessages(accountId,conversationId,original.transportId);
    const first = candidates[0];
    if (!first) return undefined;
    const evidence = candidates.map(m => this.rawEvidence(this.waMessage(accountId,m.conversationId,m.transportId)));
    const allEvidence = group.memberIds.map(id => this.rawEvidence(this.waMessage(accountId,id,original.transportId)));
    const expires = [...candidates.map(m => m.media?.expiresAt ?? null),...allEvidence.map(e => e.expiresAt)].filter((n): n is number => n !== null);
    const expiresAt = expires.length ? Math.min(...expires) : null;
    const identity = (m: Message, i: number) => {
      const quote = m.quotedMessageId ? this.message(accountId,m.quotedMessageId) : undefined;
      const ref = m.quotedMessageId ? /^wa:([^:]+):(.+)$/.exec(m.quotedMessageId) : null;
      const transport = quote && group.memberIds.includes(quote.conversationId) ? quote.transportId
        : ref && group.memberIds.includes(ref[1] ?? '') ? ref[2] : undefined;
      return eventIdentity({...m,quotedMessageId:transport ? 'wa:'+group.id+':'+transport : m.quotedMessageId},evidence[i]?.mediaIdentity ?? null);
    };
    const recoveredPartial = (m:Message,i:number) => first.contentRecovered && partialMessage(m)
      && m.direction===first.direction && m.occurredAt===first.occurredAt && m.authorship===first.authorship && m.source===first.source
      && (!m.quotedMessageId || identity({...first,quotedMessageId:m.quotedMessageId},0)===identity(first,0))
      && (!evidence[i]?.mediaIdentity || evidence[i]?.mediaIdentity===evidence[0]?.mediaIdentity);
    const invalidSource = candidates.some(m=>{
      const mapped=this.waCanonical(accountId,m.conversationId);
      const kind=this.conversation(accountId,m.conversationId)?.kind;
      return mapped!==m.conversationId && (!/^\d+@lid$/.test(m.conversationId) || mapped!==group.id
        || kind!=='direct' && kind!=='unknown');
    });
    const state = allEvidence.some(e => e.deleted) ? 'deleted'
      : candidates.some(m => m.media?.viewOnce) || allEvidence.some(e => e.viewOnce) ? 'view_once'
      : candidates.some(m => m.media?.access === 'expired') || expiresAt !== null && expiresAt <= now ? 'expired'
      : invalidSource || allEvidence.some(e => e.conflict) || candidates.some((m,i) => !recoveredPartial(m,i) && identity(m,i) !== identity(first,0)) ? 'conflict' : 'available';
    let message = first;
    if (state !== 'available') {
      const {outgoingReceipt:_receipt,...unavailable}=first;
      message = {...unavailable,text:state === 'deleted' ? '[Message deleted]' : '[Source unavailable]',
        media:null,reaction:null,observedReactions:[],quotedMessageId:null};
    }
    else if (first.media) message = {...first,media:{...first.media,expiresAt}};
    return {message,accountId,conversationId:first.conversationId,messageId:first.id,transportId:first.transportId,
      candidateIds:candidates.map(m => m.id),state,expiresAt};
  }
  private historyMessage(accountId: string, conversationId: string, message: Message, now: number): Message {
    const source = this.historySource(accountId,conversationId,message.id,now);
    const projected = source?.message ?? message;
    if (!projected.quotedMessageId) return projected;
    const quote = this.historySource(accountId,conversationId,projected.quotedMessageId,now);
    return {...projected,quotedMessageId:quote?.state === 'available' ? quote.messageId : projected.quotedMessageId};
  }
  historyPage(accountId: string, conversationId: string,
    input: {limit?:number|undefined;before?:string|undefined;after?:string|undefined;around?:string|undefined} = {}, now = Date.now()): HistoryPage {
    const group = this.historyGroup(accountId,conversationId);
    if (!this.conversation(accountId,conversationId)) throw new DomainError('conversation_not_found',404);
    const limit = input.around !== undefined ? Math.min(input.limit ?? 50,50) : input.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || [input.before,input.after,input.around].filter(v => v !== undefined).length > 1) throw new DomainError('invalid_history_page',422);
    const digest = historyDigest(group.memberIds);
    let fence = z.object({fence:z.number()}).parse(this.db.prepare(`SELECT COALESCE(MAX((SELECT MAX(rowid) FROM messages
      WHERE account_id=? AND conversation_id=member.value)),0) AS fence FROM json_each(?) member`).get(accountId,JSON.stringify(group.memberIds))).fence;
    let edge: {at:number;id:string;direction:'before'|'after'} | undefined;
    const cursor = input.before ?? input.after;
    if (cursor !== undefined) {
      if (cursor.length > 2048 || !/^[A-Za-z0-9_-]+$/.test(cursor)) throw new DomainError('invalid_history_cursor',422);
      let parsed: z.infer<typeof HistoryCursor>;
      try { parsed = HistoryCursor.parse(JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'))); }
      catch { throw new DomainError('invalid_history_cursor',422); }
      const [,account,id,members,epoch,bound,at,key] = parsed;
      if (account !== accountId || id !== group.id) throw new DomainError('invalid_history_cursor',422);
      if (members !== digest || epoch !== group.sourceEpoch) throw new DomainError('history_cursor_stale');
      if (bound > fence) throw new DomainError('invalid_history_cursor',422);
      const anchor = this.historySource(accountId,conversationId,key,now);
      if (!anchor || anchor.messageId !== key || anchor.message.occurredAt !== at
        || this.historyWatermark(accountId,anchor.conversationId,[key]) > bound) throw new DomainError('invalid_history_cursor',422);
      fence = bound; edge = {at,id:key,direction:input.after !== undefined ? 'after' : 'before'};
    }
    let rows: Message[];
    if (input.around !== undefined) {
      const source = this.historySource(accountId,conversationId,input.around,now);
      if (!source) throw new DomainError('history_source_unavailable',404);
      const anchor = {at:source.message.occurredAt,id:source.messageId};
      const before = this.historyRows(accountId,group.memberIds,fence,Math.floor((limit-1)/2),{...anchor,direction:'before'}).reverse();
      const after = this.historyRows(accountId,group.memberIds,fence,limit-before.length-1,{...anchor,direction:'after'});
      rows = [...before,source.message,...after];
    } else {
      rows = this.historyRows(accountId,group.memberIds,fence,limit+1,edge).slice(0,limit);
      if (edge?.direction !== 'after') rows.reverse();
    }
    const first = rows[0]; const last = rows.at(-1);
    const exists = (m: Message | undefined,direction:'before'|'after') => !!m && this.historyRows(accountId,group.memberIds,
      direction === 'after' ? Number.MAX_SAFE_INTEGER : fence,1,{at:m.occurredAt,id:m.id,direction}).length > 0;
    const encode = (m: Message | undefined) => {
      if (!m) return null;
      const value = Buffer.from(JSON.stringify([1,accountId,group.id,digest,group.sourceEpoch,fence,m.occurredAt,m.id])).toString('base64url');
      if (value.length > 2048) throw new DomainError('invalid_history_cursor',422);
      return value;
    };
    return {conversationId:group.id,messages:rows.map(m => this.historyMessage(accountId,conversationId,m,now)),
      unavailableSourceIds:rows.filter(m => this.historySource(accountId,conversationId,m.id,now)?.state === 'conflict').map(m => m.id),
      revision:group.revision,sourceEpoch:group.sourceEpoch,beforeCursor:encode(first),afterCursor:encode(last),
      hasOlder:exists(first,'before'),hasNewer:exists(last,'after') || !!this.db.prepare(`SELECT 1 FROM messages WHERE account_id=?
        AND conversation_id IN (SELECT value FROM json_each(?)) AND rowid>? LIMIT 1`).get(accountId,JSON.stringify(group.memberIds),fence),latestMessageId:group.lastMessageId};
  }
  contextMessages(accountId: string, conversationId: string, now = Date.now()): {messages:Message[];examples:Message[];memberIds:string[]} {
    const group = this.historyGroup(accountId,conversationId);
    if (group.aiBlocked) throw new DomainError('ai_access_denied',403);
    const recent = this.historyRows(accountId,group.memberIds,Number.MAX_SAFE_INTEGER,20).reverse()
      .map(m => this.historyMessage(accountId,conversationId,m,now)).filter(m => this.historySource(accountId,conversationId,m.id,now)?.state === 'available');
    const selected = new Map<string,Message>();
    const inboundRow = this.historyRows(accountId,group.memberIds,Number.MAX_SAFE_INTEGER,1,undefined,'inbound')[0];
    const inbound = inboundRow ? this.historyMessage(accountId,conversationId,inboundRow,now) : undefined;
    for (const m of [recent.at(-1),inbound]) if (m && this.historySource(accountId,conversationId,m.id,now)?.state === 'available') {
      selected.set(m.id,m);
      const quote = m.quotedMessageId ? this.historySource(accountId,conversationId,m.quotedMessageId,now) : undefined;
      if (quote?.state === 'available') selected.set(quote.messageId,quote.message);
    }
    for (const m of recent.toReversed()) if (selected.size < 20) selected.set(m.id,m);
    const examples = this.historyRows(accountId,group.memberIds,Number.MAX_SAFE_INTEGER,3,undefined,'style')
      .filter(m => this.historySource(accountId,conversationId,m.id,now)?.state === 'available');
    return {messages:[...selected.values()].sort((a,b) => a.occurredAt-b.occurredAt || a.id.localeCompare(b.id)),examples,memberIds:group.memberIds};
  }
  markViewedMessages(accountId: string, conversationId: string, ids: string[]): void {
    if (!ids.length || ids.length > 100) throw new DomainError('invalid_viewed_messages',422);
    const sources = [...new Set(ids)].map(id => {
      if (!this.message(accountId,id)) throw new DomainError('message_not_found',404);
      const source = this.historySource(accountId,conversationId,id);
      if (!source) throw new DomainError('message_not_found',404);
      return source;
    });
    for (const source of sources) for (const id of source.candidateIds) this.db.prepare('INSERT INTO message_views VALUES(?,?) ON CONFLICT DO NOTHING').run(accountId,id);
  }
  close(): void { this.db.close(); }
  saveImageUpload(accountId: string, conversationId: string, upload: ImageUpload, bytes: Uint8Array, createdAt: number): void {
    const metadata = ImageUpload.parse(upload);
    if (!bytes.length || bytes.length > 10*1024*1024) throw new DomainError('image_too_large',413);
    const total = this.db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM image_uploads WHERE account_id=?').get(accountId);
    if (z.object({size:z.number()}).parse(total).size + bytes.length > 100*1024*1024) throw new DomainError('upload_storage_full',413);
    this.db.prepare('INSERT INTO image_uploads VALUES(?,?,?,?,?,?,?,?)')
      .run(metadata.id,accountId,conversationId,metadata.mime,metadata.width,metadata.height,bytes,createdAt);
  }
  imageUpload(accountId: string, conversationId: string, id: string): (ImageUpload & { bytes: Uint8Array }) | undefined {
    const row = this.db.prepare('SELECT id,mime,width,height,bytes FROM image_uploads WHERE account_id=? AND conversation_id=? AND id=?')
      .get(accountId,conversationId,id);
    return row ? ImageUpload.extend({bytes:z.instanceof(Uint8Array)}).parse(row) : undefined;
  }
  sentImageIdentity(accountId:string,conversationId:string,transportId:string): {id:string;identity:string;width:number;height:number;size:number}|undefined {
    const row = this.db.prepare(`SELECT u.id,u.width,u.height,length(u.bytes) AS size,r.payload_hash AS identity FROM image_uploads u JOIN outbox o
      ON o.account_id=u.account_id AND o.conversation_id=u.conversation_id JOIN json_each(o.payload,'$.components') p
      ON json_extract(p.value,'$.uploadId')=u.id JOIN api_requests r ON r.account_id=u.account_id AND json_extract(r.result,'$.id')=u.id
      WHERE u.account_id=? AND u.conversation_id=? AND json_extract(o.payload,'$.origin')='owner_manual'
      AND json_extract(p.value,'$.kind')='image' AND json_extract(p.value,'$.state')='accepted'
      AND json_extract(p.value,'$.transportId')=? LIMIT 1`).get(accountId,conversationId,transportId);
    return row ? z.object({id:z.string(),identity:z.string(),width:z.number(),height:z.number(),size:z.number()}).parse(row) : undefined;
  }
  sentImageUpload(accountId:string,conversationId:string,transportId:string):(ImageUpload & {bytes:Uint8Array}) | undefined {
    const row=this.db.prepare(`SELECT u.id,u.mime,u.width,u.height,u.bytes FROM image_uploads u JOIN outbox o
      ON o.account_id=u.account_id AND o.conversation_id=u.conversation_id JOIN json_each(o.payload,'$.components') p
      ON json_extract(p.value,'$.uploadId')=u.id WHERE u.account_id=? AND u.conversation_id=?
      AND json_extract(o.payload,'$.origin')='owner_manual' AND json_extract(p.value,'$.kind')='image'
      AND json_extract(p.value,'$.state')='accepted' AND json_extract(p.value,'$.transportId')=? LIMIT 1`)
      .get(accountId,conversationId,transportId);
    return row ? ImageUpload.extend({bytes:z.instanceof(Uint8Array)}).parse(row) : undefined;
  }
  cleanupImageUploads(accountId: string, before: number): void {
    // Uncertain or unfinished outboxes retain their bytes even across restarts.
    this.db.prepare(`DELETE FROM image_uploads WHERE account_id=? AND created_at<? AND NOT EXISTS (
      SELECT 1 FROM outbox o,json_each(o.payload,'$.components') p WHERE o.account_id=image_uploads.account_id
      AND o.conversation_id=image_uploads.conversation_id AND json_extract(p.value,'$.uploadId')=image_uploads.id
      AND (json_extract(o.payload,'$.state') IN ('queued','dispatching','unknown','partial')
        OR json_extract(p.value,'$.state') IN ('queued','dispatching','unknown')))`)
      .run(accountId,before);
  }
  saveAudioUpload(accountId:string,conversationId:string,upload:AudioUpload,bytes:Uint8Array,createdAt:number):void {
    const metadata=AudioUpload.parse(upload);
    if(!bytes.length || bytes.length>10*1024*1024)throw new DomainError('audio_too_large',413);
    const total=this.db.prepare('SELECT COALESCE(SUM(length(bytes)),0) AS size FROM audio_uploads WHERE account_id=?').get(accountId);
    if(z.object({size:z.number()}).parse(total).size+bytes.length>100*1024*1024)throw new DomainError('upload_storage_full',413);
    this.db.prepare('INSERT INTO audio_uploads VALUES(?,?,?,?,?,?,?)').run(metadata.id,accountId,conversationId,metadata.mime,metadata.duration,bytes,createdAt);
  }
  audioUpload(accountId:string,conversationId:string,id:string):(AudioUpload & {bytes:Uint8Array}) | undefined {
    const row=this.db.prepare('SELECT id,mime,duration,bytes FROM audio_uploads WHERE account_id=? AND conversation_id=? AND id=?').get(accountId,conversationId,id);
    return row ? AudioUpload.extend({bytes:z.instanceof(Uint8Array)}).parse(row) : undefined;
  }
  sentAudioIdentity(accountId:string,conversationId:string,transportId:string): {id:string;identity:string}|undefined {
    const row=this.db.prepare(`SELECT u.id,r.payload_hash AS identity FROM audio_uploads u JOIN outbox o
      ON o.account_id=u.account_id AND o.conversation_id=u.conversation_id JOIN json_each(o.payload,'$.components') p
      ON json_extract(p.value,'$.uploadId')=u.id JOIN api_requests r ON r.account_id=u.account_id AND json_extract(r.result,'$.id')=u.id
      WHERE u.account_id=? AND u.conversation_id=? AND json_extract(o.payload,'$.origin')='owner_manual'
      AND json_extract(p.value,'$.kind')='audio' AND json_extract(p.value,'$.state')='accepted'
      AND json_extract(p.value,'$.transportId')=? LIMIT 1`).get(accountId,conversationId,transportId);
    return row ? z.object({id:z.string(),identity:z.string()}).parse(row) : undefined;
  }
  sentAudioUpload(accountId:string,conversationId:string,transportId:string):(AudioUpload & {bytes:Uint8Array}) | undefined {
    const row=this.db.prepare(`SELECT u.id,u.mime,u.duration,u.bytes FROM audio_uploads u JOIN outbox o
      ON o.account_id=u.account_id AND o.conversation_id=u.conversation_id JOIN json_each(o.payload,'$.components') p
      ON json_extract(p.value,'$.uploadId')=u.id WHERE u.account_id=? AND u.conversation_id=?
      AND json_extract(o.payload,'$.origin')='owner_manual' AND json_extract(p.value,'$.kind')='audio'
      AND json_extract(p.value,'$.state')='accepted' AND json_extract(p.value,'$.transportId')=? LIMIT 1`).get(accountId,conversationId,transportId);
    return row ? AudioUpload.extend({bytes:z.instanceof(Uint8Array)}).parse(row) : undefined;
  }
  cleanupAudioUploads(accountId:string,before:number):void {
    this.db.prepare(`DELETE FROM audio_uploads WHERE account_id=? AND created_at<? AND NOT EXISTS (
      SELECT 1 FROM outbox o,json_each(o.payload,'$.components') p WHERE o.account_id=audio_uploads.account_id
      AND o.conversation_id=audio_uploads.conversation_id AND json_extract(p.value,'$.uploadId')=audio_uploads.id
      AND (json_extract(o.payload,'$.state') IN ('queued','dispatching','unknown','partial')
        OR json_extract(p.value,'$.state') IN ('queued','dispatching','unknown')))` ).run(accountId,before);
  }
  unreadCounts(accountId:string): Record<string,number> {
    const rows=this.db.prepare(`SELECT m.conversation_id,COUNT(*) AS count FROM messages m LEFT JOIN conversation_views v
      ON v.account_id=m.account_id AND v.conversation_id=m.conversation_id WHERE m.account_id=? AND m.rowid>COALESCE(v.last_rowid,0)
      AND json_extract(m.payload,'$.direction')='inbound' AND json_extract(m.payload,'$.source')='live'
      AND COALESCE(json_extract(m.payload,'$.contentState'),'complete')<>'partial' AND COALESCE(json_extract(m.payload,'$.contentRecovered'),0)=0
      AND (length(trim(json_extract(m.payload,'$.text')))>0 OR json_type(m.payload,'$.media')<>'null' OR json_extract(m.payload,'$.reaction') IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM message_views exact WHERE exact.account_id=m.account_id AND exact.message_id=m.id)
      GROUP BY m.conversation_id`).all(accountId);
    const counts: Record<string,number> = {};
    for (const row of rows) {
      const r = z.object({conversation_id:z.string(),count:z.number()}).parse(row);
      const id = this.historyGroup(accountId,r.conversation_id).id;
      counts[id] = (counts[id] ?? 0)+r.count;
    }
    // Correct only multi-copy events; the ordinary count is an indexed SQL aggregate.
    const duplicates = this.db.prepare(`SELECT json_extract(payload,'$.transportId') AS transportId,COUNT(*) AS copies
      FROM messages WHERE account_id=? GROUP BY json_extract(payload,'$.transportId') HAVING COUNT(*)>1`).iterate(accountId);
    for (const raw of duplicates) {
      const {transportId} = z.object({transportId:z.string()}).parse(raw);
      for (const c of this.conversations(accountId).filter(c => this.historyGroup(accountId,c.id).id === c.id)) {
        const copies = this.eventMessages(accountId,c.id,transportId);
        if (copies.length < 2) continue;
        const visibility = copies.map(m => {
          const position = this.historyWatermark(accountId,m.conversationId,[m.id]);
          const floor = this.db.prepare('SELECT last_rowid AS floor FROM conversation_views WHERE account_id=? AND conversation_id=?').get(accountId,m.conversationId);
          const viewed = position <= (floor ? z.object({floor:z.number()}).parse(floor).floor : 0)
            || !!this.db.prepare('SELECT 1 FROM message_views WHERE account_id=? AND message_id=?').get(accountId,m.id);
          return {viewed,unread:m.direction === 'inbound' && m.source === 'live' && automaticTrigger(m) && !viewed};
        });
        const unread = visibility.filter(value=>value.unread).length;
        const source = this.historySource(accountId,c.id,copies[0]?.id ?? '');
        const retained = unread > 0 && !visibility.some(value=>value.viewed) && source?.state === 'available' ? 1 : 0;
        if (unread) counts[c.id] = Math.max(0,(counts[c.id] ?? 0)-unread+retained);
      }
    }
    return Object.fromEntries(Object.entries(counts).filter(([,count]) => count > 0));
  }
  historyVersions(accountId:string): Record<string,number> {
    return Object.fromEntries(this.conversations(accountId).map(c=>[c.id,this.historyGroup(accountId,c.id).revision]));
  }
  historyWatermark(accountId:string,conversationId:string,messageIds:string[]): number {
    const row=this.db.prepare('SELECT COALESCE(MAX(rowid),0) AS position FROM messages WHERE account_id=? AND conversation_id=? AND id IN (SELECT value FROM json_each(?))').get(accountId,conversationId,JSON.stringify(messageIds));
    return z.object({position:z.number()}).parse(row).position;
  }
  markViewedPosition(accountId:string,conversationId:string,position:number): void {
    const max=this.db.prepare('SELECT COALESCE(MAX(rowid),0) AS position FROM messages WHERE account_id=? AND conversation_id=?').get(accountId,conversationId);
    if(position>z.object({position:z.number()}).parse(max).position)throw new DomainError('invalid_view_position',422);
    this.db.prepare('INSERT INTO conversation_views VALUES(?,?,?) ON CONFLICT(account_id,conversation_id) DO UPDATE SET last_rowid=MAX(last_rowid,excluded.last_rowid)').run(accountId,conversationId,position);
  }
  markViewed(accountId:string,conversationId:string,messageId:string): void {
    const row=this.db.prepare('SELECT rowid AS position FROM messages WHERE account_id=? AND conversation_id=? AND id=?').get(accountId,conversationId,messageId);
    if(!row)throw new DomainError('message_not_found',404);
    const position=z.object({position:z.number()}).parse(row).position;
    this.db.prepare('INSERT INTO conversation_views VALUES(?,?,?) ON CONFLICT(account_id,conversation_id) DO UPDATE SET last_rowid=MAX(last_rowid,excluded.last_rowid)').run(accountId,conversationId,position);
  }
  setComposer(accountId:string,conversationId:string,clientId:string,hasText:boolean): void {
    this.db.prepare('INSERT INTO composer_holds VALUES(?,?,?,?) ON CONFLICT(account_id,conversation_id,client_id) DO UPDATE SET has_text=excluded.has_text').run(accountId,conversationId,clientId,hasText?1:0);
  }
  clearComposers(accountId:string): void {
    this.db.prepare('DELETE FROM composer_holds WHERE account_id=?').run(accountId);
  }
  hasComposer(accountId:string,conversationId:string): boolean {
    return !!this.db.prepare('SELECT 1 FROM composer_holds WHERE account_id=? AND conversation_id=? AND has_text=1 LIMIT 1').get(accountId,conversationId);
  }
  waCanonical(accountId: string, jid: string): string {
    const row = this.db.prepare('SELECT canonical FROM wa_aliases WHERE account_id=? AND alias=?').get(accountId, jid);
    return row ? z.object({ canonical: z.string() }).parse(row).canonical : jid;
  }
  saveWaAlias(accountId: string, alias: string, canonical: string): void {
    if (!this.db.isTransaction) {this.transaction(()=>this.saveWaAlias(accountId,alias,canonical));return;}
    if (alias === canonical || this.waCanonical(accountId,canonical) !== canonical) throw new DomainError('wa_alias_conflict',403);
    const existing = this.waCanonical(accountId, alias);
    if (existing !== alias && existing !== canonical) throw new DomainError('wa_alias_conflict', 403);
    if (existing === canonical) return;
    const previous = this.historyGroup(accountId,alias);
    this.db.prepare('INSERT INTO wa_aliases(account_id,alias,canonical) VALUES(?,?,?) ON CONFLICT(account_id,alias) DO NOTHING').run(accountId, alias, canonical);
    this.bumpHistory(accountId,canonical,true,previous.revision,previous.sourceEpoch);
    const group=this.historyGroup(accountId,canonical);
    if(group.aiBlocked)this.suppressAsr(accountId,canonical);
    else for(const row of this.db.prepare(`SELECT message_id AS id FROM asr_attempts WHERE account_id=?
      AND conversation_id IN (SELECT value FROM json_each(?)) AND state IN ('reserved','complete')`).all(accountId,JSON.stringify(group.memberIds))){
      const {id}=z.object({id:z.string()}).parse(row);
      const source=this.historySource(accountId,canonical,id);
      if(source && source.state!=='available')this.suppressAsr(accountId,source.conversationId,source.transportId);
    }
  }
  saveWaMessage(accountId: string, conversationId: string, transportId: string, payload: string): void {
    if (!this.db.isTransaction) {this.transaction(()=>this.saveWaMessage(accountId,conversationId,transportId,payload));return;}
    const previous = this.waMessage(accountId,conversationId,transportId);
    if (previous !== undefined) {
      const old = this.rawEvidence(previous);
      if (old.deleted) payload = JSON.stringify({deleted:true});
      else {
        const next = z.record(z.string(),z.unknown()).parse(JSON.parse(payload));
        payload = JSON.stringify({...next,...(old.conflict ? {historyConflict:true} : {}),
          ...(old.viewOnce ? {historyViewOnce:true} : {}),...(old.expiresAt !== null ? {historyExpiresAt:Math.min(old.expiresAt,this.rawEvidence(payload).expiresAt ?? Infinity)} : {})});
      }
    }
    this.db.prepare('INSERT INTO wa_messages VALUES(?,?,?,?) ON CONFLICT(account_id,conversation_id,transport_id) DO UPDATE SET payload=excluded.payload').run(accountId, conversationId, transportId, payload);
    if (previous !== undefined && historyDigest(this.rawEvidence(previous)) !== historyDigest(this.rawEvidence(payload))) {
      this.bumpHistory(accountId,conversationId,true);this.suppressAsr(accountId,conversationId,transportId);
    }
    const evidence=this.rawEvidence(payload);
    const message=this.eventMessages(accountId,conversationId,transportId)[0];
    if(evidence.deleted || evidence.viewOnce || evidence.conflict
      || message && this.historySource(accountId,conversationId,message.id)?.state!=='available')this.suppressAsr(accountId,conversationId,transportId);
  }
  waMessage(accountId: string, conversationId: string, transportId: string): string | undefined {
    const row = this.db.prepare('SELECT payload FROM wa_messages WHERE account_id=? AND conversation_id=? AND transport_id=?').get(accountId, conversationId, transportId);
    return row ? Payload.parse(row).payload : undefined;
  }
  modelConsent(accountId: string): boolean {
    const row = this.db.prepare('SELECT model_consent FROM account_settings WHERE account_id=?').get(accountId);
    return row ? z.object({ model_consent: z.number() }).parse(row).model_consent === 1 : false;
  }
  saveModelConsent(accountId: string, consent: boolean): void {
    if(!this.db.isTransaction){this.transaction(()=>this.saveModelConsent(accountId,consent));return;}
    this.db.prepare('INSERT INTO account_settings(account_id,model_consent) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET model_consent=excluded.model_consent')
      .run(accountId, consent ? 1 : 0);
    if(!consent)this.suppressAsr(accountId);
  }
  ownerInstructions(accountId: string): OwnerInstructions {
    const row = this.db.prepare('SELECT owner_instructions AS text,owner_instructions_revision AS revision FROM account_settings WHERE account_id=?').get(accountId);
    return row ? OwnerInstructions.parse(row) : { text: '', revision: 0 };
  }
  saveOwnerInstructions(accountId: string, value: OwnerInstructions): void {
    this.db.prepare('INSERT INTO account_settings(account_id,owner_instructions,owner_instructions_revision) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET owner_instructions=excluded.owner_instructions,owner_instructions_revision=excluded.owner_instructions_revision').run(accountId,value.text,value.revision);
  }
  contactNameSettings(accountId: string): ContactNameSettings {
    const row = this.db.prepare('SELECT contact_book_names_enabled AS enabled,contact_names_revision AS revision,phone_names_synced_at AS lastPhoneSyncAt,phone_names_import_request_id AS lastPhoneImportRequestId FROM account_settings WHERE account_id=?').get(accountId);
    return row ? ContactNameSettings.parse({ ...row, enabled: row.enabled === 1 })
      : { enabled: false, revision: 0, lastPhoneSyncAt: null, lastPhoneImportRequestId: null };
  }
  saveContactNameSettings(accountId: string, value: ContactNameSettings): void {
    this.db.prepare(`INSERT INTO account_settings(account_id,contact_book_names_enabled,contact_names_revision,phone_names_synced_at,phone_names_import_request_id) VALUES(?,?,?,?,?)
      ON CONFLICT(account_id) DO UPDATE SET contact_book_names_enabled=excluded.contact_book_names_enabled,contact_names_revision=excluded.contact_names_revision,phone_names_synced_at=excluded.phone_names_synced_at,phone_names_import_request_id=excluded.phone_names_import_request_id`)
      .run(accountId,value.enabled?1:0,value.revision,value.lastPhoneSyncAt,value.lastPhoneImportRequestId);
  }
  releaseContextVersion(accountId: string): number {
    const row = this.db.prepare('SELECT release_context_version AS version FROM account_settings WHERE account_id=?').get(accountId);
    return row ? z.object({version:z.number()}).parse(row).version : 0;
  }
  saveReleaseContextVersion(accountId: string, version: number): void {
    this.db.prepare('INSERT INTO account_settings(account_id,release_context_version) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET release_context_version=excluded.release_context_version').run(accountId,version);
  }
  contactNames(accountId: string, conversationId: string): {source: NameSource; name: string; updatedAt:number; phoneImportRequestId:string|null}[] {
    return this.db.prepare('SELECT source,name,updated_at AS updatedAt,phone_import_request_id AS phoneImportRequestId FROM contact_names WHERE account_id=? AND conversation_id=?').all(accountId,conversationId)
      .map(row => z.object({source:z.enum(['wa_saved','phone_matched','wa_notify','wa_verified']),name:z.string(),updatedAt:z.number(),phoneImportRequestId:z.string().nullable()}).parse(row));
  }
  saveContactName(accountId: string, conversationId: string, source: NameSource, name: string, updatedAt = Date.now(), phoneImportRequestId: string|null = null): void {
    if (!name) { this.db.prepare('DELETE FROM contact_names WHERE account_id=? AND conversation_id=? AND source=?').run(accountId,conversationId,source); return; }
    this.db.prepare('INSERT INTO contact_names VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,conversation_id,source) DO UPDATE SET name=excluded.name,updated_at=excluded.updated_at,phone_import_request_id=excluded.phone_import_request_id').run(accountId,conversationId,source,name,updatedAt,phoneImportRequestId);
  }
  clearContactNames(accountId: string, source: 'wa_saved'|'phone_matched'): void {
    this.db.prepare('DELETE FROM contact_names WHERE account_id=? AND source=?').run(accountId,source);
  }
  outgoingReceipt(accountId: string, conversationId: string, transportId: string): OutgoingReceipt | undefined {
    const chat = this.waCanonical(accountId,conversationId);
    const row = this.db.prepare('SELECT level,observed_at AS observedAt,source FROM wa_receipts WHERE account_id=? AND conversation_id=? AND transport_id=?').get(accountId,chat,transportId);
    if (!row) return undefined;
    const targets = this.db.prepare(`WITH chats AS (SELECT ? AS id UNION SELECT alias FROM wa_aliases WHERE account_id=? AND canonical=?)
      SELECT conversation_id AS chat,'message' AS kind,json_extract(payload,'$.direction') AS direction FROM messages
      WHERE account_id=? AND conversation_id IN (SELECT id FROM chats) AND json_extract(payload,'$.transportId')=?
      UNION ALL SELECT o.conversation_id AS chat,'component' AS kind,'outbound' AS direction FROM outbox o,json_each(o.payload,'$.components') p
      WHERE o.account_id=? AND o.conversation_id IN (SELECT id FROM chats) AND json_extract(p.value,'$.transportId')=?`)
      .all(chat,accountId,chat,accountId,transportId,accountId,transportId);
    if (!targets.length || targets.some(target => target.direction !== 'outbound')
      || targets.filter(target => target.kind === 'message').length > 1 || targets.filter(target => target.kind === 'component').length > 1
      || new Set(targets.map(target => target.chat)).size > 1
      || targets.some(target => typeof target.chat === 'string' && this.rawEvidence(this.waMessage(accountId,target.chat,transportId)).conflict)) return undefined;
    return OutgoingReceipt.parse(row);
  }
  observeOutgoingReceipt(accountId: string, conversationId: string, transportId: string, input: OutgoingReceipt): boolean {
    const receipt = OutgoingReceipt.parse(input);
    return this.transaction(() => {
      const chat = this.conversation(accountId,conversationId);
      if (chat?.kind !== 'direct' || this.waCanonical(accountId,conversationId) !== conversationId) return false;
      const chats = this.conversations(accountId).filter(c => this.waCanonical(accountId,c.id) === conversationId);
      const messages = chats.flatMap(c => this.messages(accountId,c.id)).filter(m => m.transportId === transportId);
      const outboxes = chats.flatMap(c => this.outboxes(accountId,c.id)).filter(o => o.components.some(p => p.transportId === transportId));
      const components = outboxes.flatMap(o => o.components).filter(p => p.transportId === transportId);
      if (chats.some(c => this.rawEvidence(this.waMessage(accountId,c.id,transportId)).conflict)) return false;
      if (messages.length && outboxes.length && messages[0]?.conversationId !== outboxes[0]?.conversationId) return false;
      if (messages.some(m => m.direction !== 'outbound') || messages.length > 1 || components.length > 1
        || !messages.length && !components.some(p => ['dispatching','accepted','unknown'].includes(p.state))) return false;
      const previous = this.outgoingReceipt(accountId,conversationId,transportId);
      const rank = { sent: 1, delivered: 2, read: 3 };
      if (previous && rank[previous.level] >= rank[receipt.level]) return false;
      this.db.prepare('INSERT INTO wa_receipts VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,conversation_id,transport_id) DO UPDATE SET level=excluded.level,observed_at=excluded.observed_at,source=excluded.source')
        .run(accountId,conversationId,transportId,receipt.level,receipt.observedAt,receipt.source);
      this.bumpHistory(accountId,conversationId,false);
      for (const id of new Set([conversationId,...messages.map(m => m.conversationId),...outboxes.map(o => o.conversationId)]))
        this.db.prepare('INSERT INTO history_versions VALUES(?,?,1) ON CONFLICT(account_id,conversation_id) DO UPDATE SET revision=revision+1').run(accountId,id);
      return true;
    });
  }
  mergeReleaseContext(accountId: string, from: string, to: string): void {
    for (const row of this.contactNames(accountId,from)) {
      if (!this.contactNames(accountId,to).some(candidate => candidate.source === row.source)) this.saveContactName(accountId,to,row.source,row.name,row.updatedAt,row.phoneImportRequestId);
    }
    this.db.prepare('DELETE FROM contact_names WHERE account_id=? AND conversation_id=?').run(accountId,from);
    const rows = this.db.prepare('SELECT transport_id,level,observed_at,source FROM wa_receipts WHERE account_id=? AND conversation_id=?').all(accountId,from);
    for (const raw of rows) {
      const row = z.object({transport_id:z.string(),level:OutgoingReceipt.shape.level,observed_at:z.number(),source:OutgoingReceipt.shape.source}).parse(raw);
      if (this.messages(accountId,to).some(m => m.transportId === row.transport_id)
        || this.outboxes(accountId,to).some(o => o.components.some(p => p.transportId === row.transport_id))) {
        this.db.prepare('DELETE FROM wa_receipts WHERE account_id=? AND conversation_id=? AND transport_id=?').run(accountId,to,row.transport_id);
        continue;
      }
      const previous = this.outgoingReceipt(accountId,to,row.transport_id);
      const rank = {sent:1,delivered:2,read:3};
      if (!previous || rank[previous.level] < rank[row.level]) this.db.prepare('INSERT INTO wa_receipts VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,conversation_id,transport_id) DO UPDATE SET level=excluded.level,observed_at=excluded.observed_at,source=excluded.source')
        .run(accountId,to,row.transport_id,row.level,row.observed_at,row.source);
    }
    this.db.prepare('DELETE FROM wa_receipts WHERE account_id=? AND conversation_id=?').run(accountId,from);
  }
  private projectMessage(message: Message): Message {
    const {outgoingReceipt: _receipt, ...record} = message;
    const receipt = record.direction === 'outbound' ? this.outgoingReceipt(record.accountId,record.conversationId,record.transportId) : undefined;
    return receipt ? {...record,outgoingReceipt:receipt} : record;
  }
  private projectOutbox(outbox: Outbox): Outbox {
    return {...outbox,components:outbox.components.map(({outgoingReceipt: _receipt,...part}) => {
      const receipt = part.transportId ? this.outgoingReceipt(outbox.accountId,outbox.conversationId,part.transportId) : undefined;
      return receipt ? {...part,outgoingReceipt:receipt} : part;
    })};
  }
  assistantTurns(accountId: string): AssistantTurn[] {
    return this.db.prepare('SELECT payload FROM assistant_turns WHERE account_id=? ORDER BY rowid DESC LIMIT 100').all(accountId)
      .map(row => AssistantTurn.parse(JSON.parse(Payload.parse(row).payload))).reverse();
  }
  saveAssistantTurn(turn: AssistantTurn): void {
    this.db.prepare('INSERT INTO assistant_turns(id,account_id,payload) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING')
      .run(turn.id, turn.accountId, JSON.stringify(AssistantTurn.parse(turn)));
  }
  transaction<T>(operation: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = operation(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  private read<T>(table: Table, accountId: string, id: string, schema: z.ZodType<T>): T | undefined {
    const row = this.db.prepare(`SELECT payload FROM ${table} WHERE account_id=? AND id=?`).get(accountId, id);
    return row ? schema.parse(JSON.parse(Payload.parse(row).payload)) : undefined;
  }
  private list<T>(table: Table, accountId: string, schema: z.ZodType<T>, conversationId?: string): T[] {
    const where = conversationId === undefined ? 'account_id=?' : 'account_id=? AND conversation_id=?';
    const params = conversationId === undefined ? [accountId] : [accountId, conversationId];
    return this.db.prepare(`SELECT payload FROM ${table} WHERE ${where} ORDER BY rowid`).all(...params)
      .map(row => schema.parse(JSON.parse(Payload.parse(row).payload)));
  }
  private put(table: Table, record: RecordData): void {
    let changes = 0;
    if (table === 'conversations') {
      changes = Number(this.db.prepare(`INSERT INTO conversations(id,account_id,payload) VALUES(?,?,?)
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload WHERE account_id=excluded.account_id`)
        .run(record.id, record.accountId, JSON.stringify(record)).changes);
    } else if ('conversationId' in record) {
      changes = Number(this.db.prepare(`INSERT INTO ${table}(id,account_id,conversation_id,payload) VALUES(?,?,?,?)
        ON CONFLICT(id) DO UPDATE SET payload=excluded.payload
        WHERE account_id=excluded.account_id AND conversation_id=excluded.conversation_id`)
        .run(record.id, record.accountId, record.conversationId, JSON.stringify(record)).changes);
    } else { throw new Error('invalid_record_table'); }
    if (!changes) throw new DomainError('record_scope_conflict', 403);
  }
  conversation(accountId: string, id: string): Conversation | undefined { return this.read('conversations', accountId, id, Conversation); }
  duePauses(accountId: string, now: number): Conversation[] {
    return this.db.prepare(`SELECT payload FROM conversations WHERE account_id=? AND (
      json_extract(payload,'$.pause.until')<=? OR json_extract(payload,'$.pause.typingUntil')<=?
      OR json_extract(payload,'$.pause.catchUpMessageId') IS NOT NULL)`)
      .all(accountId,now,now).map(row => Conversation.parse(JSON.parse(Payload.parse(row).payload)));
  }
  conversations(accountId: string): Conversation[] { return this.list('conversations', accountId, Conversation); }
  saveConversation(record: Conversation): void {
    if (!this.db.isTransaction) {this.transaction(()=>this.saveConversation(record));return;}
    const previous = this.conversation(record.accountId,record.id);
    this.put('conversations', Conversation.parse(record));
    if(this.historyGroup(record.accountId,record.id).aiBlocked)this.suppressAsr(record.accountId,record.id);
    const restrictions = (c: Conversation) => [c.kind,c.mode,c.excluded,c.control,c.hours,
      c.pause ? {...c.pause,catchUpMessageId:null} : null];
    if (previous && JSON.stringify(restrictions(previous)) !== JSON.stringify(restrictions(record))) this.bumpHistory(record.accountId,record.id,true);
  }
  message(accountId:string,id:string):Message | undefined { const message = this.read('messages',accountId,id,Message); return message ? this.projectMessage(message) : undefined; }
  messages(accountId: string, conversationId: string): Message[] { return this.list('messages', accountId, Message, conversationId).map(message => this.projectMessage(message)); }
  recentMessages(accountId: string, conversationId: string, limit = 100, now = Date.now()): Message[] {
    return this.historyPage(accountId,conversationId,{limit},now).messages;
  }
  lastMessages(accountId: string, now = Date.now()): Message[] {
    return this.conversations(accountId).filter(c => this.historyGroup(accountId,c.id).id === c.id)
      .flatMap(c => this.historyPage(accountId,c.id,{limit:1},now).messages);
  }
  saveMessage(record: Message): void {
    if (!this.db.isTransaction) {this.transaction(()=>this.saveMessage(record));return;}
    const previous = this.message(record.accountId,record.id);
    const {outgoingReceipt: _receipt,...message}=Message.parse(record);this.put('messages',message);
    this.db.prepare('INSERT INTO history_versions VALUES(?,?,1) ON CONFLICT(account_id,conversation_id) DO UPDATE SET revision=revision+1').run(message.accountId,message.conversationId);
    const content = (m: Message) => [m.text,m.direction,m.authorship,m.occurredAt,m.quotedMessageId,m.media,m.contentState,m.contentRecovered];
    const changed=!!previous && JSON.stringify(content(previous)) !== JSON.stringify(content(message));
    this.bumpHistory(message.accountId,message.conversationId,changed);
    if(changed || message.media?.viewOnce || message.media?.access==='expired')this.suppressAsr(message.accountId,message.conversationId,message.transportId);
  }
  drafts(accountId: string, conversationId?: string): Draft[] { return this.list('drafts', accountId, Draft, conversationId); }
  draft(accountId: string, id: string): Draft | undefined { return this.read('drafts', accountId, id, Draft); }
  saveDraft(record: Draft): void { this.put('drafts', Draft.parse(record)); }
  grants(accountId: string, conversationId?: string): Grant[] { return this.list('delegations', accountId, Grant, conversationId); }
  saveGrant(record: Grant): void { this.put('delegations', Grant.parse(record)); }
  outboxes(accountId: string, conversationId?: string): Outbox[] { return this.list('outbox', accountId, Outbox, conversationId).map(outbox => this.projectOutbox(outbox)); }
  outbox(accountId: string, id: string): Outbox | undefined { const outbox = this.read('outbox', accountId, id, Outbox); return outbox ? this.projectOutbox(outbox) : undefined; }
  saveOutbox(record: Outbox): void { const outbox = Outbox.parse(record); this.put('outbox', {...outbox,components:outbox.components.map(({outgoingReceipt: _receipt,...part}) => part)}); }
  proposal(accountId: string, id: string): Proposal | undefined { return this.read('owner_actions', accountId, id, Proposal); }
  saveProposal(record: Proposal): void { this.put('owner_actions', Proposal.parse(record)); }
  request(accountId: string, id: string): { hash: string; result: unknown } | undefined {
    const row = this.db.prepare('SELECT payload_hash,result FROM api_requests WHERE account_id=? AND request_id=?').get(accountId, id);
    if (!row) return undefined;
    const saved = Cached.parse(row);
    return { hash: saved.payload_hash, result: JSON.parse(saved.result) };
  }
  saveRequest(accountId: string, id: string, hash: string, result: unknown): void {
    this.db.prepare('INSERT INTO api_requests(account_id,request_id,payload_hash,result) VALUES(?,?,?,?)')
      .run(accountId, id, hash, JSON.stringify(result));
  }
}
