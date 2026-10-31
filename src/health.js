const http = require('http');
const logger = require('./logger');

// Starts a tiny HTTP server exposing GET /health, reflecting the Discord
// gateway connection state rather than just "the process is running" -
// returns 503 if the client has disconnected or hasn't logged in yet.
function startHealthServer(client, port = process.env.HEALTH_PORT || 8080) {
  const server = http.createServer((req, res) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.url !== '/health') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ error: 'not found' }));
      return;
    }

    const ready = client.isReady();
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ status: ready ? 'ok' : 'unavailable' }));
  });

  server.listen(port, () => {
    logger.info(`Health check endpoint listening on port ${port}`);
  });

  server.on('error', (err) => logger.error('Health server error', err));

  return server;
}

module.exports = { startHealthServer };
