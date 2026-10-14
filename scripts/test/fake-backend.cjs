const http = require('node:http');
const server = http.createServer((req, res) => {
  if (req.url !== '/v1/launcher' || req.headers.authorization !== 'Bearer synthetic-owner-token') {
    res.writeHead(401).end(); return;
  }
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ service: 'otherme-backend', protocol: 1, accountId: 'whatsapp-owner', demo: false, whatsapp: 'disconnected', rootId: process.env.TEST_ROOT_ID, instanceId: process.env.TEST_INSTANCE_ID }));
});
server.listen(Number(process.env.TEST_PORT), '127.0.0.1');
process.on('message', message => {
  if (message.type === 'otherme-stop') server.close(() => process.disconnect());
});
process.on('disconnect', () => server.close());
