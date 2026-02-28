import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadRegistryWithDeps = async () => {
  const storageSource = readFileSync(path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts'), 'utf8');
  const storageJs = ts.transpileModule(storageSource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: 'metadata-storage.ts'
  }).outputText;
  const storageUrl = `data:text/javascript;base64,${Buffer.from(storageJs).toString('base64')}`;

  const registrySourceRaw = readFileSync(path.join(process.cwd(), 'src/lib/analysis/registry.ts'), 'utf8');
  const registrySource = registrySourceRaw
    .replace("from './metadata-storage'", `from '${storageUrl}'`)
    .replace("from './contracts'", "from 'data:text/javascript,export{}'");

  const registryJs = ts.transpileModule(registrySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: 'registry.ts'
  }).outputText;
  const registryUrl = `data:text/javascript;base64,${Buffer.from(registryJs).toString('base64')}`;
  return import(registryUrl);
};

test('buildTickerReportCached stores inferred metadata and keeps history', async () => {
  const registry = await loadRegistryWithDeps();

  registry.metadataStorage.setGlobalRefreshInterval(60_000);

  const first = registry.buildTickerReportCached('AAPL', 180, { now: 1000 });
  const second = registry.buildTickerReportCached('AAPL', 190, { now: 2000 });

  assert.equal(first.targetConsensus.consensusTarget, second.targetConsensus.consensusTarget);

  const history = registry.metadataStorage.getHistory('AAPL', 'target-consensus');
  assert.equal(history.length, 1, 'still one snapshot because interval did not elapse');

  registry.buildTickerReportCached('AAPL', 200, { now: 70_000 });
  const refreshedHistory = registry.metadataStorage.getHistory('AAPL', 'target-consensus');
  assert.equal(refreshedHistory.length, 2, 'second snapshot written after interval elapsed');
});

test('specific refresh interval overrides global interval for one ticker metadata key', async () => {
  const registry = await loadRegistryWithDeps();

  registry.metadataStorage.setGlobalRefreshInterval(60_000);
  registry.metadataStorage.setTickerRefreshInterval('MSFT', 'sentiment', 1000);

  registry.buildTickerReportCached('MSFT', 300, { now: 1000 });
  registry.buildTickerReportCached('MSFT', 300, { now: 1500 });
  assert.equal(registry.metadataStorage.getHistory('MSFT', 'sentiment').length, 1);

  registry.buildTickerReportCached('MSFT', 300, { now: 2100 });
  assert.equal(registry.metadataStorage.getHistory('MSFT', 'sentiment').length, 2);
});
