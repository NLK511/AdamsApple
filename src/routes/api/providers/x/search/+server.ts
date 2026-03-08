/**
 * X (Twitter) recent-search proxy endpoint.
 * Requires X_BEARER_TOKEN env var for live access; returns empty data when absent.
 */
import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

const X_SEARCH_URL = 'https://api.twitter.com/2/tweets/search/recent';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const query = url.searchParams.get('q')?.trim();
  if (!query) {
    return json({ error: 'q query param is required' }, { status: 400 });
  }

  const maxResults = url.searchParams.get('max_results')?.trim() || '10';
  const token = env.X_BEARER_TOKEN?.trim();

  if (!token) {
    return json({ data: [], meta: { warning: 'X_BEARER_TOKEN not configured' } }, { status: 200 });
  }

  const upstream = new URL(X_SEARCH_URL);
  upstream.searchParams.set('query', query);
  upstream.searchParams.set('max_results', maxResults);
  upstream.searchParams.set('tweet.fields', 'created_at,lang,text');

  const response = await fetch(upstream.toString(), {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const text = await response.text();
  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=30'
    }
  });
};
