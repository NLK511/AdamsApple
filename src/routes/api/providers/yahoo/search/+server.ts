/**
 * Yahoo news/search proxy endpoint.
 * Proxies finance search calls via SvelteKit server to avoid browser CORS restrictions.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const YAHOO_SEARCH_URL = 'https://query1.finance.yahoo.com/v1/finance/search';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const query = url.searchParams.get('q')?.trim();
  if (!query) {
    return json({ error: 'q query param is required' }, { status: 400 });
  }

  const newsCount = url.searchParams.get('newsCount')?.trim() || '8';

  const upstream = new URL(YAHOO_SEARCH_URL);
  upstream.searchParams.set('q', query);
  upstream.searchParams.set('newsCount', newsCount);

  const response = await fetch(upstream.toString());
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
};
