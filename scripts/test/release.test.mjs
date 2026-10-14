import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
const { configureSigning } = require('../../apps/mobile/plugins/with-otherme-release.cjs');

test('short build copy includes only build inputs and refuses an existing destination', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'otherme-build-copy-'));
  const destination = join(temporary, 'source');
  const script = fileURLToPath(new URL('../prepare-android-copy.mjs', import.meta.url));
  try {
    const child = spawnSync(process.execPath, [script, '--build-root', destination], { encoding: 'utf8' });
    assert.equal(child.status, 0, child.stderr);
    assert.equal(readFileSync(join(destination, '.npmrc'), 'utf8'), 'virtual-store-dir-max-length=32\n');
    for (const file of ['.env', '.git', '.runtime', 'node_modules', 'docs', 'services', 'apps/mobile/android', 'scripts/create-signing-key.mjs']) {
      assert.equal(existsSync(join(destination, file)), false, file);
    }
    for (const file of ['apps/mobile/app.json', 'packages/core/src/contracts.ts', 'scripts/build-android.mjs', 'scripts/verify-apk.mjs']) {
      assert.deepEqual(readFileSync(join(destination, file)), readFileSync(fileURLToPath(new URL('../../'+file, import.meta.url))));
    }
    writeFileSync(join(destination, 'sentinel'), 'preserve');
    const repeat = spawnSync(process.execPath, [script, '--build-root', destination], { encoding: 'utf8' });
    assert.notEqual(repeat.status, 0);
    assert.equal(readFileSync(join(destination, 'sentinel'), 'utf8'), 'preserve');
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('image picker cannot globally block the microphone permission required by voice notes', () => {
  const { expo } = JSON.parse(readFileSync(fileURLToPath(new URL('../../apps/mobile/app.json', import.meta.url)), 'utf8'));
  const picker = expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-image-picker');
  assert.ok(picker);
  assert.notEqual(picker[1].microphonePermission, false);
  assert.equal(expo.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'), false);
});

test('release signing replaces debug fallback, remains idempotent and keeps secrets as environment lookups', () => {
  const template = 'react {\n}\nandroid {\n    signingConfigs {\n        debug {}\n    }\n    buildTypes { release { signingConfig signingConfigs.debug\n } }\n}';
  const result = configureSigning(template);
  assert.match(result, /release \{ signingConfig signingConfigs.othermeRelease/);
  assert.match(result, /System.getenv\('OTHERME_SIGNING_PASSWORD'\)/);
  assert.match(result, /mobile-node.cjs/);
  assert.equal(configureSigning(result), result);
  assert.throws(() => configureSigning('release { changedTemplate() }'), /Refusing debug signing/);
});
test('Metro child receives public address but no signing or backend credentials', () => {
  const child = spawnSync(process.execPath, [fileURLToPath(new URL('../mobile-node.cjs', import.meta.url)), '-e',
    `const a=require('node:assert/strict');a.equal(process.env.OTHERME_SIGNING_PASSWORD,undefined);a.equal(process.env.OPENROUTER_API_KEY,undefined);a.equal(process.env.OWNER_TOKEN,undefined);a.equal(process.env.EXPO_PUBLIC_BACKEND_URL,'http://192.0.2.1:3210');a.equal(process.env.EXPO_NO_DOTENV,'1');`], {
    env: { ...process.env, OTHERME_SIGNING_PASSWORD: 'synthetic-signing-secret', OPENROUTER_API_KEY: 'synthetic-api-secret', OWNER_TOKEN: 'synthetic-token', EXPO_PUBLIC_BACKEND_URL: 'http://192.0.2.1:3210' },
    encoding: 'utf8',
  });
  assert.equal(child.status, 0, child.stderr);
});
