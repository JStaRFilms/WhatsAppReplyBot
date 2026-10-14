import { randomBytes, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, appendFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const envFile=join(root,'.env');
const directory=join(root,'.runtime','signing');
const keystore=join(directory,'otherme-release.p12');
const alias='otherme';
try {
  const original=existsSync(envFile) ? await readFile(envFile,'utf8') : '';
  const field=/^OTHERME_SIGNING_PASSWORD=(\S+)\s*$/m.exec(original);
  if(!field && /^OTHERME_SIGNING_PASSWORD=/m.test(original))throw new Error('Signing password is empty or has unsupported syntax. No key changed.');
  if(existsSync(keystore) && !field)throw new Error('Existing release key has no configured password. Refusing to replace it.');
  let password=field?.[1];
  if(!password){
    password=randomBytes(32).toString('hex');
    await appendFile(envFile,'\n# Private Otherme Android release signing. Back up this file with the keystore.\nOTHERME_SIGNING_PASSWORD='+password+'\nOTHERME_SIGNING_STORE_FILE=.runtime/signing/otherme-release.p12\nOTHERME_SIGNING_KEY_ALIAS='+alias+'\n',{flush:true});
  }
  await mkdir(directory,{recursive:true});
  const keytool=process.env.JAVA_HOME ? join(process.env.JAVA_HOME,'bin','keytool.exe') : 'keytool';
  const options={env:{...process.env,OTHERME_SIGNING_PASSWORD:password},stdio:['ignore','pipe','pipe']};
  if(!existsSync(keystore))execFileSync(keytool,['-genkeypair','-alias',alias,'-keyalg','RSA','-keysize','4096','-validity','10000',
    '-storetype','PKCS12','-keystore',keystore,'-dname','CN=JStar Studios,OU=Otherme,O=JStar Studios,DC=jstarstudios,DC=com',
    '-storepass:env','OTHERME_SIGNING_PASSWORD','-keypass:env','OTHERME_SIGNING_PASSWORD','-noprompt'],options);
  const certificate=execFileSync(keytool,['-exportcert','-alias',alias,'-keystore',keystore,'-storepass:env','OTHERME_SIGNING_PASSWORD'],options);
  const fingerprint=createHash('sha256').update(certificate).digest('hex').toUpperCase().match(/../g).join(':');
  await writeFile(join(directory,'README.txt'),'Otherme Android release signing\nPublisher: JStar Studios, https://jstarstudios.com\nKeystore: .runtime/signing/otherme-release.p12\nAlias: otherme\nPassword: OTHERME_SIGNING_PASSWORD in the project .env\nCertificate SHA-256: '+fingerprint+'\n\nKeep the SAME key and password for future updates. Back up both the keystore and .env in a private owner-controlled location. Never commit, upload or share them. A password hash cannot unlock this key. This is an Android release identity, not a website certificate or Windows Authenticode certificate.\n');
  console.log(JSON.stringify({keystore:'.runtime/signing/otherme-release.p12',passwordLocation:'.env OTHERME_SIGNING_PASSWORD',backupInstructions:'.runtime/signing/README.txt',certificateSha256:fingerprint}));
}catch(error){
  // Never print child-process command/options or credential-bearing environment.
  console.error(error instanceof Error && !('stdout' in error) ? error.message : 'Signing key operation failed. Existing key was not replaced.');
  process.exitCode=1;
}
