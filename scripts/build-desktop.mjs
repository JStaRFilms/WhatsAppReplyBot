import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function buildDesktop({ run = spawnSync, environment = process.env } = {}) {
  const mobile = join(root, 'apps/mobile');
  const require = createRequire(join(mobile, 'package.json'));
  const expo = join(dirname(require.resolve('expo/package.json')), 'bin/cli');
  const env = { ...environment, EXPO_PUBLIC_DESKTOP: '1', CI: '1', NODE_ENV: 'production' };
  delete env.EXPO_PUBLIC_BACKEND_URL;
  const child = run(process.execPath, [join(root, 'scripts/mobile-node.cjs'), expo,
    'export', '--platform', 'web', '--output-dir', 'dist'], { cwd: mobile, env, stdio: 'inherit', windowsHide: true });
  if (child.error || child.status !== 0) throw new Error('Desktop export failed. No dependencies were installed.');
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { buildDesktop(); }
  catch { console.error('Desktop export failed. Check the installed local build tools and output above.'); process.exitCode = 1; }
}
