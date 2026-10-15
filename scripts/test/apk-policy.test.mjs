import test from 'node:test';
import assert from 'node:assert/strict';
import { assertReleaseManifest } from '../verify-apk.mjs';

const badging = `package: name='com.jstarstudios.otherme' versionCode='4' versionName='0.1.3'
application-label:'Otherme'
uses-permission: name='android.permission.INTERNET'
uses-permission: name='android.permission.RECORD_AUDIO'
uses-permission: name='android.permission.CAMERA'
uses-permission: name='android.permission.READ_CONTACTS'
`;
const manifest = `E: manifest (line=2)
  E: application (line=10)
    A: android:usesCleartextTraffic(0x010104ec)=(type 0x12)0xffffffff
    A: android:allowBackup(0x01010280)=(type 0x12)0x0
    E: activity (line=20)
      A: android:name(0x01010003)="com.jstarstudios.otherme.MainActivity" (Raw: "com.jstarstudios.otherme.MainActivity")
      A: android:windowSoftInputMode(0x0101022b)=(type 0x11)0x10
      A: android:supportsPictureInPicture(0x0101055d)=(type 0x12)0x0
      E: intent-filter (line=25)
        E: action (line=26)
          A: android:name(0x01010003)="android.intent.action.MAIN"
    E: activity (line=30)
      A: android:name(0x01010003)="expo.modules.video.FullscreenPlayerActivity"
      A: android:supportsPictureInPicture(0x0101055d)=(type 0x12)0x0
`;

test('release policy accepts the actual aapt element form and rejects the previous version or wrong keyboard mode', () => {
  assert.doesNotThrow(() => assertReleaseManifest(badging, manifest));
  assert.doesNotThrow(() => assertReleaseManifest(badging, manifest.replace('com.jstarstudios.otherme.MainActivity', '.MainActivity')));
  assert.throws(() => assertReleaseManifest(badging.replace("versionCode='4'", "versionCode='3'"), manifest), /release version/);
  assert.throws(() => assertReleaseManifest(badging, manifest.replace('(type 0x11)0x10', '(type 0x11)0x20')), /adjustResize/);
  assert.throws(() => assertReleaseManifest(badging+'application-debuggable\n', manifest), /debuggable/);
});
test('release Contacts is read-only and no foreground-service permission is allowed', () => {
  assert.throws(() => assertReleaseManifest(badging.replace("uses-permission: name='android.permission.READ_CONTACTS'", ''), manifest), /READ_CONTACTS/);
  for (const permission of ['WRITE_CONTACTS', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK', 'FOREGROUND_SERVICE_MICROPHONE'])
    assert.throws(() => assertReleaseManifest(badging+`uses-permission: name='android.permission.${permission}'\n`, manifest), /Contact writing|Foreground service/);
});
test('both required activities must explicitly disable PiP on their own elements', () => {
  const flag = '(type 0x12)0x0';
  const mainFlag = manifest.indexOf(flag, manifest.indexOf('windowSoftInputMode'));
  const fullFlag = manifest.lastIndexOf(flag);
  for (const index of [mainFlag, fullFlag])
    assert.throws(() => assertReleaseManifest(badging, manifest.slice(0,index)+'(type 0x12)0xffffffff'+manifest.slice(index+flag.length)), /Picture-in-picture/);
  assert.throws(() => assertReleaseManifest(badging, manifest.replace('FullscreenPlayerActivity', 'UnrelatedActivity')), /activities/);
  assert.throws(() => assertReleaseManifest(badging, manifest.replace(/\s*A: android:supportsPictureInPicture[^\n]+/g, '')), /Picture-in-picture/);
});
test('release refuses a merged ExpoVideoPlaybackService even with correct activity flags', () => {
  const service = '    E: service (line=40)\n      A: android:name(0x01010003)="expo.modules.video.playbackService.ExpoVideoPlaybackService"\n';
  assert.throws(() => assertReleaseManifest(badging, manifest+service), /playback service/);
});
