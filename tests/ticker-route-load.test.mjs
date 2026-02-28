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
  const registrySource = readFileSync(path.join(process.cwd(), 'src/lib/analysis/registry.ts'), 'utf8');
  const registryJs = transpile(registrySource, 'registry.ts');
  const registryUrl = `data:text/javascript;base64,${Buffer.from(registryJs).toString('base64')}`;

  let pageSource = readFileSync(path.join(process.cwd(), 'src/routes/ticker/[symbol]/+page.ts'), 'utf8');
  pageSource = pageSource.replace(/from '\$lib\/analysis\/registry'/g, `from '${registryUrl}'`);
  const pageJs = transpile(pageSource, '+page.ts');
  const pageUrl = `data:text/javascript;base64,${Buffer.from(pageJs).toString('base64')}`;

  return import(pageUrl);
};

test('ticker detail load normalizes symbol and applies selected engines', async () => {
  const pageModule = await loadRouteModule();
  const url = new URL('https://example.com/ticker/aapl?entry=momentum-breakout&fundamental=quality-factors');

  const data = pageModule.load({ params: { symbol: 'aapl' }, url });

  assert.equal(data.symbol, 'AAPL');
  assert.equal(data.report.entryPlan.model, 'Momentum Breakout');
  assert.equal(data.report.fundamental.model, 'Quality Factors');
  assert.ok(data.entryModels.length >= 2);
  assert.ok(data.fundamentalModels.length >= 2);
});

test('ticker detail load falls back to default engines for unknown ids', async () => {
  const pageModule = await loadRouteModule();
  const url = new URL('https://example.com/ticker/msft?entry=unknown&fundamental=none');

  const data = pageModule.load({ params: { symbol: 'msft' }, url });

  assert.equal(data.report.entryPlan.model, 'Swing Structure');
  assert.equal(data.report.fundamental.model, 'DCF Core');
});

test('dashboard ticker cells open detail route in new tab', async () => {
  const pageSvelte = readFileSync(path.join(process.cwd(), 'src/routes/+page.svelte'), 'utf8');
  assert.match(pageSvelte, /href=\{`\/ticker\/\$\{ticker\.symbol\}`\}/);
  assert.match(pageSvelte, /target="_blank"/);
  assert.match(pageSvelte, /rel="noopener noreferrer"/);
});
