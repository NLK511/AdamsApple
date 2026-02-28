# TradeDesk Advisor (SvelteKit)

TradeDesk Advisor is a SvelteKit web app for monitoring watchlists, tracking simulated market movement, configuring threshold alerts, and opening per-ticker deep-dive analysis tabs.

## Features

- Multiple watchlists with add/switch workflows.
- Ticker table with current price and daily/weekly/monthly/quarterly/yearly change buckets.
- Price-threshold alerts (above/below) per ticker.
- Notification inbox with read/unread state (auto-marked read when inbox is viewed).
- Ticker detail tabs with pluggable analysis engines and side-by-side comparison:
  - Target price consensus + analyst breakdown
  - Sentiment analysis digest
  - Fundamental analysis summary
  - Buy/sell entry-exit planning

---

## Project structure

- `src/routes/+page.svelte`
  - Main dashboard (watchlists, alerts, inbox, ticker links)
- `src/lib/trading.ts`
  - Trading domain state + simulation + alert trigger + notification utilities
- `src/routes/ticker/[symbol]/+page.server.ts`
  - Server route loader for ticker deep-dive page (runs provider calls server-side)
- `src/routes/ticker/[symbol]/+page.svelte`
  - Ticker deep-dive UI
- `src/lib/analysis/contracts.ts`
  - Engine interfaces and report contracts
- `src/lib/analysis/registry.ts`
  - Default engine implementations + engine registry + report builder
- `tests/*.test.mjs`
  - Security, trading notifications, route behavior, and analysis engine tests

---

## Run locally

```bash
npm install
npm run dev
```

Then open the URL printed by Vite (usually `http://localhost:5173`).

### Additional scripts

```bash
npm run check   # svelte-check type/diagnostics
npm run test    # node test suite
npm run build   # production build
npm run preview # preview production build
```

---

## Data sources and APIs (default behavior)

### SvelteKit proxy-first external API strategy

All external Yahoo API calls are proxied through SvelteKit endpoints so browser code never calls cross-origin finance endpoints directly (avoids CORS failures):

- `GET /api/providers/yahoo/quote?symbols=<TICKER>`
- `GET /api/providers/yahoo/search?q=<TICKER>&newsCount=8`

The live provider module (`src/lib/analysis/providers/live-providers.ts`) calls these internal endpoints by default.

### Default contexts

- `default_mock`: uses mock providers for deterministic local prices/news and local engine outputs.
- `default_live`: uses the Yahoo proxy endpoints above for price/news, while keeping local strategy/fundamental/sentiment engines.

### Storage keys used by the app

- `trade-desk-watchlists-v1`
- `trade-desk-notifications-v1`
- `trade-desk-active-context-v1`

These are explicitly validated by the security tests.

---

## How to plug/modify sentiment analysis logic

Sentiment logic is intentionally engine-friendly through contracts and centralized registry composition.

### 1) Contract (already defined)

`src/lib/analysis/contracts.ts` defines `SentimentDigest` shape used by the UI/report.

### 2) Default implementation

The default builder is in `src/lib/analysis/registry.ts`:

- `buildSentimentDigest(symbol)`

### 3) Recommended extension pattern

To support multiple sentiment engines (e.g., X-only vs FT-weighted vs LLM classifier), introduce a dedicated sentiment engine interface in `contracts.ts` and wire it into `registry.ts` similarly to fundamental/entry engines.

Suggested interface pattern:

```ts
export interface SentimentModel {
  id: string;
  name: string;
  summarize(symbol: string): SentimentDigest;
}
```

Then:

- Add a `sentimentModels` array in `registry.ts`
- Add `getSentimentModel(id)` fallback selector
- Pass selected sentiment model into `buildTickerReport(...)`
- Add query-param selection in `src/routes/ticker/[symbol]/+page.server.ts`
- Add dropdown in `src/routes/ticker/[symbol]/+page.svelte`

### 4) Testing guidance

Add tests in `tests/analysis-engines.test.mjs` to assert:

- model switch changes digest outputs
- required channels are present (if mandated)
- fallback behavior on unknown model IDs

---

## How to plug/modify entry-point calculation logic

Entry/exit strategy logic is already pluggable.

### Existing contract

In `src/lib/analysis/contracts.ts`:

- `EntryPointModel`
- `EntryPlan`

### Existing registry and models

In `src/lib/analysis/registry.ts`:

- `entryPointModels`
- `getEntryPointModel(id)`
- default models:
  - `swing-structure`
  - `momentum-breakout`
  - `rsi-mean-reversion`
  - `atr-trend-continuation`



### Built-in strategy intents

- **Swing Structure**: pullback entries around support with wider trend-following exits.
- **Momentum Breakout**: confirmation entries after resistance breaks with tighter protective stops.
- **RSI Mean Reversion**: oversold rebound setup targeting return to trend mean.
- **ATR Trend Continuation**: volatility-adjusted continuation entries during expanding trend moves.

### Add a new entry model

1. Implement a new `EntryPointModel` object in `registry.ts`.
2. Add it to `entryPointModels`.
3. Ensure output fields are complete:
   - `buyZone`, `sellZone`, `stopLoss`, `takeProfit`, `rationale`
4. Validate with tests in `tests/analysis-engines.test.mjs`:
   - different outputs from other models
   - stable fallback behavior

---

## How to plug/modify fundamental analysis logic

Fundamental summary is already pluggable.

### Existing contract

In `src/lib/analysis/contracts.ts`:

- `FundamentalModel`
- `FundamentalSummary`

### Existing registry and models

In `src/lib/analysis/registry.ts`:

- `fundamentalModels`
- `getFundamentalModel(id)`
- default models:
  - `dcf-core`
  - `quality-factors`

### Add a new fundamental model

1. Implement a new `FundamentalModel` object.
2. Add it to `fundamentalModels`.
3. Return complete summary payload:
   - `summary`, `strengths`, `risks`, `valuationNote`
4. Add/extend tests to compare model differentiation.

---


## Metadata cache and history

Ticker inferred metadata is cached in a lightweight in-memory storage (`src/lib/analysis/metadata-storage.ts`) used by `buildTickerReportCached(...)` in the analysis registry.

### What is cached

- target consensus (`target-consensus`)
- sentiment digest (`sentiment`)
- fundamental summaries (`fundamental:<model-id>`)
- entry plans (`entry:<model-id>`)

### What is not cached

- highly volatile price simulation values (spot price, fast-moving table changes)

### Refresh interval precedence

1. Per-ticker + per-metadata interval (highest priority)
2. Global metadata refresh interval (fallback)

Ticker detail route accepts these query params to configure intervals:

- `refreshAllMs`
- `refreshTargetMs`
- `refreshSentimentMs`
- `refreshFundamentalMs`
- `refreshEntryMs`

Example:

```text
/ticker/AAPL?refreshAllMs=300000&refreshSentimentMs=3600000
```

Each cached metadata key stores history snapshots so evolution over time is available.

---

## Run lightweight storage locally

You can spin up a tiny local metadata storage server for development tooling/integration experiments:

```bash
npm run storage:dev
```

Default endpoint: `http://localhost:7373`

Available endpoints:

- `GET /health`
- `GET /cache`
- `POST /cache/global-interval` with `{"refreshMs": 300000}`
- `GET /cache/:symbol`
- `POST /cache/:symbol/interval` with `{"key": "sentiment", "refreshMs": 3600000}`

This server is intentionally lightweight and in-memory only.

---

## Integrating real external APIs (optional)

If you want live APIs (market data/news/analyst endpoints), keep provider logic isolated from UI:

1. Create provider modules in `src/lib/analysis/providers/` (e.g. `marketProvider.ts`, `newsProvider.ts`).
2. Define provider interfaces (fetch methods + normalized return types).
3. Inject providers into engine functions (or load-layer composition), instead of calling APIs directly in Svelte components.
4. Use env vars for API keys and base URLs.


### Live provider endpoint configuration

`src/lib/analysis/providers/live-providers.ts` exposes `defaultLiveProviderConfig` with defaults:

- `stooqBaseUrl`: `https://stooq.com/q/l/`
- `yahooQuoteSummaryBaseUrl`: `https://query1.finance.yahoo.com/v10/finance/quoteSummary/`
- `ftRssSearchBaseUrl`: `https://www.ft.com/search`
- `xRssSearchBaseUrl`: `https://nitter.net/search/rss`

You can override these by creating your own config object and calling provider helpers directly in custom load logic.

### Suggested environment variables

```bash
PUBLIC_MARKET_DATA_API_BASE_URL=
MARKET_DATA_API_KEY=
PUBLIC_NEWS_API_BASE_URL=
NEWS_API_KEY=
PUBLIC_ANALYST_API_BASE_URL=
ANALYST_API_KEY=
```

> Notes:
> - Prefix with `PUBLIC_` only for values safe to expose client-side.
> - Keep secrets server-side where possible via SvelteKit server/load endpoints.

### Recommended source mapping (when enabling real APIs)

- Ticker quotes + changes: market data provider
- Analyst target breakdown: analyst estimates provider
- Sentiment raw inputs: X/news provider + FT/news provider
- Fundamentals raw metrics: financial statements provider
- Entry calculations: internal model logic over normalized market data

---

## Security-focused tests

Run:

```bash
npm run test
```

Security tests include guards against:

- dynamic code execution (`eval`, `new Function`)
- unsafe HTML sinks (`innerHTML`, `outerHTML`, `insertAdjacentHTML`)
- process/filesystem access in app source (`child_process`, `fs`)
- prompt-injection/agent-risk surfaces (message handlers, wildcard `postMessage`, dynamic fetch targets)
- localStorage usage outside authorized keys

---

## Windows / WSL npm EPERM fix

If the repo lives on `/mnt/c/...` and `npm install` fails with chmod/EPERM issues,
`.npmrc` includes:

```ini
bin-links=false
```

Scripts invoke binaries via `node ./node_modules/...` directly so development still works without `.bin` symlink creation.

## Analysis contexts and provider wiring

TradeDesk now builds ticker reports from a context object (`src/lib/analysis/contexts.ts`).
A context explicitly defines:
- `newsProvider`
- `tickerPriceProvider`
- `sentimentEngine`
- `fundamentalModels`
- `entryPointModels`

### Built-in contexts

- `default_mock`: uses `src/lib/analysis/providers/mock-providers.ts` for synthetic headlines and synthetic prices.
- `default_live`: uses Yahoo Finance providers from `src/lib/analysis/providers/live-providers.ts`:
  - Price endpoint: `https://query1.finance.yahoo.com/v7/finance/quote?symbols=<TICKER>`
  - News endpoint: `https://query1.finance.yahoo.com/v1/finance/search?q=<TICKER>&newsCount=8`

The ticker page accepts `?context=default_mock` or `?context=default_live` and shows active provider IDs in the UI.

### Add a custom provider or engine

1. Implement `NewsProvider` and/or `TickerPriceProvider` from `src/lib/analysis/contracts.ts`.
2. (Optional) Implement a `SentimentEngine` if you want custom signal scoring.
3. Register your implementation inside `analysisContexts` in `src/lib/analysis/contexts.ts`.
4. Open `/ticker/<symbol>?context=<your-context-id>` to use and compare it.

This keeps external API concerns out of Svelte components and makes A/B testing provider stacks straightforward.

## Dashboard watchlists now use active context pricing

Default watchlists still seed the same ticker sets (`AAPL/MSFT/NVDA` and `TSLA/SHOP/AMD`), but ticker initialization now resolves price and initial change metadata through the **active dashboard context** (`default_mock` or `default_live`).

- Context is selectable directly on the dashboard and persisted to `trade-desk-active-context-v1`.
- `default_mock` uses local mock providers from `src/lib/analysis/providers/mock-providers.ts`.
- `default_live` uses Yahoo providers from `src/lib/analysis/providers/live-providers.ts`.
- New tickers added from the dashboard are initialized with the currently active context as well.

This removes pricing mock-seeding from trading watchlist constructors and keeps provider logic centralized in the context/provider layer.
