// Gradle invokes Metro through this process so backend/signing secrets are absent.
const { spawnSync } = require('node:child_process');
const env = { ...process.env, EXPO_NO_DOTENV: '1' };
for (const key of Object.keys(env)) {
  if (/^(OTHERME_SIGNING_|OPENROUTER_|OWNER_TOKEN)/.test(key)) delete env[key];
}
const child = spawnSync(process.execPath, process.argv.slice(2), { env, stdio: 'inherit' });
process.exit(child.status ?? 1);
