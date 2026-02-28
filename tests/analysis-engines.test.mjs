/**
 * Unit tests for context-aware report generation and model-switch behavior.
 * Validates default contexts keep pluggable strategy/fundamental outputs stable.
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

  const enginesJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/engines.ts'), 'utf8').replace("from './contracts'", `from '${contractsUrl}'`),
    'engines.ts'
  );
  const enginesUrl = `data:text/javascript;base64,${Buffer.from(enginesJs).toString('base64')}`;

  const mockJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/mock-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`),
    'mock-providers.ts'
  );
  const mockUrl = `data:text/javascript;base64,${Buffer.from(mockJs).toString('base64')}`;

  const liveJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/providers/live-providers.ts'), 'utf8').replace("from '../contracts'", `from '${contractsUrl}'`),
    'live-providers.ts'
  );
  const liveUrl = `data:text/javascript;base64,${Buffer.from(liveJs).toString('base64')}`;

  const contextsJs = transpile(
    readFileSync(path.join(process.cwd(), 'src/lib/analysis/contexts.ts'), 'utf8')
      .replace("from './contracts'", `from '${contractsUrl}'`)
      .replace("from './engines'", `from '${enginesUrl}'`)
      .replace("from './providers/live-providers'", `from '${liveUrl}'`)
      .replace("from './providers/mock-providers'", `from '${mockUrl}'`),
    'contexts.ts'
  );
  const contextsUrl = `data:text/javascript;base64,${Buffer.from(contextsJs).toString('base64')}`;

  const storageJs = transpile(readFileSync(path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts'), 'utf8'), 'metadata-storage.ts');
  const storageUrl = `data:text/javascript;base64,${Buffer.from(storageJs).toString('base64')}`;

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

test('buildTickerReport includes section payloads in default mock context', async () => {
  const registry = await loadRegistry();
  const report = registry.buildTickerReport('AAPL', 190, { contextId: 'default_mock' });

  assert.equal(report.symbol, 'AAPL');
  assert.ok(report.targetConsensus.analysts.length >= 4);
  assert.ok(['bullish', 'neutral', 'bearish'].includes(report.sentiment.trend));
  assert.ok(report.fundamental.summary.length > 20);
  assert.ok(report.entryPlan.buyZone.includes('-'));
});

test('model switching returns distinct fundamental and entry outputs', async () => {
  const registry = await loadRegistry();
  const dcf = registry.buildTickerReport('MSFT', 300, { fundamentalModelId: 'dcf-core', entryModelId: 'swing-structure' });
  const quality = registry.buildTickerReport('MSFT', 300, { fundamentalModelId: 'quality-factors', entryModelId: 'momentum-breakout' });

  assert.notEqual(dcf.fundamental.summary, quality.fundamental.summary);
  assert.notEqual(dcf.entryPlan.buyZone, quality.entryPlan.buyZone);
});
