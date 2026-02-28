/**
 * Tests for context-aware caching and provider selection behavior.
 * Covers refresh precedence and default_live/default_mock source wiring.
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

const loadRegistry = async () => {
  const contractsUrl = `data:text/javascript;base64,${Buffer.from('export {};').toString('base64')}`;

  const enginesUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/engines.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`), 'engines.ts')).toString('base64')}`;
  const mockUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/mock-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'mock-providers.ts')).toString('base64')}`;
  const liveUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'live-providers.ts')).toString('base64')}`;
  const contextsUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/contexts.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`).replace("from './engines'", `from '${enginesUrl}'`).replace("from './providers/live-providers'", `from '${liveUrl}'`).replace("from './providers/mock-providers'", `from '${mockUrl}'`), 'contexts.ts')).toString('base64')}`;
  const storageUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts'), 'utf8'), 'metadata-storage.ts')).toString('base64')}`;

  const registryJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/registry.ts'), 'utf8')
      .replace("from './contracts'", `from '${contractsUrl}'`)
      .replace("from './contexts'", `from '${contextsUrl}'`)
      .replace("from './engines'", `from '${enginesUrl}'`)
      .replace("from './metadata-storage'", `from '${storageUrl}'`)
      .replace("from './providers/mock-providers'", `from '${mockUrl}'`),
    'registry.ts'
  );

  return import(`data:text/javascript;base64,${Buffer.from(registryJs).toString('base64')}`);
};

test('specific refresh interval overrides global interval for one ticker metadata key', async () => {
  const registry = await loadRegistry();
  registry.metadataStorage.setGlobalRefreshInterval(60_000);
  registry.metadataStorage.setTickerRefreshInterval('MSFT', 'sentiment', 1000);

  registry.buildTickerReportCached('MSFT', 300, { now: 1000, contextId: 'default_mock' });
  registry.buildTickerReportCached('MSFT', 300, { now: 1500, contextId: 'default_mock' });
  assert.equal(registry.metadataStorage.getHistory('MSFT', 'sentiment').length, 1);

  registry.buildTickerReportCached('MSFT', 300, { now: 2100, contextId: 'default_mock' });
  assert.equal(registry.metadataStorage.getHistory('MSFT', 'sentiment').length, 2);
});

test('buildTickerReportWithContext uses yahoo providers in default_live', async () => {
  const registry = await loadRegistry();

  const fetchMock = async (url) => {
    const u = String(url);
    if (u.includes('/v7/finance/quote')) {
      return new Response(JSON.stringify({ quoteResponse: { result: [{ regularMarketPrice: 222.22 }] } }));
    }
    if (u.includes('/v1/finance/search')) {
      return new Response(JSON.stringify({ news: [{ title: 'AAPL upgrade after strong demand', publisher: 'Financial Times' }] }));
    }
    return new Response('{}', { status: 404 });
  };

  const { report, liveSources, context } = await registry.buildTickerReportWithContext(
    'AAPL',
    { now: 1000, contextId: 'default_live' },
    fetchMock
  );

  assert.equal(context.id, 'default_live');
  assert.equal(report.currentPrice, 222.22);
  assert.ok(liveSources.market.includes('yahoo-price'));
  assert.ok(liveSources.news.includes('yahoo-news'));
  assert.equal(registry.metadataStorage.getHistory('AAPL', 'sentiment').length, 1);
});
