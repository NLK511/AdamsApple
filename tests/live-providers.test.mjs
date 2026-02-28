/**
 * Unit tests for live provider adapters.
 * Verifies parsing/mapping of market, consensus, and RSS sentiment inputs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadProviders = async () => {
  const source = readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8')
    .replace("from '../contracts'", "from 'data:text/javascript,export{}'");

  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: 'live-providers.ts'
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

test('fetchStooqPrice parses CSV close value', async () => {
  const providers = await loadProviders();
  const fetchMock = async () =>
    new Response('Symbol,Date,Time,Open,High,Low,Close,Volume\nAAPL.US,2026-01-01,22:00:00,200,205,199,203.55,1000');

  const price = await providers.fetchStooqPrice('AAPL', fetchMock, providers.defaultLiveProviderConfig);
  assert.equal(price, 203.55);
});

test('fetchYahooTargetConsensus maps target and analyst rows', async () => {
  const providers = await loadProviders();
  const payload = {
    quoteSummary: {
      result: [
        {
          financialData: { targetMeanPrice: { raw: 150 } },
          recommendationTrend: { trend: [{ strongBuy: 4, hold: 2, sell: 1 }] }
        }
      ]
    }
  };
  const fetchMock = async () => new Response(JSON.stringify(payload));

  const consensus = await providers.fetchYahooTargetConsensus('MSFT', 120, fetchMock, providers.defaultLiveProviderConfig);
  assert.equal(consensus.consensusTarget, 150);
  assert.equal(consensus.analysts.length, 3);
  assert.equal(consensus.upsidePercent, 25);
});

test('fetchLiveSentiment builds digest from FT and X rss titles', async () => {
  const providers = await loadProviders();
  const rss = (titles) => `<rss><channel>${titles.map((t) => `<title>${t}</title>`).join('')}</channel></rss>`;
  const fetchMock = async (url) => {
    if (String(url).includes('ft.com')) return new Response(rss(['AAPL growth beats estimates']));
    return new Response(rss(['AAPL upgraded after surge']));
  };

  const sentiment = await providers.fetchLiveSentiment('AAPL', fetchMock, providers.defaultLiveProviderConfig);
  assert.ok(sentiment);
  assert.equal(sentiment.sources[0].source, 'X');
  assert.equal(sentiment.sources[1].source, 'Financial Times');
  assert.ok(['bullish', 'neutral', 'bearish'].includes(sentiment.trend));
});
