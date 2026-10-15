import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';
import { SqliteStore } from '@replybot/core';
import { SessionDiscovery } from '@replybot/core/api';
import { createApp } from '../src/server.ts';
import { DEMO_ACCOUNT } from '../src/seed.ts';

const authorization = 'Bearer synthetic-owner-token';
function fixture() {
  const temporary = mkdtempSync(join(tmpdir(), 'otherme-public-assets-'));
  const directory = join(temporary, 'public');
  mkdirSync(join(directory, '_expo/static/js/web'), { recursive: true });
  mkdirSync(join(directory, 'assets'), { recursive: true });
  writeFileSync(join(directory, 'index.html'), '<!doctype html><title>Synthetic public app</title>');
  writeFileSync(join(directory, '_expo/static/js/web/app.js'), 'synthetic-public-bundle');
  writeFileSync(join(directory, 'assets/icon.png'), 'synthetic-public-icon');
  writeFileSync(join(directory, '.env'), 'synthetic-private-marker');
  writeFileSync(join(directory, 'assets/app.js.map'), 'synthetic-source-marker');
  writeFileSync(join(temporary, 'outside.js'), 'synthetic-outside-marker');
  return { temporary, directory };
}
test('public SPA and compiled assets share the backend, never an API fallback', async () => {
  const f = fixture();
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', desktopDir: f.directory });
  try {
    for (const url of ['/', '/settings', '/review?filter=local', '/assistant', '/conversation/synthetic%40s.whatsapp.net']) {
      const response = await app.inject({ url });
      assert.equal(response.statusCode, 200, url); assert.match(response.headers['content-type'] ?? '', /text\/html/);
      assert.match(response.body, /Synthetic public app/); assert.equal(response.headers['cache-control'], 'no-store');
    }
    assert.equal((await app.inject({ url: '/_expo/static/js/web/app.js' })).body, 'synthetic-public-bundle');
    const head = await app.inject({ method: 'HEAD', url: '/assets/icon.png' });
    assert.equal(head.statusCode, 200); assert.equal(head.body, '');
    assert.equal((await app.inject({ url: '/v1/snapshot' })).statusCode, 401);
    const missingApi = await app.inject({ url: '/v1/not-an-api', headers: { authorization } });
    assert.equal(missingApi.statusCode, 404); assert.doesNotMatch(missingApi.body, /Synthetic public app/);
    assert.equal((await app.inject({ url: '/v1/session', headers: { authorization } })).json().capabilities, undefined);
    const session = SessionDiscovery.parse((await app.inject({ url: '/v1/session?capabilities=1', headers: { authorization } })).json());
    assert.deepEqual(session.capabilities, { desktopBrowser: true, pcQrDisplay: false, ownerInstructions: true, contactBookNames: true });
  } finally { await app.close(); rmSync(f.temporary, { recursive: true, force: true }); }
});
test('encoded API routes retain authentication and profile guards beside public assets', async () => {
  const f = fixture();
  const scope = { profileId: 'original', accountId: DEMO_ACCOUNT, revision: 0 };
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', desktopDir: f.directory, profileScope: scope });
  const scoped = { authorization, 'X-Otherme-Profile': scope.profileId, 'X-Otherme-Revision': String(scope.revision) };
  try {
    for (const url of ['/%76%31/session', '/v%31/session', '/%76%31/snapshot', '/v1/%73napshot', '/%76%31/owner-instructions', '/v1/%63ontact-names']) {
      for (const method of ['GET', 'HEAD'] as const) {
        assert.equal((await app.inject({ method, url })).statusCode, 401, method+' '+url);
      }
    }
    for (const url of ['/%76%31/owner-instructions','/v1/%63ontact-names']) {
      assert.equal((await app.inject({url,headers:{authorization}})).statusCode,426);
      assert.equal((await app.inject({url,headers:{...scoped,'X-Otherme-Revision':'1'}})).statusCode,409);
      const settings = await app.inject({url,headers:scoped});
      assert.equal(settings.statusCode,200); assert.equal(settings.headers['cache-control'],'no-store');
    }
    assert.equal((await app.inject({ url: '/%76%31/snapshot', headers: { authorization } })).statusCode, 426);
    assert.equal((await app.inject({ url: '/%76%31/snapshot', headers: { ...scoped, 'X-Otherme-Revision': '1' } })).statusCode, 409);
    const response = await app.inject({ url: '/%76%31/snapshot', headers: scoped });
    assert.equal(response.statusCode, 200); assert.deepEqual(response.json().profileScope, scope);
    assert.equal((await app.inject({ url: '/' })).statusCode, 200);
    assert.equal((await app.inject({ url: '/v1/not-an-api' })).statusCode, 401);
  } finally { await app.close(); rmSync(f.temporary, { recursive: true, force: true }); }
});

test('static routes reject traversal, dotfiles, source, missing assets and unsafe directory links', async () => {
  const f = fixture();
  mkdirSync(join(f.temporary, 'private'));
  writeFileSync(join(f.temporary, 'private/escape.js'), 'synthetic-outside-marker');
  // A Windows junction does not require developer-mode symlink privileges.
  symlinkSync(join(f.temporary, 'private'), join(f.directory, 'assets/linked'), 'junction');
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', desktopDir: f.directory });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port; assert.ok(![3210, 8081, 8083].includes(port));
  // URL-based clients normalize dot segments before sending. Preserve the raw
  // request target so these assertions exercise the server's rejection itself.
  const raw = (path: string) => new Promise<{ statusCode: number; body: string }>((resolve, reject) => {
    const request = http.request({ host: '127.0.0.1', port, path, agent: false }, response => {
      let body = ''; response.setEncoding('utf8');
      response.on('data', (chunk: string) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode ?? 0, body }));
    });
    request.on('error', reject); request.end();
  });
  try {
    for (const url of ['/.env', '/.runtime/owner-token.txt', '/services/backend/src/index.ts', '/package.json',
      '/assets/../outside.js', '/assets/%2e%2e/outside.js', '/assets/%252e%252e/outside.js', '/assets/%2eenv',
      '/assets/../settings', '/assets/%2e%2e/settings', '/assets/%2e%2e/index.html', '/assets/%2f..%2fsettings',
      '/assets/%5c..%5coutside.js', '/assets/icon.png%00.js', '/assets/app.js.map', '/assets/missing.js',
      '/unknown-route', '/assets/linked/escape.js', '/v1%2fnot-an-api']) {
      const response = await raw(url);
      assert.notEqual(response.statusCode, 200, url);
      assert.doesNotMatch(response.body, /synthetic-(?:private|outside|source)-marker|Synthetic public app/, url);
    }
    assert.equal((await app.inject({ url: '/', remoteAddress: '203.0.113.5' })).statusCode, 403);
    assert.equal((await app.inject({ url: '/', headers: { origin: 'https://untrusted.invalid' } })).statusCode, 403);
  } finally { await app.close(); rmSync(f.temporary, { recursive: true, force: true }); }
});
test('automatic browser token provisioning remains loopback and local-origin only', async () => {
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token' });
  try {
    const post = (remoteAddress: string, origin?: string) => app.inject({ method: 'POST', url: '/v1/local-provision', remoteAddress,
      headers: origin ? { origin } : {}, payload: { confirmLocalDemo: true } });
    for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
      assert.equal((await post(ip, 'http://127.0.0.1:43219')).json().token, 'synthetic-owner-token');
    }
    for (const [ip, origin] of [['192.168.1.20', 'http://127.0.0.1:43219'], ['127.0.0.1', undefined], ['127.0.0.1', 'http://127.0.0.1.attacker.invalid']]) {
      assert.equal((await post(ip ?? '', origin)).statusCode, 403);
    }
  } finally { await app.close(); }
});
test('missing compiled public assets advertise no desktop capability', async () => {
  const f = fixture();
  const app = createApp({ store: new SqliteStore(), token: 'synthetic-owner-token', desktopDir: join(f.temporary, 'not-built') });
  try {
    assert.equal((await app.inject({ url: '/' })).statusCode, 404);
    assert.equal((await app.inject({ url: '/v1/session?capabilities=1', headers: { authorization } })).json().capabilities.desktopBrowser, false);
  } finally { await app.close(); rmSync(f.temporary, { recursive: true, force: true }); }
});
