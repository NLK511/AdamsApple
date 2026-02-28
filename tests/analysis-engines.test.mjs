/**
 * Unit tests for analysis engine outputs and model-switch behavior.
 * Validates report shape consistency across strategy variants.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadTsModule = async (relativePath) => {
  const sourcePath = path.join(process.cwd(), relativePath);
  let source = readFileSync(sourcePath, 'utf8');

  if (relativePath.endsWith('registry.ts')) {
    const storageSource = readFileSync(path.join(process.cwd(), 'src/lib/analysis/metadata-storage.ts'), 'utf8');
    const storageJs = ts.transpileModule(storageSource, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ES2022,
        moduleResolution: ts.ModuleResolutionKind.Bundler
      },
      fileName: 'metadata-storage.ts'
    }).outputText;
    const storageUrl = `data:text/javascript;base64,${Buffer.from(storageJs).toString('base64')}`;

    source = source
      .replace("from './metadata-storage'", `from '${storageUrl}'`)
      .replace("from './contracts'", "from 'data:text/javascript,export{}'")
      .replace("from './providers/live-providers'", "from 'data:text/javascript,export const fetchLiveSnapshot=async()=>({symbol:\"AAPL\",currentPrice:null,targetConsensus:null,sentiment:null,sources:{market:[],news:[]}});'");
  }

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ES2022,
      moduleResolution: ts.ModuleResolutionKind.Bundler
    },
    fileName: relativePath
  }).outputText;

  const dataUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
  return import(dataUrl);
};

test('buildTickerReport includes all requested section payloads', async () => {
  const registry = await loadTsModule('src/lib/analysis/registry.ts');
  const report = registry.buildTickerReport('AAPL', 190);

  assert.equal(report.symbol, 'AAPL');
  assert.equal(typeof report.targetConsensus.consensusTarget, 'number');
  assert.ok(report.targetConsensus.analysts.length >= 4);
  assert.ok(['bullish', 'neutral', 'bearish'].includes(report.sentiment.trend));
  assert.ok(report.fundamental.summary.length > 20);
  assert.ok(report.entryPlan.buyZone.includes('-'));
  assert.ok(report.comparisons.fundamentals.length >= 2);
  assert.ok(report.comparisons.entries.length >= 2);
});

test('fundamental model switch returns distinct summaries for comparison', async () => {
  const registry = await loadTsModule('src/lib/analysis/registry.ts');
  const dcf = registry.buildTickerReport('MSFT', 300, { fundamentalModelId: 'dcf-core' });
  const quality = registry.buildTickerReport('MSFT', 300, { fundamentalModelId: 'quality-factors' });

  assert.equal(dcf.fundamental.model, 'DCF Core');
  assert.equal(quality.fundamental.model, 'Quality Factors');
  assert.notEqual(dcf.fundamental.summary, quality.fundamental.summary);
  assert.notEqual(dcf.fundamental.valuationNote, quality.fundamental.valuationNote);
});

test('entry engine switch returns distinct plan outputs for strategy A/B testing', async () => {
  const registry = await loadTsModule('src/lib/analysis/registry.ts');
  const swing = registry.buildTickerReport('NVDA', 420, { entryModelId: 'swing-structure' });
  const breakout = registry.buildTickerReport('NVDA', 420, { entryModelId: 'momentum-breakout' });

  assert.equal(swing.entryPlan.model, 'Swing Structure');
  assert.equal(breakout.entryPlan.model, 'Momentum Breakout');
  assert.notEqual(swing.entryPlan.buyZone, breakout.entryPlan.buyZone);
  assert.notEqual(swing.entryPlan.stopLoss, breakout.entryPlan.stopLoss);
});

test('sentiment sources include both required channels', async () => {
  const registry = await loadTsModule('src/lib/analysis/registry.ts');
  const sentiment = registry.buildSentimentDigest('TSLA');
  const sources = sentiment.sources.map((item) => item.source);

  assert.ok(sources.includes('X'));
  assert.ok(sources.includes('Financial Times'));
});
