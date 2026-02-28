/**
 * Unit tests for Yahoo proxy route handlers.
 * Confirms server-side forwarding and validation for quote/search endpoints.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const loadRoute = async (relativePath) => {
  const source = readFileSync(path.join(process.cwd(), relativePath), 'utf8')
    .replace(
      "import { json } from '@sveltejs/kit';",
      "const json=(body,init={})=>new Response(JSON.stringify(body),{status:init.status??200,headers:{'content-type':'application/json; charset=utf-8',...(init.headers||{})}});"
    )
    .replace("import type { RequestHandler } from './$types';\n", '');

  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
    fileName: relativePath
  }).outputText;

  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};

test('quote proxy rejects missing symbols and forwards valid requests', async () => {
  const route = await loadRoute('src/routes/api/providers/yahoo/quote/+server.ts');

  const bad = await route.GET({ url: new URL('http://local/api/providers/yahoo/quote'), fetch: globalThis.fetch });
  assert.equal(bad.status, 400);

  let called = '';
  const ok = await route.GET({
    url: new URL('http://local/api/providers/yahoo/quote?symbols=AAPL'),
    fetch: async (url) => {
      called = String(url);
      return new Response('{"quoteResponse":{"result":[{"regularMarketPrice":1}]}}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  assert.equal(ok.status, 200);
  assert.match(called, /query1\.finance\.yahoo\.com\/v7\/finance\/quote\?symbols=AAPL$/);
});

test('search proxy rejects missing q and forwards valid requests', async () => {
  const route = await loadRoute('src/routes/api/providers/yahoo/search/+server.ts');

  const bad = await route.GET({ url: new URL('http://local/api/providers/yahoo/search'), fetch: globalThis.fetch });
  assert.equal(bad.status, 400);

  let called = '';
  const ok = await route.GET({
    url: new URL('http://local/api/providers/yahoo/search?q=AAPL&newsCount=5'),
    fetch: async (url) => {
      called = String(url);
      return new Response('{"news":[]}', {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
  });

  assert.equal(ok.status, 200);
  assert.match(called, /query1\.finance\.yahoo\.com\/v1\/finance\/search\?q=AAPL&newsCount=5$/);
});
