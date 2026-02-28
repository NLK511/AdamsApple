/**
 * Static security guardrail tests for source code patterns.
 * Prevents risky primitives and unauthorized storage usage regressions.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const srcRoot = path.join(projectRoot, 'src');

const walkFiles = (dir) => {
  const entries = readdirSync(dir);
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      return walkFiles(fullPath);
    }
    return [fullPath];
  });
};

const sourceFiles = walkFiles(srcRoot).filter((file) => /\.(svelte|ts|js)$/.test(file));
const sourceByFile = new Map(
  sourceFiles.map((file) => [path.relative(projectRoot, file), readFileSync(file, 'utf8')])
);

const forbiddenPatterns = [
  { pattern: /\b(eval|Function)\s*\(/, reason: 'dynamic code execution' },
  { pattern: /\binnerHTML\s*=|outerHTML\s*=|insertAdjacentHTML\s*\(/, reason: 'unsafe HTML sink' },
  { pattern: /\brequire\(['"]child_process['"]\)|from\s+['"]node:child_process['"]/, reason: 'process execution' },
  { pattern: /from\s+['"]node:fs['"]|from\s+['"]fs['"]|\brequire\(['"]fs['"]\)/, reason: 'filesystem access from app source' },
  { pattern: /from\s+['"]node:net['"]|from\s+['"]node:tls['"]|from\s+['"]node:dgram['"]/, reason: 'low-level network primitives' },
  { pattern: /document\.cookie\b/, reason: 'cookie access not used in this app model' },
  { pattern: /localStorage\.getItem\(\s*[^)\n]*\)/, reason: 'will be checked by dedicated key-scope test' }
];

const promptInjectionRiskPatterns = [
  { pattern: /dangerouslySetInnerHTML/i, reason: 'raw HTML injection primitive' },
  { pattern: /onmessage\s*=|addEventListener\(\s*['"]message['"]/, reason: 'message-channel input surface' },
  { pattern: /postMessage\([^,]+,\s*['"]\*['"]\)/, reason: 'wildcard postMessage targetOrigin' },
  { pattern: /new\s+URL\(\s*[^,\n]+\s*,\s*location\.href\s*\)/, reason: 'URL rewrite from untrusted current location' },
  { pattern: /fetch\(\s*[^'"`\s]/, reason: 'dynamic fetch target (must be explicit allowlisted endpoint)' }
];

test('app source does not use dangerous runtime primitives', () => {
  for (const [file, source] of sourceByFile) {
    for (const check of forbiddenPatterns) {
      if (check.reason === 'will be checked by dedicated key-scope test') {
        continue;
      }
      assert.equal(
        check.pattern.test(source),
        false,
        `${file} includes forbidden pattern (${check.reason})`
      );
    }
  }
});

test('app source includes no common prompt-injection / agent-threat sinks', () => {
  for (const [file, source] of sourceByFile) {
    for (const check of promptInjectionRiskPatterns) {
      if (check.reason === 'dynamic fetch target (must be explicit allowlisted endpoint)' && file.startsWith('src/lib/analysis/providers/')) {
        continue;
      }
      assert.equal(
        check.pattern.test(source),
        false,
        `${file} includes risky pattern (${check.reason})`
      );
    }
  }
});

test('localStorage usage is constrained to authorized storage keys only', () => {
  const pagePath = 'src/routes/+page.svelte';
  const pageSource = sourceByFile.get(pagePath);

  assert.ok(pageSource, `${pagePath} should exist`);
  assert.match(pageSource, /const\s+STORAGE_KEY\s*=\s*['"]trade-desk-watchlists-v1['"]/);
  assert.match(pageSource, /const\s+NOTIFICATION_STORAGE_KEY\s*=\s*['"]trade-desk-notifications-v1['"]/);
  assert.match(pageSource, /const\s+ACTIVE_CONTEXT_KEY\s*=\s*['"]trade-desk-active-context-v1['"]/);

  const localStorageCalls = [...pageSource.matchAll(/localStorage\.(getItem|setItem|removeItem)\(([^)]*)\)/g)];
  assert.ok(localStorageCalls.length > 0, 'expected localStorage usage to be present');

  for (const [, method, args] of localStorageCalls) {
    assert.match(
      args,
      /\b(STORAGE_KEY|NOTIFICATION_STORAGE_KEY|ACTIVE_CONTEXT_KEY)\b/,
      `localStorage.${method} must only use authorized keys, got args: ${args.trim()}`
    );
  }
});
