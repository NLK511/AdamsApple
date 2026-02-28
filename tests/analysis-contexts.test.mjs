/**
 * Unit tests for analysis context catalog.
 * Ensures default contexts expose required provider and engine capabilities.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const transpile = (source, fileName) =>
  ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, moduleResolution: ts.ModuleResolutionKind.Bundler },
    fileName
  }).outputText;

const loadContexts = async () => {
  const contractsUrl = `data:text/javascript;base64,${Buffer.from('export {};').toString('base64')}`;
  const enginesUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/engines.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`), 'engines.ts')).toString('base64')}`;
  const mockUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/mock-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'mock-providers.ts')).toString('base64')}`;
  const liveUrl = `data:text/javascript;base64,${Buffer.from(transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`), 'live-providers.ts')).toString('base64')}`;

  const contextsJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/contexts.ts'), 'utf8')
      .replace("from './contracts'", `from '${contractsUrl}'`)
      .replace("from './engines'", `from '${enginesUrl}'`)
      .replace("from './providers/live-providers'", `from '${liveUrl}'`)
      .replace("from './providers/mock-providers'", `from '${mockUrl}'`),
    'contexts.ts'
  );

  return import(`data:text/javascript;base64,${Buffer.from(contextsJs).toString('base64')}`);
};

test('analysisContexts expose default_mock and default_live presets', async () => {
  const contexts = await loadContexts();
  const ids = contexts.analysisContexts.map((ctx) => ctx.id);
  assert.deepEqual(ids, ['default_mock', 'default_live']);

  const live = contexts.getAnalysisContext('default_live');
  assert.equal(live.newsProvider.id, 'yahoo-news');
  assert.equal(live.tickerPriceProvider.id, 'yahoo-price');
  assert.ok(live.entryPointModels.length >= 2);
});
