import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { parseArgs, parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = '6DDE749B5E7131A7D1B1272B3857254BF43EB7A1B1E639DBC6472C935C75E93E';
function check(condition, message) { if (!condition) throw new Error(message); }

export function assertReleaseManifest(badging, manifest) {
  check(/package: name='com\.jstarstudios\.otherme'/.test(badging), 'Wrong application ID.');
  check(/application-label:'Otherme'/.test(badging), 'Wrong public name.');
  check(/versionCode='4'/.test(badging) && /versionName='0\.1\.3'/.test(badging), 'Wrong release version; update must be 0.1.3/code4.');
  const permissions = new Set([...badging.matchAll(/^uses-permission(?:-sdk-\d+)?: name='([^']+)'/gm)].map(match => match[1]));
  for (const permission of ['INTERNET', 'RECORD_AUDIO', 'CAMERA', 'READ_CONTACTS'])
    check(permissions.has('android.permission.'+permission), 'Missing '+permission+' permission.');
  check(!permissions.has('android.permission.WRITE_CONTACTS'), 'Contact writing must not be permitted.');
  check(![...permissions].some(permission => permission.startsWith('android.permission.FOREGROUND_SERVICE')), 'Foreground service permission is forbidden.');
  check(!badging.includes('application-debuggable'), 'APK is debuggable.');
  check(/usesCleartextTraffic\([^)\n]+\)=\s*(?:\(type 0x12\)\s*)?(?:0xffffffff|true)\s*$/m.test(manifest), 'Trusted-LAN HTTP is not enabled.');
  check(/allowBackup\([^)\n]+\)=\s*(?:\(type 0x12\)\s*)?(?:0x0|false)\s*$/m.test(manifest), 'Android backup must be disabled.');

  // aapt2 lists each element's attributes before its child elements. Keep names
  // and flags on their own element rather than matching another activity's flag.
  const elements = [];
  let element;
  for (const line of manifest.split(/\r?\n/)) {
    const node = /^\s*E:\s*([^\s(]+)/.exec(line);
    if (node) { element = { kind: node[1], attributes: new Map() }; elements.push(element); }
    else {
      const attribute = /^\s*A:\s*(?:(?:android|http:\/\/schemas\.android\.com\/apk\/res\/android):)?(\w+)(?:\([^)]*\))?=(.*)$/.exec(line);
      if (element && attribute) element.attributes.set(attribute[1], attribute[2].trim());
    }
  }
  const name = node => /^"([^"]+)"/.exec(node.attributes.get('name') ?? '')?.[1];
  const activities = elements.filter(node => node.kind === 'activity');
  const main = activities.filter(node => ['.MainActivity', 'com.jstarstudios.otherme.MainActivity'].includes(name(node)));
  const fullscreen = activities.filter(node => name(node) === 'expo.modules.video.FullscreenPlayerActivity');
  check(main.length === 1 && fullscreen.length === 1, 'Required release activities are missing or ambiguous.');
  for (const activity of [main[0], fullscreen[0]])
    check(/^(?:\(type 0x12\)\s*)?(?:0x0+|false)$/.test(activity.attributes.get('supportsPictureInPicture') ?? ''), 'Picture-in-picture must be explicitly disabled.');
  const keyboardMode = /^(?:\(type [^)]+\)\s*)?(0x[\da-f]+)$/i.exec(main[0].attributes.get('windowSoftInputMode') ?? '')?.[1];
  check(keyboardMode !== undefined && (Number(keyboardMode) & 0xf0) === 0x10, 'Android keyboard must use adjustResize.');
  check(!elements.some(node => node.kind === 'service' && name(node)?.includes('ExpoVideoPlaybackService')), 'Video playback service must not be present.');
}

function verifyApk() {
  const { values, positionals } = parseArgs({ options: { 'signing-env-file': { type: 'string' } }, allowPositionals: true });
  const signingEnvFile = resolve(values['signing-env-file'] || join(root, '.env'));
  const apk = resolve(positionals[0] || join(root, '.runtime/releases/Otherme-0.1.3.apk'));
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const tools = join(sdk, 'build-tools/36.0.0');
  const signature = execFileSync(join(process.env.JAVA_HOME, 'bin/java.exe'), ['-jar', join(tools, 'lib/apksigner.jar'), 'verify', '--verbose', '--print-certs', apk], { encoding: 'utf8' });
  const digest = /Signer #1 certificate SHA-256 digest: ([\da-f:]+)/i.exec(signature)?.[1].replaceAll(':', '').toUpperCase();
  check(digest === expected, 'APK is not signed with the approved Otherme release certificate.');
  check(/^Number of signers: 1\s*$/m.test(signature), 'Unexpected APK signers.');
  const badging = execFileSync(join(tools, 'aapt2.exe'), ['dump', 'badging', apk], { encoding: 'utf8' });
  const manifest = execFileSync(join(tools, 'aapt2.exe'), ['dump', 'xmltree', '--file', 'AndroidManifest.xml', apk], { encoding: 'utf8' });
  assertReleaseManifest(badging, manifest);
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
  console.info('APK signature, package/version, Contacts, disabled video background/PiP, keyboard and private-data checks passed.');
  console.info('Release SHA-256 certificate: '+expected.match(/../g).join(':'));
  console.info(scan.trim());
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { verifyApk(); }
  catch {
    // Child errors can include arguments and input. Do not echo them.
    console.error('APK verification failed. Do not distribute or install this artifact.');
    process.exitCode = 1;
  }
}
