import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const loadContextBuilder = async () => {
  const sourcePath = path.resolve('src/lib/analysis/context-builder.ts');
  const source = await readFile(sourcePath, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  });

  const encoded = Buffer.from(outputText, 'utf8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
};

const fakeNewsProvider = { id: 'news', name: 'News', fetchSignals: async () => [] };
const fakeSocialProvider = { id: 'social', name: 'Social', fetchSignals: async () => [] };
const fakePriceProvider = { id: 'price', name: 'Price', fetchPrice: async () => null };
const fakeEngine = { id: 'engine', name: 'Engine', score: () => 0 };

const createValidInput = () => ({
  id: 'ctx',
  name: 'Context',
  refreshIntervalMs: 5000,
  newsProvider: fakeNewsProvider,
  socialNetworkProvider: fakeSocialProvider,
  tickerPriceProvider: fakePriceProvider,
  sentimentNewsEngine: fakeEngine,
  socialNetworkEngine: fakeEngine,
  fundamentalModels: [],
  entryPointModels: []
});

test('createAnalysisContext throws when provider or engine wiring is missing', async () => {
  const { createAnalysisContext } = await loadContextBuilder();

  assert.throws(
    () => createAnalysisContext({ ...createValidInput(), newsProvider: undefined }),
    /missing news provider/
  );

  assert.throws(
    () => createAnalysisContext({ ...createValidInput(), sentimentNewsEngine: undefined }),
    /missing news sentiment engine/
  );
});

test('validateUniqueAnalysisContextIds throws on duplicate ids', async () => {
  const { validateUniqueAnalysisContextIds, createAnalysisContext } = await loadContextBuilder();

  const first = createAnalysisContext({ ...createValidInput(), id: 'dup' });
  const second = createAnalysisContext({ ...createValidInput(), id: 'dup', name: 'Another' });

  assert.throws(() => validateUniqueAnalysisContextIds([first, second]), /Duplicate analysis context id/);
});
