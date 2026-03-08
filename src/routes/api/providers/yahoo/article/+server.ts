/**
 * Yahoo article-content proxy endpoint.
 * Fetches article HTML server-side so browser providers can read content without CORS issues.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
  const articleUrl = url.searchParams.get('url')?.trim();
  if (!articleUrl) {
    return json({ error: 'url query param is required' }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(articleUrl);
  } catch {
    return json({ error: 'invalid article url' }, { status: 400 });
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return json({ error: 'unsupported protocol' }, { status: 400 });
  }

  const response = await fetch(parsed.toString());
  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      'content-type': response.headers.get('content-type') ?? 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60'
    }
  });
};
