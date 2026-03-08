import type { NewsSignal } from '../../contracts';
import { scoreSignal } from '../../sentiment/scoring';
import { classifyProviderSource } from './source-classifier';
import { providerLog } from './provider-log';
import type { NormalizedProviderNewsItem } from './types';

const defaultFallbackConfidence = 0.6;

export const normalizeListFetch = (items: unknown, maxItems = 6): NormalizedProviderNewsItem[] => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => ({
      title: String((item as { title?: unknown })?.title ?? '').trim(),
      publisher: String((item as { publisher?: unknown })?.publisher ?? '').trim(),
      link: String((item as { link?: unknown })?.link ?? '').trim()
    }))
    .filter((item) => item.title.length > 0)
    .slice(0, maxItems);
};

export const extractTextFromHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const deriveConfidenceFromScoreSignal = (signalText: string): number => {
  const score = scoreSignal(signalText);
  return Math.min(0.95, Math.max(0.5, 0.55 + Math.abs(score) * 0.08));
};

export const fallbackSignal = (
  source: NewsSignal['source'],
  title: string,
  confidence: number = defaultFallbackConfidence
): NewsSignal => ({ source, signal: title, confidence });

interface BuildArticleSignalPipelineOptions {
  symbol: string;
  fetchImpl: typeof fetch;
  fetchListPayload: (symbol: string, fetchImpl: typeof fetch) => Promise<unknown>;
  normalizeItems: (payload: unknown) => NormalizedProviderNewsItem[];
  fetchArticle: (link: string, title: string, fetchImpl: typeof fetch) => Promise<string | null>;
  classifySource?: (item: NormalizedProviderNewsItem) => NewsSignal['source'];
  normalizeArticleText?: (content: string) => string;
  fallbackConfidence?: number;
}

export const buildArticleSignalPipeline = async ({
  symbol,
  fetchImpl,
  fetchListPayload,
  normalizeItems,
  fetchArticle,
  classifySource = (item) => classifyProviderSource(item.publisher),
  normalizeArticleText = (content) => content.trim(),
  fallbackConfidence = defaultFallbackConfidence
}: BuildArticleSignalPipelineOptions): Promise<NewsSignal[]> => {
  providerLog(`Fetching provider list for ${symbol}`);
  const payload = await fetchListPayload(symbol, fetchImpl);
  const items = normalizeItems(payload);

  const signals = await Promise.all(
    items.map(async (item) => {
      const source = classifySource(item);

      if (!item.link) {
        return fallbackSignal(source, item.title, fallbackConfidence);
      }

      try {
        providerLog(`Fetching article for signal analysis: ${item.link}`);
        const rawContent = await fetchArticle(item.link, item.title, fetchImpl);
        if (!rawContent) {
          return fallbackSignal(source, item.title, fallbackConfidence);
        }

        const normalizedText = normalizeArticleText(rawContent).slice(0, 900);
        const signalText = normalizedText.length > 40 ? normalizedText : item.title;

        return {
          source,
          signal: signalText,
          confidence: deriveConfidenceFromScoreSignal(signalText)
        } satisfies NewsSignal;
      } catch (error) {
        providerLog(`Article fetch failed for ${item.link}`, error);
        return fallbackSignal(source, item.title, fallbackConfidence);
      }
    })
  );

  return signals;
};
