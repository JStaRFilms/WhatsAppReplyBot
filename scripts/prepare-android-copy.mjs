import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = fileURLToPath(new URL('../', import.meta.url));
const { values } = parseArgs({ options: { 'build-root': { type: 'string' } } });
if (!values['build-root']) throw new Error('Specify an approved, nonexistent --build-root directory.');
const destination = resolve(values['build-root']);
// Exclusive creation prevents overwriting a checkout or unrelated local files.
mkdirSync(destination);
// pnpm's default 60-character peer directories still exceed Ninja's source limit
// for generated datetimepicker JNI, even under a short physical project path.
writeFileSync(join(destination, '.npmrc'), 'virtual-store-dir-max-length=32\n', { flag: 'wx' });
const files = [
  'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', 'tsconfig.base.json',
  'apps/mobile/package.json', 'apps/mobile/app.json', 'apps/mobile/tsconfig.json',
  'packages/core/package.json', 'packages/core/tsconfig.json',
  'scripts/build-android.mjs', 'scripts/verify-apk.mjs', 'scripts/mobile-node.cjs',
];
const sourceExtensions = new Set(['.ts', '.tsx', '.cjs', '.png', '.gif', '.webp']);
function collect(relative) {
  for (const entry of readdirSync(join(root, relative), { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const path = join(relative, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) files.push(path);
    // Symbolic links are never followed or copied.
  }
}
for (const directory of [
  'apps/mobile/app', 'apps/mobile/assets', 'apps/mobile/components',
  'apps/mobile/lib', 'apps/mobile/plugins', 'apps/mobile/types', 'packages/core/src',
]) collect(directory);
for (const relative of files) {
  const target = join(destination, relative);
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(join(root, relative), target);
}
console.info(`Copied ${files.length} allowlisted build inputs to ${destination}. Install fresh dependencies there.`);
console.info('Build with node scripts/build-android.mjs --signing-env-file <original-project>/.env');
