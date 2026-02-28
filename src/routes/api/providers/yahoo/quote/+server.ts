/**
 * Yahoo quote proxy endpoint.
 * Forwards quote requests server-side so clients never hit Yahoo directly (avoids CORS issues).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const symbols = url.searchParams.get('symbols')?.trim();
  if (!symbols) {
    return json({ error: 'symbols query param is required' }, { status: 400 });
  }

  const upstream = new URL(YAHOO_QUOTE_URL);
  upstream.searchParams.set('symbols', symbols);

  const response = await fetch(upstream.toString());
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=15'
    }
  });
};
