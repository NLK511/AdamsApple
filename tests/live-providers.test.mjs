/**
 * Unit tests for Yahoo-backed provider adapters.
 * Verifies price and news-signal normalization for the default_live context.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadProviders = async () => {
  const source = readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace(
    "from '../contracts'",
    "from 'data:text/javascript,export{}'"
  );

  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: 'live-providers.ts'
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

test('fetchYahooPrice parses quote endpoint', async () => {
  const providers = await loadProviders();
  const fetchMock = async () => new Response(JSON.stringify({ quoteResponse: { result: [{ regularMarketPrice: 203.55 }] } }));

  const price = await providers.fetchYahooPrice('AAPL', fetchMock, providers.defaultLiveProviderConfig);
  assert.equal(price, 203.55);
});

test('fetchYahooNewsSignals maps Yahoo news rows to normalized signals', async () => {
  const providers = await loadProviders();
  const fetchMock = async () =>
    new Response(
      JSON.stringify({
        news: [
          { title: 'AAPL beats revenue expectations', publisher: 'Financial Times' },
          { title: 'AAPL momentum discussion trends on X', publisher: 'Some Social Feed' }
        ]
      })
    );

  const signals = await providers.fetchYahooNewsSignals('AAPL', fetchMock, providers.defaultLiveProviderConfig);
  assert.equal(signals.length, 2);
  assert.equal(signals[0].source, 'Financial Times');
  assert.equal(signals[1].source, 'X');
});
