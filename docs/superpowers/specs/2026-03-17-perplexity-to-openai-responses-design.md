# Design: Replace Perplexity with GPT-5.4 via OpenAI Responses API

**Date:** 2026-03-17
**Status:** Approved

## Goal

Replace the Perplexity SONAR integration for AI-powered stock/crypto news summaries with GPT-5.4 via the OpenAI Responses API, with web search forced on every request.

## Approach

Raw fetch to `https://api.openai.com/v1/responses` — same pattern used in listentomore. No SDK dependency changes required.

## New File: `src/services/openai-responses.js`

Exports `generateAISummary(ticker, companyName, apiKey)` — identical signature to the existing `perplexity.js` so command changes are minimal.

**Request shape:**
- `model: 'gpt-5.4'`
- `tools: [{ type: 'web_search' }]`
- `tool_choice: { type: 'web_search' }` — forces web search on every call
- `instructions`: system prompt (separate field per Responses API convention)
- `input`: user prompt string (single-turn, no array needed)
- `store: false` — opt out of OpenAI storage for privacy
- `max_output_tokens: 800`

**Response parsing:**
1. Try `data.output_text` (convenience field)
2. Fall back to `data.output[].content[].text` where `item.type === 'message'` and `block.type === 'output_text'`

**Prompt:** Ported from `perplexity.js` — same date injection, 72-hour recency window, plain text constraint, no citations/URLs/markdown.

**Error handling:** Classify timeout, 429 (rate limit), 401 (auth), and generic errors. Error messages updated from "Perplexity" to "OpenAI".

**Performance logging:** Same `[PERF]` log with `apiDuration`, `totalDuration`, `summaryLength`.

## Files Changed

| File | Action |
|------|--------|
| `src/services/openai-responses.js` | Create |
| `src/commands/stock.js` | Update import path and `PERPLEXITY_API_KEY` → `OPENAI_API_KEY` |
| `src/commands/crypto.js` | Update import path and `PERPLEXITY_API_KEY` → `OPENAI_API_KEY` |
| `src/config.js` | Add `OPENAI_RESPONSES_TIMEOUT: 30000`, remove `PERPLEXITY_TIMEOUT` |
| `src/services/perplexity.js` | Delete |
| `src/services/openai.js` | Delete (broken prior attempt) |

## Environment Variables

`PERPLEXITY_API_KEY` is replaced by `OPENAI_API_KEY` in the Cloudflare Worker environment. The `openai.js` service already used `OPENAI_API_KEY` so this aligns with what the bot already expected for that path.

## Reference Implementation

`/Users/rian/Documents/GitHub/listentomore/packages/services/ai/src/openai.ts` — the `responses()` method and `parseResponsesResult()` are the direct reference for request construction and response parsing.
