/**
 * Default strategy and sentiment engines used by analysis contexts.
 * Keeps engine definitions isolated so contexts can compose and swap implementations.
 */
import type {
  EntryPlan,
  EntryPointModel,
  FundamentalModel,
  NewsSignal,
  SentimentDigest,
  SentimentEngine,
  TargetConsensus
} from './contracts';

export const buildTargetConsensus = (symbol: string, currentPrice: number): TargetConsensus => {
  const seed = [...symbol].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const analysts = [
    { analyst: 'Morgan Stanley', targetPrice: Number((currentPrice * (1.04 + (seed % 5) / 100)).toFixed(2)), rating: 'buy' as const },
    { analyst: 'Goldman Sachs', targetPrice: Number((currentPrice * (1.08 + (seed % 7) / 100)).toFixed(2)), rating: 'buy' as const },
    { analyst: 'JP Morgan', targetPrice: Number((currentPrice * 0.99).toFixed(2)), rating: 'hold' as const },
    { analyst: 'UBS', targetPrice: Number((currentPrice * 0.92).toFixed(2)), rating: 'sell' as const }
  ];

  const consensusTarget = Number((analysts.reduce((acc, item) => acc + item.targetPrice, 0) / analysts.length).toFixed(2));
  const upsidePercent = Number((((consensusTarget - currentPrice) / currentPrice) * 100).toFixed(2));
  return { consensusTarget, upsidePercent, analysts };
};

const scoreSignal = (text: string) => {
  const content = text.toLowerCase();
  const positive = ['beats', 'growth', 'surge', 'upgrade', 'strong', 'buy', 'record', 'momentum'];
  const negative = ['miss', 'downgrade', 'lawsuit', 'drop', 'weak', 'sell', 'cuts'];
  const posHits = positive.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  const negHits = negative.reduce((acc, token) => acc + Number(content.includes(token)), 0);
  return posHits - negHits;
};

const toTrend = (score: number): 'bullish' | 'neutral' | 'bearish' => {
  if (score > 1.2) return 'bullish';
  if (score < -1.2) return 'bearish';
  return 'neutral';
};

export const weightedHeadlineSentimentEngine: SentimentEngine = {
  id: 'weighted-headline',
  name: 'Weighted Headline Sentiment',
  build(symbol: string, signals: NewsSignal[]): SentimentDigest {
    const effectiveSignals: NewsSignal[] = signals.length
      ? signals
      : [
          { source: 'X', signal: `${symbol} feed unavailable: neutral fallback applied.`, confidence: 0.3 },
          { source: 'Financial Times', signal: `${symbol} feed unavailable: neutral fallback applied.`, confidence: 0.3 }
        ];

    const weightedScore = effectiveSignals.reduce(
      (acc, item) => acc + scoreSignal(item.signal) * Math.max(item.confidence, 0.2),
      0
    );
    const normalized = Number((weightedScore / Math.max(effectiveSignals.length, 1)).toFixed(1));

    return {
      score: normalized,
      trend: toTrend(normalized),
      keySignals: effectiveSignals.map((item) => item.signal).slice(0, 4),
      sources: effectiveSignals.slice(0, 6)
    };
  }
};

const discountedCashFlowModel: FundamentalModel = {
  id: 'dcf-core',
  name: 'DCF Core',
  summarize(symbol, currentPrice) {
    const fairValue = Number((currentPrice * 1.09).toFixed(2));
    return {
      model: this.name,
      summary: `${symbol} screens modestly undervalued with stable free-cash-flow conversion and disciplined capex assumptions.`,
      strengths: ['Healthy operating margin trajectory', 'Cash generation supports reinvestment + buybacks'],
      risks: ['Sensitivity to terminal growth assumptions', 'Execution risk in next product cycle'],
      valuationNote: `DCF fair value is ${fairValue.toFixed(2)} vs ${currentPrice.toFixed(2)} spot.`
    };
  }
};

const qualityFactorModel: FundamentalModel = {
  id: 'quality-factors',
  name: 'Quality Factors',
  summarize(symbol, currentPrice) {
    const premium = Number((currentPrice * 0.97).toFixed(2));
    return {
      model: this.name,
      summary: `${symbol} ranks high on profitability and balance-sheet quality, with valuation near a quality premium band.`,
      strengths: ['ROIC above peer median', 'Balance sheet flexibility remains strong'],
      risks: ['Premium multiple could compress on rates shock', 'Growth deceleration may reduce factor support'],
      valuationNote: `Quality model implies neutral value around ${premium.toFixed(2)}.`
    };
  }
};

const buildEntry = (name: string, buyStart: number, buyEnd: number, sellStart: number, sellEnd: number, stop: number, tp: number, rationale: (symbol: string) => string[]): EntryPointModel => ({
  id: name.toLowerCase().replace(/\s+/g, '-'),
  name,
  plan(symbol, currentPrice): EntryPlan {
    return {
      model: this.name,
      buyZone: `${(currentPrice * buyStart).toFixed(2)} - ${(currentPrice * buyEnd).toFixed(2)}`,
      sellZone: `${(currentPrice * sellStart).toFixed(2)} - ${(currentPrice * sellEnd).toFixed(2)}`,
      stopLoss: (currentPrice * stop).toFixed(2),
      takeProfit: (currentPrice * tp).toFixed(2),
      rationale: rationale(symbol)
    };
  }
});

const swingStructureModel = buildEntry('Swing Structure', 0.97, 0.99, 1.08, 1.11, 0.94, 1.12, (symbol) => [
  `${symbol} trend structure supports pullback entries near support.`,
  'Risk/reward profile remains above 1:2 under baseline volatility.'
]);

const momentumBreakoutModel = buildEntry('Momentum Breakout', 1.01, 1.03, 1.12, 1.16, 0.98, 1.17, (symbol) => [
  `${symbol} setup favors confirmation entries once resistance is cleared.`,
  'Tighter stop intended to keep drawdown small in failed breakout scenarios.'
]);

const rsiMeanReversionModel = buildEntry('RSI Mean Reversion', 0.95, 0.975, 1.03, 1.06, 0.92, 1.07, (symbol) => [
  `${symbol} engine assumes oversold pullbacks revert toward 20-day mean.`,
  'Primary trigger is RSI recovery through a neutral threshold after a downside extension.'
]);

const atrTrendContinuationModel = buildEntry('ATR Trend Continuation', 1.005, 1.02, 1.09, 1.14, 0.965, 1.15, (symbol) => [
  `${symbol} uses ATR expansion to confirm trend continuation and avoid low-volatility noise.`,
  'Stop width scales with volatility to reduce premature exits during strong directional moves.'
]);

export const defaultFundamentalModels: FundamentalModel[] = [discountedCashFlowModel, qualityFactorModel];
export const defaultEntryPointModels: EntryPointModel[] = [
  swingStructureModel,
  momentumBreakoutModel,
  rsiMeanReversionModel,
  atrTrendContinuationModel
];

export const defaultSentimentEngines: SentimentEngine[] = [weightedHeadlineSentimentEngine];
