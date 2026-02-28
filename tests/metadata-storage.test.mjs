import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadStorage = async () => {
  const sourcePath = path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts');
  const source = readFileSync(sourcePath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022
    },
    fileName: 'metadata-storage.ts'
  }).outputText;

  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  return import(dataUrl);
};

test('global interval applies when ticker-specific interval is not set', async () => {
  const { InMemoryTickerMetadataStorage } = await loadStorage();
  const storage = new InMemoryTickerMetadataStorage(5000);

  storage.getOrCompute('AAPL', 'sentiment', () => ({ score: 1 }), 0);
  assert.equal(storage.shouldRefresh('AAPL', 'sentiment', 4000), false);
  assert.equal(storage.shouldRefresh('AAPL', 'sentiment', 5000), true);
});

test('ticker-specific interval takes precedence over global', async () => {
  const { InMemoryTickerMetadataStorage } = await loadStorage();
  const storage = new InMemoryTickerMetadataStorage(60000);

  storage.setTickerRefreshInterval('AAPL', 'sentiment', 10000);
  storage.getOrCompute('AAPL', 'sentiment', () => ({ score: 1 }), 0);

  assert.equal(storage.shouldRefresh('AAPL', 'sentiment', 9000), false);
  assert.equal(storage.shouldRefresh('AAPL', 'sentiment', 10000), true);
});

test('history tracks evolution of cached metadata values', async () => {
  const { InMemoryTickerMetadataStorage } = await loadStorage();
  const storage = new InMemoryTickerMetadataStorage(1000);

  storage.upsert('MSFT', 'target-consensus', { target: 150 }, 1000);
  storage.upsert('MSFT', 'target-consensus', { target: 155 }, 2000);

  const history = storage.getHistory('MSFT', 'target-consensus');
  assert.equal(history.length, 2);
  assert.equal(history[0].version, 1);
  assert.equal(history[1].version, 2);
  assert.equal(history[0].value.target, 150);
  assert.equal(history[1].value.target, 155);
});

test('getOrCompute reuses value until refresh interval elapses', async () => {
  const { InMemoryTickerMetadataStorage } = await loadStorage();
  const storage = new InMemoryTickerMetadataStorage(2000);

  let count = 0;
  const compute = () => ({ v: ++count });

  const first = storage.getOrCompute('NVDA', 'entry:swing', compute, 1000);
  const second = storage.getOrCompute('NVDA', 'entry:swing', compute, 2500);
  const third = storage.getOrCompute('NVDA', 'entry:swing', compute, 3001);

  assert.equal(first.value.v, 1);
  assert.equal(second.value.v, 1);
  assert.equal(third.value.v, 2);
});
