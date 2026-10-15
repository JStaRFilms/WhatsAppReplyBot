const http = require('node:http');
const scope = process.env.TEST_PROFILE_SCOPE ? JSON.parse(process.env.TEST_PROFILE_SCOPE) : { profileId: 'original', accountId: 'whatsapp-owner', revision: 0 };
let registry;
const server = http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer synthetic-owner-token') { res.writeHead(401).end(); return; }
  res.setHeader('content-type', 'application/json');
  if (req.url.startsWith('/v1/profile-operations/') && registry) {
    res.end(JSON.stringify(registry.operation(decodeURIComponent(req.url.slice('/v1/profile-operations/'.length))))); return;
  }
  if (req.url !== '/v1/launcher') { res.writeHead(404).end(); return; }
  res.end(JSON.stringify({ service: 'otherme-backend', protocol: 2, accountId: scope.accountId, profileScope: scope,
    demo: false, whatsapp: 'disconnected', rootId: process.env.TEST_ROOT_ID, instanceId: process.env.TEST_INSTANCE_ID }));
});
async function boot() {
  if (process.env.TEST_RUNTIME) {
    const { tsImport } = await import('tsx/esm/api');
    const { ProfileRegistry } = await tsImport('../../services/backend/src/profiles.ts', require('node:url').pathToFileURL(__filename).href);
    registry = new ProfileRegistry(process.env.TEST_RUNTIME);
    if (process.env.TEST_OPERATION_ID) registry.complete(process.env.TEST_OPERATION_ID, scope);
  }
  server.listen(Number(process.env.TEST_PORT), '127.0.0.1');
}
void boot();
process.on('message', message => {
  if (message.type === 'otherme-stop' && !process.env.TEST_REFUSE_STOP || message.type === 'otherme-test-release') server.close(() => process.disconnect());
});
process.on('disconnect', () => server.close());
