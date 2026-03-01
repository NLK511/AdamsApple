/**
 * stockprices.dev quote proxy endpoint.
 * Forwards quote requests server-side so clients never hit stockprices.dev directly (avoids CORS issues).
 */
import { json } from '@sveltejs/kit';
import type * as Kit from '@sveltejs/kit';

type RouteParams = {  };
type RouteId = '/api/providers/stockpricesdev/quote';

export type RequestHandler = Kit.RequestHandler<RouteParams, RouteId>;

const SPDEV_QUOTE_URL = 'https://stockprices.dev/api/stocks';

export const GET: RequestHandler = async ({ url, fetch }) => {
  console.log('Received quote request with params:', Object.fromEntries(url.searchParams.entries()));
  const symbols = url.searchParams.get('symbols')?.trim();
  if (!symbols) {
    return json({ error: 'symbols query param is required' }, { status: 400 });
  }

  const upstream = new URL(SPDEV_QUOTE_URL+'/'+symbols);

  const response = await fetch(upstream.toString());
  if(!response.ok) {
    console.error(`Upstream quote fetch failed for ${symbols}: ${response.status} ${response.statusText}`);
    return json({ error: 'Failed to fetch quote from upstream' }, { status: 502 });
  } else {
    console.log(`Upstream quote fetch succeeded for ${symbols}: ${response.status} ${response.statusText}`);
  }
  const text = await response.text();
  console.log('Upstream response text:', text);

  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=15'
    }
  });
};
