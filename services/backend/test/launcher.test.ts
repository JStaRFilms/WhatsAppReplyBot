import assert from 'node:assert/strict';
import test from 'node:test';
import { SqliteStore } from '@replybot/core';
import { createApp } from '../src/server.ts';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasSavedPairing } from '../src/launcher-startup.ts';

test('launcher restores only a registered session with an existing owner identity', () => {
  const auth = mkdtempSync(join(tmpdir(), 'otherme-synthetic-pairing-'));
  try {
    assert.equal(hasSavedPairing(auth), false);
    writeFileSync(join(auth, 'creds.json'), JSON.stringify({ registered: true }));
    assert.equal(hasSavedPairing(auth), false);
    writeFileSync(join(auth, 'owner-identity.json'), JSON.stringify({ owner: 'synthetic-owner' }));
    assert.equal(hasSavedPairing(auth), true);
    for (const value of ['{}', 'null', '{"registered":"true"}', '{"registered":false}', 'invalid']) {
      writeFileSync(join(auth, 'creds.json'), value);
      assert.equal(hasSavedPairing(auth), false);
    }
  } finally { rmSync(auth, { recursive: true, force: true }); }
});

test('launcher identity requires owner auth and exposes neither snapshot nor pairing data', async () => {
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', whatsapp: { authDir: 'unused-synthetic-auth' },launcher:{rootId:'synthetic-root',instanceId:'synthetic-instance'} });
  try {
    assert.equal((await app.inject({ url: '/v1/launcher' })).statusCode, 401);
    assert.equal((await app.inject({ url: '/v1/launcher', headers: { authorization: 'Bearer wrong-token' } })).statusCode, 401);
    const response = await app.inject({ url: '/v1/launcher', headers: { authorization: 'Bearer synthetic-owner-token' } });
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.json(), { service: 'otherme-backend', protocol: 1, accountId: 'whatsapp-owner', demo: false, whatsapp: 'disconnected', rootId:'synthetic-root',instanceId:'synthetic-instance' });
  } finally { await app.close(); }
});
