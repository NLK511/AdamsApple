# Trading model ownership

The `src/lib/trading/model/` tree is the canonical domain root for trading model types.

Ownership rule:
- Define and maintain trading-domain types here (`alerts`, `tickers`, `watchlists`, `notifications`, `ticks`).
- Import these types from this folder directly where they are used.
- Do not re-export these types through `src/lib/trading/index.ts` unless a type is intentionally part of a stable public API surface.
