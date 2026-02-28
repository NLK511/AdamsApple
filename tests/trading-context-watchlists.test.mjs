/**
 * Unit tests for context-driven watchlist seeding.
 * Verifies default/add ticker pricing and metadata come from active analysis context providers.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const transpile = (source, fileName) =>
  ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName
  }).outputText;

const loadTrading = async () => {
  const contractsUrl = `data:text/javascript;base64,${Buffer.from('export {};').toString('base64')}`;
  const enginesUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/engines.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`), 'engines.ts')).toString('base64')}`;
  const mockUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/mock-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'mock-providers.ts')).toString('base64')}`;
  const liveUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'live-providers.ts')).toString('base64')}`;
  const contextsUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/contexts.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`).replace("from './engines'", `from '${enginesUrl}'`).replace("from './providers/live-providers'", `from '${liveUrl}'`).replace("from './providers/mock-providers'", `from '${mockUrl}'`), 'contexts.ts')).toString('base64')}`;

  const tradingJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/trading.ts'), 'utf8')
      .replace("from './analysis/contexts'", `from '${contextsUrl}'`)
      .replace("from './analysis/providers/mock-providers'", `from '${mockUrl}'`),
    'trading.ts'
  );

  return import(`data:text/javascript;base64,${Buffer.from(tradingJs).toString('base64')}`);
};

test('defaultWatchlists use default_mock provider-derived prices and keep seeded symbols', async () => {
  const trading = await loadTrading();
  const watchlists = await trading.defaultWatchlists('default_mock', globalThis.fetch);

  assert.deepEqual(watchlists.map((w) => w.name), ['Core Holdings', 'Growth Radar']);
  assert.deepEqual(watchlists[0].tickers.map((ticker) => ticker.symbol), ['AAPL', 'MSFT', 'NVDA']);
  assert.deepEqual(watchlists[1].tickers.map((ticker) => ticker.symbol), ['TSLA', 'SHOP', 'AMD']);
  assert.ok(watchlists.every((w) => w.tickers.every((ticker) => ticker.currentPrice > 0)));
  assert.ok(watchlists.every((w) => w.tickers.every((ticker) => (ticker.providerWarnings ?? []).length === 0)));
});

test('defaultWatchlists use active live context providers for price and changes metadata', async () => {
  const trading = await loadTrading();

  const fetchMock = async (url) => {
    const target = new URL(String(url), 'http://local');
    if (target.pathname.includes('/api/providers/yahoo/quote')) {
      const symbol = target.searchParams.get('symbols');
      const mapping = { AAPL: 201.1, MSFT: 301.2, NVDA: 901.3, TSLA: 251.4, SHOP: 81.5, AMD: 121.6 };
      return new Response(JSON.stringify({ quoteResponse: { result: [{ regularMarketPrice: mapping[symbol] ?? 99.9 }] } }));
    }

    return new Response(
      JSON.stringify({
        news: [{ title: 'Strong growth upgrade momentum', publisher: 'Financial Times' }]
      })
    );
  };

  const watchlists = await trading.defaultWatchlists('default_live', fetchMock);
  const allTickers = watchlists.flatMap((w) => w.tickers);

  assert.equal(allTickers.find((ticker) => ticker.symbol === 'AAPL').currentPrice, 201.1);
  assert.notEqual(allTickers.find((ticker) => ticker.symbol === 'AAPL').changes.daily, 0);
});

test('addTicker uses currently active context for new ticker values', async () => {
  const trading = await loadTrading();

  const baseWatchlist = {
    id: 'wl',
    name: 'Test',
    tickers: []
  };

  const fetchMock = async (url) => {
    const target = new URL(String(url), 'http://local');
    if (target.pathname.includes('/api/providers/yahoo/quote')) {
      return new Response(JSON.stringify({ quoteResponse: { result: [{ regularMarketPrice: 456.78 }] } }));
    }
    return new Response(JSON.stringify({ news: [{ title: 'Weak demand miss', publisher: 'Social Feed' }] }));
  };

  const updated = await trading.addTicker(baseWatchlist, 'crm', 'default_live', fetchMock);
  assert.equal(updated.tickers.length, 1);
  assert.equal(updated.tickers[0].symbol, 'CRM');
  assert.equal(updated.tickers[0].currentPrice, 456.78);
});


test('live context surfaces provider warnings instead of substituting mock price', async () => {
  const trading = await loadTrading();

  const failingFetch = async () => new Response('{}', { status: 503 });
  const watchlists = await trading.defaultWatchlists('default_live', failingFetch);
  const sample = watchlists[0].tickers[0];

  assert.equal(sample.currentPrice, 0);
  assert.ok(sample.providerWarnings.some((warning) => warning.includes('Price unavailable')));
  assert.ok(sample.providerWarnings.some((warning) => warning.includes('No signals returned')));
});
