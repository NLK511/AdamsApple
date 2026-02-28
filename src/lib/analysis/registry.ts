import type {
  EntryPlan,
  EntryPointModel,
  FundamentalModel,
  SentimentDigest,
  TargetConsensus,
  TickerReport
} from './contracts';

const anchorPrice = (symbol: string) => {
  const sum = [...symbol].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return Number((45 + (sum % 200) + (sum % 13) * 0.8).toFixed(2));
};

export const buildTargetConsensus = (symbol: string, currentPrice: number): TargetConsensus => {
  const seed = anchorPrice(symbol);
  const analysts = [
    { analyst: 'Morgan Stanley', targetPrice: Number((seed * 1.08).toFixed(2)), rating: 'buy' as const },
    { analyst: 'Goldman Sachs', targetPrice: Number((seed * 1.12).toFixed(2)), rating: 'buy' as const },
    { analyst: 'JP Morgan', targetPrice: Number((seed * 0.98).toFixed(2)), rating: 'hold' as const },
    { analyst: 'UBS', targetPrice: Number((seed * 0.91).toFixed(2)), rating: 'sell' as const }
  ];

  const consensusTarget = Number((analysts.reduce((acc, item) => acc + item.targetPrice, 0) / analysts.length).toFixed(2));
  const upsidePercent = Number((((consensusTarget - currentPrice) / currentPrice) * 100).toFixed(2));

  return { consensusTarget, upsidePercent, analysts };
};

export const buildSentimentDigest = (symbol: string): SentimentDigest => {
  const seed = [...symbol].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const raw = (seed % 100) - 50;
  const score = Number((raw / 10).toFixed(1));
  const trend = score > 1.5 ? 'bullish' : score < -1.5 ? 'bearish' : 'neutral';

  return {
    score,
    trend,
    keySignals: [
      'Retail positioning momentum remained stable this week.',
      'Institutional commentary highlighted margin resilience.',
      'Macro headlines kept volatility moderately elevated.'
    ],
    sources: [
      {
        source: 'X',
        signal: `${symbol} social chatter ${trend === 'bullish' ? 'accelerated' : trend === 'bearish' ? 'softened' : 'stabilized'}.`,
        confidence: 0.64
      },
      {
        source: 'Financial Times',
        signal: `Sector narrative around ${symbol} emphasizes execution over expansion.`,
        confidence: 0.78
      }
    ]
  };
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

const swingStructureModel: EntryPointModel = {
  id: 'swing-structure',
  name: 'Swing Structure',
  plan(symbol, currentPrice): EntryPlan {
    return {
      model: this.name,
      buyZone: `${(currentPrice * 0.97).toFixed(2)} - ${(currentPrice * 0.99).toFixed(2)}`,
      sellZone: `${(currentPrice * 1.08).toFixed(2)} - ${(currentPrice * 1.11).toFixed(2)}`,
      stopLoss: (currentPrice * 0.94).toFixed(2),
      takeProfit: (currentPrice * 1.12).toFixed(2),
      rationale: [
        `${symbol} trend structure supports pullback entries near support.`,
        'Risk/reward profile remains above 1:2 under baseline volatility.'
      ]
    };
  }
};

const momentumBreakoutModel: EntryPointModel = {
  id: 'momentum-breakout',
  name: 'Momentum Breakout',
  plan(symbol, currentPrice): EntryPlan {
    return {
      model: this.name,
      buyZone: `${(currentPrice * 1.01).toFixed(2)} - ${(currentPrice * 1.03).toFixed(2)}`,
      sellZone: `${(currentPrice * 1.12).toFixed(2)} - ${(currentPrice * 1.16).toFixed(2)}`,
      stopLoss: (currentPrice * 0.98).toFixed(2),
      takeProfit: (currentPrice * 1.17).toFixed(2),
      rationale: [
        `${symbol} setup favors confirmation entries once resistance is cleared.`,
        'Tighter stop intended to keep drawdown small in failed breakout scenarios.'
      ]
    };
  }
};

export const fundamentalModels: FundamentalModel[] = [discountedCashFlowModel, qualityFactorModel];
export const entryPointModels: EntryPointModel[] = [swingStructureModel, momentumBreakoutModel];

export const getFundamentalModel = (id: string | null | undefined): FundamentalModel =>
  fundamentalModels.find((model) => model.id === id) ?? fundamentalModels[0];

export const getEntryPointModel = (id: string | null | undefined): EntryPointModel =>
  entryPointModels.find((model) => model.id === id) ?? entryPointModels[0];

export const buildTickerReport = (
  symbol: string,
  currentPrice = anchorPrice(symbol),
  opts?: { fundamentalModelId?: string | null; entryModelId?: string | null }
): TickerReport => {
  const fundamentalModel = getFundamentalModel(opts?.fundamentalModelId);
  const entryModel = getEntryPointModel(opts?.entryModelId);

  return {
    symbol,
    currentPrice,
    targetConsensus: buildTargetConsensus(symbol, currentPrice),
    sentiment: buildSentimentDigest(symbol),
    fundamental: fundamentalModel.summarize(symbol, currentPrice),
    entryPlan: entryModel.plan(symbol, currentPrice),
    comparisons: {
      fundamentals: fundamentalModels.map((model) => model.summarize(symbol, currentPrice)),
      entries: entryPointModels.map((model) => model.plan(symbol, currentPrice))
    }
  };
};
