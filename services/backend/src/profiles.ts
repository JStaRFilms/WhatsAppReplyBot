import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { z } from 'zod';
import { DomainError } from '@replybot/core';
import { ProfileOperation, ProfileScope, ProfileTransitionInput, type ProfileDescriptor } from '@replybot/core/api';

const ProfileId = z.union([z.literal('original'), z.string().uuid()]);
const StoredProfile = z.object({ profileId: ProfileId, label: z.string().min(1).max(80) }).strict();
const Entry = z.object({ operation: ProfileOperation, hash: z.string(), acknowledged: z.boolean().default(false) });
const Registry = z.object({ version: z.literal(1), activeProfileId: ProfileId, revision: z.number().int().nonnegative(),
  profiles: z.array(StoredProfile), operations: z.array(Entry), currentRequestId: z.string().nullable() }).strict();
type Registry = z.infer<typeof Registry>;
const original = (): Registry => ({ version: 1, activeProfileId: 'original', revision: 0,
  profiles: [{ profileId: 'original', label: 'Original account' }], operations: [], currentRequestId: null });
export const accountForProfile = (id: string): string => ProfileId.parse(id) === 'original' ? 'whatsapp-owner' : 'whatsapp-'+id;
export function profilePaths(runtime: string, id: string) {
  ProfileId.parse(id);
  const directory = id === 'original' ? runtime : join(runtime, 'profiles', id);
  return { database: join(directory, 'whatsapp.sqlite'), auth: join(directory, 'whatsapp-auth') };
}
function digest(input: ProfileTransitionInput, scope: ProfileScope): string {
  return createHash('sha256').update(JSON.stringify({ input: ProfileTransitionInput.parse(input), scope: ProfileScope.parse(scope) })).digest('hex');
}
function sameScope(a: ProfileScope, b: ProfileScope): boolean {
  return a.profileId === b.profileId && a.accountId === b.accountId && a.revision === b.revision;
}
export function ownerLock(auth: string): Buffer {
  try {
    const bytes = readFileSync(join(auth, 'owner-identity.json'));
    z.object({ owner: z.string().min(1) }).strict().parse(JSON.parse(bytes.toString('utf8')));
    return bytes;
  } catch { throw new DomainError('owner_identity_required', 409); }
}

// One backend and its owning launcher write in distinct protocol phases. Every write
// rereads the durable journal; the launcher lock prevents a second lifecycle owner.
export class ProfileRegistry {
  private readonly path: string;
  constructor(readonly runtime: string) { this.path = join(runtime, 'profiles.json'); }
  private read(): Registry {
    if (!existsSync(this.path)) return original();
    const data = Registry.parse(JSON.parse(readFileSync(this.path, 'utf8')));
    if (!data.profiles.some(p => p.profileId === data.activeProfileId)
      || new Set(data.profiles.map(p => p.profileId)).size !== data.profiles.length
      || new Set(data.operations.map(e => e.operation.requestId)).size !== data.operations.length
      || data.currentRequestId !== (data.operations.at(-1)?.operation.requestId ?? null)
      || data.revision !== data.operations.length
      || data.operations.some((e, index) => e.operation.sourceScope.revision !== index
        || e.operation.sourceScope.accountId !== accountForProfile(e.operation.sourceScope.profileId)
        || !data.profiles.some(p => p.profileId === e.operation.targetProfileId))) throw new Error('invalid_profile_registry');
    return data;
  }
  private write(data: Registry): void {
    Registry.parse(data);
    mkdirSync(this.runtime, { recursive: true, mode: 0o700 });
    const temporary = this.path+'.'+randomUUID()+'.tmp';
    const fd = openSync(temporary, 'wx', 0o600);
    try { writeFileSync(fd, JSON.stringify(data)); fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temporary, this.path);
    // Windows does not support opening directories for fsync.
    if (process.platform !== 'win32') { const dir = openSync(this.runtime, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
  }
  scope(): ProfileScope {
    const data = this.read();
    return { profileId: data.activeProfileId, accountId: accountForProfile(data.activeProfileId), revision: data.revision };
  }
  list(): ProfileDescriptor[] {
    const data = this.read();
    return data.profiles.map(p => ({ ...p, accountId: accountForProfile(p.profileId), active: p.profileId === data.activeProfileId }));
  }
  current(): ProfileOperation | null {
    const data = this.read();
    return data.operations.find(e => e.operation.requestId === data.currentRequestId)?.operation ?? null;
  }
  blocked(): boolean { const operation = this.current(); return operation !== null && operation.state !== 'completed'; }
  operation(id: string): ProfileOperation {
    const result = this.read().operations.find(e => e.operation.requestId === id);
    if (!result) throw new DomainError('profile_operation_not_found', 404);
    return result.operation;
  }
  replay(input: ProfileTransitionInput, profileId: string, revision: number): ProfileOperation | null {
    const entry = this.read().operations.find(e => e.operation.requestId === input.requestId);
    if (!entry) return null;
    const source = entry.operation.sourceScope;
    if (source.profileId !== profileId || source.revision !== revision || entry.hash !== digest(input, source))
      throw new DomainError('request_id_conflict', 409);
    return entry.operation;
  }
  begin(input: ProfileTransitionInput, source: ProfileScope): ProfileOperation {
    const data = this.read();
    const replay = this.replay(input, source.profileId, source.revision);
    if (replay) return replay;
    if (this.blocked()) throw new DomainError('profile_transition_in_progress', 409);
    if (!sameScope(source, this.scope())) throw new DomainError('profile_scope_changed', 409);
    const target = input.kind === 'create' ? randomUUID() : input.kind === 'activate' ? ProfileId.parse(input.profileId) : source.profileId;
    if (input.kind === 'activate' && (!data.profiles.some(p => p.profileId === target) || target === source.profileId))
      throw new DomainError('invalid_profile_target', 422);
    if (input.kind === 'repair') ownerLock(profilePaths(this.runtime, source.profileId).auth);
    if (input.kind === 'create') data.profiles.push({ profileId: target, label: input.label });
    const operation: ProfileOperation = { requestId: input.requestId, kind: input.kind, state: 'quiescing',
      sourceScope: source, targetProfileId: target, resultScope: null, error: null };
    data.revision++;
    data.currentRequestId = input.requestId;
    data.operations.push({ operation, hash: digest(input, source), acknowledged: false });
    this.write(data);
    return operation;
  }
  update(id: string, state: 'restarting' | 'failed', error: string | null = null): ProfileOperation {
    const data = this.read();
    const entry = data.operations.find(e => e.operation.requestId === id);
    if (!entry || data.currentRequestId !== id || entry.operation.state === 'completed') throw new Error('invalid_profile_phase');
    entry.operation = { ...entry.operation, state, error };
    this.write(data); return entry.operation;
  }
  acknowledge(id: string): void {
    const data = this.read(); const entry = data.operations.find(e => e.operation.requestId === id);
    if (!entry || data.currentRequestId !== id || entry.operation.state !== 'restarting') throw new Error('profile_not_quiesced');
    entry.acknowledged = true; this.write(data);
  }
  requiresOwnerLock(id: string): boolean {
    return this.read().operations.some(e => e.operation.kind === 'repair' && e.operation.targetProfileId === id);
  }
  acknowledged(id: string): boolean { return this.read().operations.some(e => e.operation.requestId === id && e.acknowledged); }
  // Call only after the owning launcher has observed its child exit. No API calls this.
  prepareAfterExit(id: string): ProfileScope {
    const data = this.read(); const entry = data.operations.find(e => e.operation.requestId === id);
    if (!entry || data.currentRequestId !== id || entry.operation.state !== 'restarting' || !entry.acknowledged)
      throw new Error('profile_exit_not_acknowledged');
    const target = entry.operation.targetProfileId;
    if (!target) throw new Error('profile_target_missing');
    if (entry.operation.kind === 'repair') {
      const { auth } = profilePaths(this.runtime, target);
      const archived = auth+'.archived-'+id;
      const lock = ownerLock(existsSync(archived) ? archived : auth);
      if (!existsSync(archived)) renameSync(auth, archived);
      mkdirSync(auth, { recursive: true, mode: 0o700 });
      writeFileSync(join(auth, 'owner-identity.json'), lock, { mode: 0o600 });
    }
    data.activeProfileId = target;
    this.write(data);
    return this.scope();
  }
  complete(id: string, scope: ProfileScope): void {
    const data = this.read(); const entry = data.operations.find(e => e.operation.requestId === id);
    if (!entry || data.currentRequestId !== id || entry.operation.state !== 'restarting' || !entry.acknowledged
      || entry.operation.targetProfileId !== scope.profileId || !sameScope(scope, this.scope())) throw new Error('invalid_profile_completion');
    entry.operation = { ...entry.operation, state: 'completed', resultScope: scope };
    this.write(data);
  }
}

export async function bounded<T>(work: Promise<T>, milliseconds: number, error: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(error)), milliseconds); })]);
  } finally { clearTimeout(timer); }
}
