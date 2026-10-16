import { lstatSync, readFileSync, realpathSync } from 'node:fs';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import type { FastifyInstance } from 'fastify';

const types: Record<string, string> = {
  '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
export const isDesktopRequest = (url: string) => !/^\/v1(?:\/|\?|$)/.test(url);
const inside = (root: string, file: string) => {
  const path = relative(root, file);
  return path !== '..' && !path.startsWith('..'+(process.platform === 'win32' ? '\\' : '/')) && !isAbsolute(path);
};
function publicFile(directory: string, path: string): string | undefined {
  try {
    if (lstatSync(directory).isSymbolicLink()) return;
    const root = realpathSync(directory);
    let file = root;
    for (const segment of path.split('/')) {
      file = join(file, segment);
      if (lstatSync(file).isSymbolicLink()) return;
    }
    if (!inside(root, realpathSync(file)) || !lstatSync(file).isFile()) return;
    return file;
  } catch { return; }
}
export function desktopAvailable(directory: string): boolean {
  return !!publicFile(resolve(directory), 'index.html');
}
export function registerDesktop(app: FastifyInstance, directory: string) {
  const root = resolve(directory);
  app.get('/*', async (request, reply) => {
    const missing = () => reply.code(404).send({ error: 'public_asset_not_found' });
    if (!isDesktopRequest(request.raw.url ?? request.url)) return missing();
    let path: string;
    try { path = decodeURIComponent((request.raw.url ?? request.url).split('?')[0] ?? ''); }
    catch { return missing(); }
    // Expo exports dependency fonts/images into this public directory. Only its
    // .pnpm segment is exempt from the hidden-path rule, never source bundles.
    const exportedAsset = /^\/assets\/__node_modules\/\.pnpm\//.test(path)
      && /\.(?:png|jpg|jpeg|webp|gif|svg|ico|ttf|otf|woff|woff2)$/.test(path);
    if (!path.startsWith('/') || /[\\%\u0000-\u001f\u007f]/.test(path)
      || path.split('/').some((s, i) => s.startsWith('.') && !(exportedAsset && i === 3 && s === '.pnpm'))) return missing();
    const spa = /^\/(?:index|settings|review|assistant)?\/?$/.test(path) || /^\/conversation\/[^/]+\/?$/.test(path);
    const extension = extname(path);
    const asset = path === '/favicon.ico' || /^\/(?:assets|_expo\/static)\//.test(path);
    if (!spa && (!asset || !types[extension])) return missing();
    const file = publicFile(root, spa ? 'index.html' : path.slice(1));
    if (!file) return missing();
    return reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer').type(spa ? 'text/html' : types[extension] ?? 'application/octet-stream').send(readFileSync(file));
  });
}
