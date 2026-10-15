import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildDesktop } from '../build-desktop.mjs';

test('desktop export selects same-origin mode and routes Expo only through the credential-isolating wrapper', () => {
  let calls = 0;
  buildDesktop({ environment: { ...process.env, EXPO_PUBLIC_BACKEND_URL: 'http://192.0.2.20:3210',
    OPENROUTER_API_KEY: 'synthetic-provider-key', OWNER_TOKEN: 'synthetic-owner-token', OTHERME_SIGNING_PASSWORD: 'synthetic-signing-key' },
    run(command, args, options) {
      calls++;
      assert.equal(command, process.execPath); assert.match(args[0], /mobile-node\.cjs$/);
      assert.match(args[1], /expo[\\/]bin[\\/]cli$/);
      assert.deepEqual(args.slice(2), ['export', '--platform', 'web', '--output-dir', 'dist']);
      assert.match(options.cwd, /apps[\\/]mobile$/);
      assert.equal(options.env.EXPO_PUBLIC_BACKEND_URL, undefined);
      // Execute only the wrapper with a tiny assertion program, never Expo/export.
      const check = spawnSync(command, [args[0], '-e', `
        const a=require('node:assert/strict');
        for(const key of ['OPENROUTER_API_KEY','OWNER_TOKEN','OTHERME_SIGNING_PASSWORD','EXPO_PUBLIC_BACKEND_URL']) a.equal(process.env[key],undefined);
        a.equal(process.env.EXPO_PUBLIC_DESKTOP,'1');a.equal(process.env.EXPO_NO_DOTENV,'1');
      `], { env: options.env, encoding: 'utf8' });
      assert.equal(check.status, 0, check.stderr);
      return { status: 0 };
    } });
  assert.equal(calls, 1);
});
test('desktop export reports failure without installing tools or retrying', () => {
  let calls = 0;
  assert.throws(() => buildDesktop({ run() { calls++; return { status: 1 }; } }), /export failed/);
  assert.equal(calls, 1);
});
