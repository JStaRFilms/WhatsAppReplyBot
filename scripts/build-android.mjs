import { existsSync, readFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { 'signing-env-file': { type: 'string' } } });
const signingEnvFile = resolve(values['signing-env-file'] || join(root, '.env'));
const mobile = join(root, 'apps/mobile');
const require = createRequire(join(mobile, 'package.json'));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const java = process.env.JAVA_HOME;
function required(path) {
  if (!path || !existsSync(path)) throw new Error('Missing local build component: '+path+'. Installation needs owner approval.');
}
function run(command, args, cwd, env) {
  const child = spawnSync(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  if (child.error || child.status !== 0) throw new Error('Local build command failed. See output above.');
}
const env = { ...process.env, EXPO_NO_DOTENV: '1', CI: '1', NODE_ENV: 'production' };
for (const key of Object.keys(env)) if (/^(OTHERME_SIGNING_|OPENROUTER_|OWNER_TOKEN)/.test(key)) delete env[key];
try {
  required(java && join(java, 'bin', 'java.exe'));
  required(sdk && join(sdk, 'platforms/android-36/android.jar'));
  required(sdk && join(sdk, 'build-tools/36.0.0/aapt2.exe'));
  required(sdk && join(sdk, 'ndk/27.1.12297006/source.properties'));
  required(sdk && join(sdk, 'cmake/3.22.1/bin/cmake.exe'));
  const local = parseEnv(readFileSync(signingEnvFile, 'utf8'));
  const store = resolve(dirname(signingEnvFile), local.OTHERME_SIGNING_STORE_FILE || '.runtime/signing/otherme-release.p12');
  required(store);
  if (!local.OTHERME_SIGNING_PASSWORD || local.OTHERME_SIGNING_KEY_ALIAS !== 'otherme')
    throw new Error('Dedicated Otherme signing settings are missing. No debug key fallback is permitted.');
  const expo = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
  run(process.execPath, [expo, 'prebuild', '--platform', 'android', '--clean', '--no-install'], mobile, env);
  const signingEnv = { ...env, OTHERME_SIGNING_STORE_FILE: store,
    OTHERME_SIGNING_KEY_ALIAS: local.OTHERME_SIGNING_KEY_ALIAS, OTHERME_SIGNING_PASSWORD: local.OTHERME_SIGNING_PASSWORD };
  // No daemon/configuration cache retains the private signing configuration.
  const gradle = '.\\gradlew.bat assembleRelease --no-daemon --no-configuration-cache --max-workers=2 -Pandroid.builder.sdkDownload=false -Porg.gradle.java.installations.auto-download=false -PreactNativeArchitectures=arm64-v8a,x86_64';
  run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', gradle], join(mobile, 'android'), signingEnv);
  const output = join(root, '.runtime/releases');
  mkdirSync(output, { recursive: true });
  const apk = join(output, 'Otherme-0.1.2.apk');
  const built = join(root, '.runtime/native/app/outputs/apk/release/app-release.apk');
  run(process.execPath, [join(root, 'scripts/verify-apk.mjs'), built, '--signing-env-file', signingEnvFile], root, env);
  copyFileSync(built, apk);
  console.info('Verified signed release: '+apk);
} catch (error) {
  // Never print environment objects or a signing command with credential values.
  console.error(error instanceof Error ? error.message : 'Android build failed.');
  process.exitCode = 1;
}
