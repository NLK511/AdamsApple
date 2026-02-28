/**
 * Lightweight local metadata storage server for development experiments.
 * Exposes simple health/cache endpoints for interval and cache inspection.
 */
import { createServer } from 'node:http';

const store = new Map();
const globalState = { refreshMs: 15 * 60 * 1000 };

const json = (res, status, payload) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload, null, 2));
};

const ensureTicker = (symbol) => {
  const key = symbol.toUpperCase();
  if (!store.has(key)) {
    store.set(key, { intervals: {}, latest: {}, history: {} });
  }
  return store.get(key);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/cache') {
    return json(res, 200, {
      globalRefreshMs: globalState.refreshMs,
      tickers: Object.fromEntries(store.entries())
    });
  }

  if (req.method === 'POST' && url.pathname === '/cache/global-interval') {
    const body = JSON.parse(await new Response(req).text());
    const ms = Number(body.refreshMs);
    if (!Number.isFinite(ms) || ms < 1000) return json(res, 400, { error: 'refreshMs must be >= 1000' });
    globalState.refreshMs = ms;
    return json(res, 200, { ok: true, refreshMs: ms });
  }

  if (parts[0] === 'cache' && parts[1]) {
    const symbol = parts[1];
    const ticker = ensureTicker(symbol);

    if (req.method === 'GET' && parts.length === 2) {
      return json(res, 200, ticker);
    }

    if (req.method === 'POST' && parts[2] === 'interval') {
      const body = JSON.parse(await new Response(req).text());
      const ms = Number(body.refreshMs);
      const key = String(body.key ?? '').trim();
      if (!key || !Number.isFinite(ms) || ms < 1000) {
        return json(res, 400, { error: 'key and refreshMs >= 1000 are required' });
      }
      ticker.intervals[key] = ms;
      return json(res, 200, { ok: true, symbol: symbol.toUpperCase(), key, refreshMs: ms });
    }
  }

  return json(res, 404, { error: 'not found' });
});

const port = Number(process.env.STORAGE_PORT ?? '7373');
server.listen(port, '0.0.0.0', () => {
  console.log(`[storage-dev] listening on http://0.0.0.0:${port}`);
  console.log('[storage-dev] GET /health');
  console.log('[storage-dev] GET /cache');
  console.log('[storage-dev] POST /cache/global-interval {"refreshMs":300000}');
  console.log('[storage-dev] POST /cache/:symbol/interval {"key":"sentiment","refreshMs":3600000}');
});
