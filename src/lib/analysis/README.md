# Analysis package

This package composes ticker analysis through **contexts** that bind providers (news + price) with engines (sentiment + strategies).
Use `default_mock` for fully local deterministic behavior and `default_live` for Yahoo-backed price/news with the same strategy engine set.
Extend by adding a provider/engine and registering it in `src/lib/analysis/contexts.ts`.
The trading dashboard now consumes the same context catalog when seeding default watchlists and when adding new tickers.
This guarantees ticker bootstrap pricing/metadata always come from the active context instead of ad-hoc random seeding.

Live Yahoo integration is proxy-first via `/api/providers/yahoo/*` SvelteKit routes to avoid browser CORS issues.
Live context provider failures are surfaced to dashboard ticker warnings instead of being silently replaced with mock values.
