import type { NewsSignal } from '../../contracts';

const financialTimesLikePattern = /financial\s*times|reuters|bloomberg|wsj|marketwatch|cnbc/i;

export const classifyProviderSource = (publisher: string): NewsSignal['source'] =>
  financialTimesLikePattern.test(publisher) ? 'Financial Times' : 'X';
