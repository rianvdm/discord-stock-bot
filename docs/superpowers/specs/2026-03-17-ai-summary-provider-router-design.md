# Design: AI Summary Provider Router

**Date:** 2026-03-17
**Status:** Approved

## Goal

Allow one-line switching between Perplexity and OpenAI as the AI summary provider, with both implementations kept in the codebase.

## Approach

A thin router `src/services/ai-summary.js` reads `CONFIG.AI_SUMMARY_PROVIDER` and delegates to the correct service. Both provider services already normalize their output to a plain string — format differences are fully encapsulated inside each service file.

## Config

```js
// src/config.js
AI_SUMMARY_PROVIDER: 'perplexity', // or 'openai' — one line to switch
```

## Router: `src/services/ai-summary.js`

Exports `generateAISummary(ticker, companyName, env)` — receives the full `env` object and extracts the right API key based on provider. Throws immediately with a clear message if an unknown provider is configured.

```js
if (CONFIG.AI_SUMMARY_PROVIDER === 'perplexity') {
  return perplexityGenerateAISummary(ticker, companyName, env.PERPLEXITY_API_KEY);
} else if (CONFIG.AI_SUMMARY_PROVIDER === 'openai') {
  return openaiGenerateAISummary(ticker, companyName, env.OPENAI_API_KEY);
} else {
  throw new Error(`Unknown AI_SUMMARY_PROVIDER: ${CONFIG.AI_SUMMARY_PROVIDER}`);
}
```

## Signature Change

Commands currently call `generateAISummary(ticker, companyName, apiKey)`. With the router, the signature becomes `generateAISummary(ticker, companyName, env)` — commands pass `env` directly instead of extracting an API key. The per-provider services keep their existing `(ticker, companyName, apiKey)` signature unchanged.

## Files Changed

| File | Action |
|------|--------|
| `src/services/perplexity.js` | Restore from `main` branch via `git checkout main -- src/services/perplexity.js` |
| `src/services/ai-summary.js` | Create — router |
| `src/config.js` | Add `AI_SUMMARY_PROVIDER: 'perplexity'`; restore `PERPLEXITY_TIMEOUT: 30000` (removed during OpenAI migration — `perplexity.js` references it directly) |
| `src/commands/stock.js` | Import from `ai-summary.js`; pass `env` instead of `apiKey` |
| `src/commands/crypto.js` | Same |
| `tests/services/ai-summary.test.js` | Create — test routing logic, unknown provider error, and undefined API key case |
| `tests/commands/stock.test.js` | Add `PERPLEXITY_API_KEY: 'test_perplexity_key'` to `mockEnv` |
| `tests/commands/crypto.test.js` | Same |
| `wrangler.toml` | Document `PERPLEXITY_API_KEY` as a required secret |

## Default Provider

Defaults to `'perplexity'` since it was more reliable in testing (always found results vs. OpenAI's occasional "no recent news" responses).
