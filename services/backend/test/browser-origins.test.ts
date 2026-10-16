import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { SqliteStore } from '@replybot/core';
import { createApp } from '../src/server.ts';

// Evaluate only the startup's adapter selection and Origin option. Never import
// index.ts, which would open the real runtime and start a service.
function configuredOrigins(lan: boolean): string[] {
  const source = ts.createSourceFile('index.ts', readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true);
  let addresses: ts.VariableStatement | undefined;
  let origins: ts.Expression | undefined;
  function visit(node: ts.Node): void {
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some(d => d.name.getText(source) === 'addresses')) addresses = node;
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === 'allowedOrigins') origins = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);assert.ok(addresses);assert.ok(origins);
  const code = ts.transpileModule(addresses.getText(source)+'\n'+origins.getText(source), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const result: unknown = runInNewContext(code, { lan, networkInterfaces: () => ({
    ethernet: [{ address: '192.168.50.8', internal: false, family: 'IPv4' }],
    wifi: [{ address: '10.5.6.7', internal: false, family: 'IPv4' }, { address: '172.20.1.8', internal: false, family: 'IPv4' }],
    excluded: [{ address: '127.0.0.1', internal: true, family: 'IPv4' }, { address: '203.0.113.5', internal: false, family: 'IPv4' }, { address: 'fd00::1', internal: false, family: 'IPv6' }],
  }) });
  assert.ok(Array.isArray(result) && result.every(item => typeof item === 'string'));
  return Array.from(result);
}

test('startup approves only configured private IPv4 adapters on browser3210 and legacy8081', () => {
  assert.deepEqual(configuredOrigins(false), []);
  assert.deepEqual(configuredOrigins(true).sort(), ['192.168.50.8','10.5.6.7','172.20.1.8'].flatMap(address => [3210,8081].map(port => 'http://'+address+':'+port)).sort());
});

test('configured LAN browser Origins still require exact owner token and profile headers', async () => {
  const scope = { profileId: 'original', accountId: 'invented-owner', revision: 2 };
  const app = createApp({ store: new SqliteStore(), token: 'invented-owner-token', accountId: scope.accountId, profileScope: scope, seed: false, allowedOrigins: configuredOrigins(true) });
  const scoped = { authorization: 'Bearer invented-owner-token', 'x-otherme-profile': scope.profileId, 'x-otherme-revision': String(scope.revision) };
  try {
    for (const origin of ['http://192.168.50.8:3210','http://192.168.50.8:8081']) {
      const inject = (headers: Record<string,string>) => app.inject({ url: '/v1/owner-instructions', remoteAddress: '192.168.50.20', headers: { origin, ...headers } });
      const allowed = await inject(scoped);
      assert.equal(allowed.statusCode,200,origin);assert.equal(allowed.headers['access-control-allow-origin'],origin);
      assert.equal((await inject({})).statusCode,401);
      assert.equal((await inject({ ...scoped, authorization:'Bearer invented-wrong-token' })).statusCode,401);
      assert.equal((await inject({ authorization:scoped.authorization })).statusCode,426);
      assert.equal((await inject({ ...scoped, 'x-otherme-profile':'second' })).statusCode,409);
      assert.equal((await inject({ ...scoped, 'x-otherme-revision':'1' })).statusCode,409);
      const preflight = await app.inject({ method:'OPTIONS',url:'/v1/owner-instructions',remoteAddress:'192.168.50.20',headers:{origin,'access-control-request-method':'GET','access-control-request-headers':'authorization,x-otherme-profile,x-otherme-revision'} });
      assert.equal(preflight.statusCode,204);assert.equal(preflight.headers['access-control-allow-origin'],origin);
    }
    for (const origin of ['http://192.168.50.9:3210','http://192.168.50.8:8083','https://192.168.50.8:3210','http://192.168.50.8:3210.attacker.invalid','http://203.0.113.5:3210','null']) {
      const denied = await app.inject({ url:'/v1/owner-instructions',remoteAddress:'192.168.50.20',headers:{...scoped,origin,host:'192.168.50.8:3210'} });
      assert.equal(denied.statusCode,403,origin);assert.equal(denied.json().error,'origin_denied');assert.equal(denied.headers['access-control-allow-origin'],undefined);
    }
  } finally { await app.close(); }
});

test('approved LAN browser Origins never permit remote or LAN-origin token provisioning', async () => {
  const app = createApp({ store:new SqliteStore(),token:'invented-owner-token',seed:false,allowedOrigins:configuredOrigins(true) });
  try {
    for (const remoteAddress of ['127.0.0.1','192.168.50.20','::ffff:192.168.50.20']) {
      for (const origin of ['http://192.168.50.8:3210','http://192.168.50.8:8081','http://localhost:3210']) {
        if (remoteAddress==='127.0.0.1' && origin==='http://localhost:3210') continue;
        const response=await app.inject({method:'POST',url:'/v1/local-provision',remoteAddress,headers:{origin},payload:{confirmLocalDemo:true}});
        assert.equal(response.statusCode,403);assert.doesNotMatch(response.body,/invented-owner-token|"token"/);
      }
    }
  } finally { await app.close(); }
});
