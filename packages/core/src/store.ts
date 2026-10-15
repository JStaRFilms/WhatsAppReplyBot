import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';
import { Conversation, Message, Draft, Grant, Outbox, Proposal, DomainError, ImageUpload, AudioUpload, OutgoingReceipt, type NameSource } from './contracts.ts';

import { AssistantTurn, OwnerInstructions, ContactNameSettings } from './api.ts';

const Payload = z.object({ payload: z.string() });
const Cached = z.object({ payload_hash: z.string(), result: z.string() });
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
      CREATE INDEX IF NOT EXISTS message_time ON messages(account_id,conversation_id,json_extract(payload,'$.occurredAt') DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS message_transport_id ON messages(
        account_id,conversation_id,json_extract(payload,'$.transportId'));
      CREATE UNIQUE INDEX IF NOT EXISTS outbox_request_id ON outbox(account_id,json_extract(payload,'$.requestId'));
      CREATE UNIQUE INDEX IF NOT EXISTS active_grant ON delegations(account_id,conversation_id)
        WHERE json_extract(payload,'$.state')='active';`);
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
      AND json_extract(m.payload,'$.direction')='inbound' AND json_extract(m.payload,'$.source')='live' GROUP BY m.conversation_id`).all(accountId);
    return Object.fromEntries(rows.map(row=>{const r=z.object({conversation_id:z.string(),count:z.number()}).parse(row);return[r.conversation_id,r.count];}));
  }
  historyVersions(accountId:string): Record<string,number> {
    return Object.fromEntries(this.db.prepare('SELECT conversation_id,revision FROM history_versions WHERE account_id=?').all(accountId).map(row=>{const r=z.object({conversation_id:z.string(),revision:z.number()}).parse(row);return[r.conversation_id,r.revision];}));
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
    const existing = this.waCanonical(accountId, alias);
    if (existing !== alias && existing !== canonical) throw new DomainError('wa_alias_conflict', 403);
    this.db.prepare('INSERT INTO wa_aliases(account_id,alias,canonical) VALUES(?,?,?) ON CONFLICT(account_id,alias) DO NOTHING').run(accountId, alias, canonical);
  }
  saveWaMessage(accountId: string, conversationId: string, transportId: string, payload: string): void {
    this.db.prepare('INSERT INTO wa_messages VALUES(?,?,?,?) ON CONFLICT(account_id,conversation_id,transport_id) DO UPDATE SET payload=excluded.payload').run(accountId, conversationId, transportId, payload);
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
    this.db.prepare('INSERT INTO account_settings(account_id,model_consent) VALUES(?,?) ON CONFLICT(account_id) DO UPDATE SET model_consent=excluded.model_consent')
      .run(accountId, consent ? 1 : 0);
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
      || new Set(targets.map(target => target.chat)).size > 1) return undefined;
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
      if (messages.length && outboxes.length && messages[0]?.conversationId !== outboxes[0]?.conversationId) return false;
      if (messages.some(m => m.direction !== 'outbound') || messages.length > 1 || components.length > 1
        || !messages.length && !components.some(p => ['dispatching','accepted','unknown'].includes(p.state))) return false;
      const previous = this.outgoingReceipt(accountId,conversationId,transportId);
      const rank = { sent: 1, delivered: 2, read: 3 };
      if (previous && rank[previous.level] >= rank[receipt.level]) return false;
      this.db.prepare('INSERT INTO wa_receipts VALUES(?,?,?,?,?,?) ON CONFLICT(account_id,conversation_id,transport_id) DO UPDATE SET level=excluded.level,observed_at=excluded.observed_at,source=excluded.source')
        .run(accountId,conversationId,transportId,receipt.level,receipt.observedAt,receipt.source);
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
  saveConversation(record: Conversation): void { this.put('conversations', Conversation.parse(record)); }
  message(accountId:string,id:string):Message | undefined { const message = this.read('messages',accountId,id,Message); return message ? this.projectMessage(message) : undefined; }
  messages(accountId: string, conversationId: string): Message[] { return this.list('messages', accountId, Message, conversationId).map(message => this.projectMessage(message)); }
  recentMessages(accountId: string, conversationId: string, limit = 100): Message[] {
    return this.db.prepare("SELECT payload FROM messages WHERE account_id=? AND conversation_id=? ORDER BY json_extract(payload,'$.occurredAt') DESC,rowid DESC LIMIT ?")
      .all(accountId,conversationId,limit).map(row => this.projectMessage(Message.parse(JSON.parse(Payload.parse(row).payload)))).reverse();
  }
  lastMessages(accountId: string): Message[] {
    return this.db.prepare(`SELECT m.payload FROM conversations c JOIN messages m ON m.rowid=(
      SELECT rowid FROM messages WHERE account_id=c.account_id AND conversation_id=c.id
      ORDER BY json_extract(payload,'$.occurredAt') DESC,rowid DESC LIMIT 1) WHERE c.account_id=?`)
      .all(accountId).map(row => this.projectMessage(Message.parse(JSON.parse(Payload.parse(row).payload))));
  }
  saveMessage(record: Message): void {
    const {outgoingReceipt: _receipt,...message}=Message.parse(record);this.put('messages',message);
    this.db.prepare('INSERT INTO history_versions VALUES(?,?,1) ON CONFLICT(account_id,conversation_id) DO UPDATE SET revision=revision+1').run(message.accountId,message.conversationId);
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
