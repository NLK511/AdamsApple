# Analysis package

This package composes ticker analysis through **contexts** that bind providers (news + price) with engines (sentiment + strategies).
Use `default_mock` for fully local deterministic behavior and `default_live` for Yahoo-backed price/news with the same strategy engine set.
Extend by adding a provider/engine and registering it in `src/lib/analysis/contexts.ts`.
