import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPcQrViewer } from '../pc-qr.mjs';

const identity = { rootId: 'synthetic-root', instanceId: 'synthetic-instance', profileScope: { profileId: 'original', accountId: 'whatsapp-owner', revision: 3 } };
const intent = { ...identity, type: 'otherme-pc-display', requestId: 'synthetic-link', nonce: '00000000-0000-4000-8000-000000000001' };
const status = { state: 'qr', qr: 'data:image/png;base64,YQ==', pcDisplay: { requestId: intent.requestId, state: 'requested' } };
function fixture(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'otherme-synthetic-qr-'));
  const path = nonce => join(directory, nonce+'.png');
  const acks = []; let opens = 0, reads = 0, time = 0;
  const viewer = createPcQrViewer({ getIdentity: () => identity, isStopping: () => false,
    readStatus: async () => { reads++; return status; },
    write: (nonce, bytes) => writeFileSync(path(nonce), bytes, { mode: 0o600 }),
    open: async nonce => { opens++; assert.deepEqual(readFileSync(path(nonce)), Buffer.from('a')); },
    remove: nonce => { if (existsSync(path(nonce))) unlinkSync(path(nonce)); },
    acknowledge: message => acks.push(message), now: () => time, wait: async ms => { time += ms; }, ttl: 2000,
    ...overrides });
  return { viewer, acks, opens: () => opens, reads: () => reads, exists: () => existsSync(path(intent.nonce)), dispose: () => rmSync(directory, { recursive: true, force: true }) };
}
test('explicit request prepares one private file, acknowledges OS launch, expires and deduplicates all repeats', async () => {
  const f = fixture();
  try {
    await Promise.all([f.viewer.request(intent), f.viewer.request(intent)]);
    await f.viewer.request({ ...intent, nonce: '00000000-0000-4000-8000-000000000002' });
    assert.equal(f.opens(), 1); assert.equal(f.reads(), 2); assert.equal(f.exists(), false);
    assert.deepEqual(f.acks.map(a => a.state), ['ready', 'expired']);
    for (const ack of f.acks) {
      assert.deepEqual(Object.keys(ack).sort(), ['instanceId', 'nonce', 'profileScope', 'requestId', 'rootId', 'state', 'type']);
      assert.equal(ack.nonce, intent.nonce); assert.deepEqual(ack.profileScope, identity.profileScope);
    }
  } finally { f.dispose(); }
});
test('wrong checkout, instance, scope and non-explicit activity cannot open or read QR', async () => {
  const f = fixture();
  try {
    for (const changed of [{ rootId: 'other' }, { instanceId: 'other' }, { profileScope: { ...identity.profileScope, revision: 4 } },
      { profileScope: { ...identity.profileScope, accountId: 'other' } }, { type: 'status-poll' }]) await f.viewer.request({ ...intent, ...changed });
    assert.equal(f.opens(), 0); assert.equal(f.reads(), 0); assert.deepEqual(f.acks, []);
  } finally { f.dispose(); }
});
test('QR rotation removes the old image without opening another viewer', async () => {
  let reads = 0;
  const f = fixture({ readStatus: async () => ++reads === 1 ? status : { ...status, qr: 'data:image/png;base64,Yg==' } });
  try {
    await f.viewer.request(intent);
    assert.equal(f.opens(), 1); assert.equal(f.exists(), false);
    assert.deepEqual(f.acks.map(a => a.state), ['ready', 'expired']);
  } finally { f.dispose(); }
});
test('viewer launch failure is unavailable and always deletes its private file', async () => {
  const f = fixture({ open: async () => { throw new Error('synthetic-viewer-error'); } });
  try {
    await f.viewer.request(intent); assert.equal(f.exists(), false);
    assert.deepEqual(f.acks.map(a => a.state), ['unavailable']);
  } finally { f.dispose(); }
});
test('an OS-locked private image reports cleanup failure without crashing shutdown', async () => {
  const reports = [];
  const f = fixture({ remove: () => { throw new Error('synthetic-sharing-violation'); }, report: message => reports.push(message) });
  try {
    await f.viewer.request(intent); f.viewer.cancel();
    assert.deepEqual(f.acks.map(a => a.state), ['ready', 'unavailable']);
    assert.equal(f.exists(), true); assert.ok(reports.some(message => message.includes('cleanup failed')));
  } finally { f.dispose(); }
});

test('scope change and cancellation while OS launch is pending cannot acknowledge ready', async () => {
  let current = identity; let release, entered;
  const opening = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const f = fixture({ getIdentity: () => current, open: async () => { entered(); await opening; } });
  try {
    const pending = f.viewer.request(intent); await reached; assert.equal(f.exists(), true);
    current = { ...identity, profileScope: { ...identity.profileScope, revision: 4 } };
    f.viewer.cancel(); assert.equal(f.exists(), false); release(); await pending;
    assert.deepEqual(f.acks.map(a => a.state), ['expired']);
  } finally { release(); f.dispose(); }
});
test('stale backend request state never writes QR and manual P does not send display acknowledgements', async () => {
  const f = fixture({ readStatus: async () => ({ ...status, pcDisplay: { requestId: 'other', state: 'requested' } }) });
  try {
    await f.viewer.request(intent); assert.equal(f.opens(), 0);
    await f.viewer.request({ ...intent, requestId: 'manual' }, { manual: true });
    assert.equal(f.opens(), 1); assert.equal(f.exists(), false);
    assert.deepEqual(f.acks.map(a => a.state), ['expired']);
  } finally { f.dispose(); }
});
