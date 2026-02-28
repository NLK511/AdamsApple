/**
 * Route-loader tests for ticker deep-dive page context and model behavior.
 * Checks symbol normalization, context fallback, and dashboard link contract.
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

const loadRouteModule = async () => {
  const contractsUrl = `data:text/javascript;base64,${Buffer.from('export {};').toString('base64')}`;
  const storageUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts'), 'utf8'), 'metadata-storage.ts')).toString('base64')}`;
  const enginesUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/engines.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`), 'engines.ts')).toString('base64')}`;
  const mockUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/mock-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'mock-providers.ts')).toString('base64')}`;
  const liveUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'live-providers.ts')).toString('base64')}`;
  const contextsUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/contexts.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`).replace("from './engines'", `from '${enginesUrl}'`).replace("from './providers/live-providers'", `from '${liveUrl}'`).replace("from './providers/mock-providers'", `from '${mockUrl}'`), 'contexts.ts')).toString('base64')}`;

  const registryUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/registry.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`).replace("from './contexts'", `from '${contextsUrl}'`).replace("from './engines'", `from '${enginesUrl}'`).replace("from './metadata-storage'", `from '${storageUrl}'`).replace("from './providers/mock-providers'", `from '${mockUrl}'`), 'registry.ts')).toString('base64')}`;

  const pageJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/routes/ticker/[symbol]/+page.ts'), 'utf8')
      .replace(/from '\$lib\/analysis\/registry'/g, `from '${registryUrl}'`)
      .replace(/from '\$lib\/analysis\/contexts'/g, `from '${contextsUrl}'`),
    '+page.ts'
  );

  return import(`data:text/javascript;base64,${Buffer.from(pageJs).toString('base64')}`);
};

test('ticker detail load normalizes symbol and applies selected context/engines', async () => {
  const pageModule = await loadRouteModule();
  const url = new URL('https://example.com/ticker/aapl?context=default_mock&entry=momentum-breakout&fundamental=quality-factors');

  const data = await pageModule.load({ params: { symbol: 'aapl' }, url, fetch: globalThis.fetch });

  assert.equal(data.symbol, 'AAPL');
  assert.equal(data.contextId, 'default_mock');
  assert.equal(data.report.entryPlan.model, 'Momentum Breakout');
  assert.equal(data.report.fundamental.model, 'Quality Factors');
  assert.ok(data.contexts.length >= 2);
});

test('ticker detail load falls back to default context for unknown id', async () => {
  const pageModule = await loadRouteModule();
  const url = new URL('https://example.com/ticker/msft?context=unknown');

  const data = await pageModule.load({ params: { symbol: 'msft' }, url, fetch: globalThis.fetch });

  assert.equal(data.contextId, 'default_mock');
});

test('dashboard ticker cells open detail route in new tab', async () => {
  const pageSvelte = readFileSync(path.join(process.cwd(), 'src/routes/+page.svelte'), 'utf8');
  assert.match(pageSvelte, /href=\{`\/ticker\/\$\{ticker\.symbol\}`\}/);
  assert.match(pageSvelte, /target="_blank"/);
  assert.match(pageSvelte, /rel="noopener noreferrer"/);
});
