import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values, positionals } = parseArgs({ options: { 'signing-env-file': { type: 'string' } }, allowPositionals: true });
const signingEnvFile = resolve(values['signing-env-file'] || join(root, '.env'));
const apk = resolve(positionals[0] || join(root, '.runtime/releases/Otherme-0.1.1.apk'));
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
const tools = join(sdk, 'build-tools/36.0.0');
const expected = '6DDE749B5E7131A7D1B1272B3857254BF43EB7A1B1E639DBC6472C935C75E93E';
function check(condition, message) { if (!condition) throw new Error(message); }
try {
  const signature = execFileSync(join(process.env.JAVA_HOME, 'bin/java.exe'), ['-jar', join(tools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' });
  const digest = /Signer #1 certificate SHA-256 digest: ([\da-f:]+)/i.exec(signature)?.[1].replaceAll(':', '').toUpperCase();
  check(digest === expected, 'APK is not signed with the approved Otherme release certificate.');
  check(/^Number of signers: 1\s*$/m.test(signature), 'Unexpected APK signers.');
  const badging = execFileSync(join(tools, 'aapt2.exe'), ['dump', 'badging', apk], { encoding: 'utf8' });
  check(/package: name='com\.jstarstudios\.otherme'/.test(badging), 'Wrong application ID.');
  check(/application-label:'Otherme'/.test(badging), 'Wrong public name.');
  check(/versionCode='2'/.test(badging) && /versionName='0\.1\.1'/.test(badging), 'Wrong release version; update must be 0.1.1/code2.');
  for (const permission of ['INTERNET', 'RECORD_AUDIO', 'CAMERA']) check(badging.includes('android.permission.'+permission), 'Missing '+permission+' permission.');
  check(!badging.includes('application-debuggable'), 'APK is debuggable.');
  const manifest = execFileSync(join(tools, 'aapt2.exe'), ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], { encoding: 'utf8' });
  check(/usesCleartextTraffic\([^)\n]+\)=\s*(?:\(type 0x12\)\s*)?(?:0xffffffff|true)\s*$/m.test(manifest), 'Trusted-LAN HTTP is not enabled.');
  check(/allowBackup\([^)\n]+\)=\s*(?:\(type 0x12\)\s*)?(?:0x0|false)\s*$/m.test(manifest), 'Android backup must be disabled.');
  const local = parseEnv(readFileSync(signingEnvFile, 'utf8'));
  const secrets = Object.entries(local).filter(([key, value]) => /PASSWORD|TOKEN|API_KEY/.test(key) && value.length >= 8).map(([, value]) => value);
  const tokenPath = join(dirname(signingEnvFile), '.runtime/owner-token.txt');
  if (existsSync(tokenPath)) secrets.push(readFileSync(tokenPath, 'utf8').trim());
  const scan = execFileSync('python', ['-c', `
import sys,json,zipfile,re
apk=sys.argv[1]
secrets=[s.encode() for s in json.load(sys.stdin) if len(s)>=8]
with zipfile.ZipFile(apk) as z:
    names=z.namelist()
    assert not any(re.search(r'(^|/)(\\.env(?:\\..*)?|\\.runtime|\\.git|whatsapp-auth|owner-token\\.txt|creds\\.json|.*\\.(?:p12|jks|keystore))($|/)',n,re.I) for n in names), 'Private file in APK'
    bundle=z.read('assets/index.android.bundle')
    assert len(bundle)>100000, 'Missing embedded JS'
    for n in names:
        if not n.endswith('/'):
            data=z.read(n)
            assert not any(s in data for s in secrets), 'Private credential found in APK'
    print(json.dumps({'embeddedBundleBytes':len(bundle),'archiveEntries':len(names),'privateFileAndCredentialScan':'passed'}))
`, apk], { input: JSON.stringify(secrets), encoding: 'utf8', maxBuffer: 1024 * 1024 });
  console.info('APK signature, package/name, non-debuggable manifest, HTTP, backup and permissions verified.');
  console.info('Release SHA-256 certificate: '+expected.match(/../g).join(':'));
  console.info(scan.trim());
} catch {
  // Child errors can include arguments and input. Do not echo them.
  console.error('APK verification failed. Do not distribute or install this artifact.');
  process.exitCode = 1;
}
