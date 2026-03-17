# Perplexity → OpenAI Responses API Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Perplexity SONAR integration with GPT-5.4 via the OpenAI Responses API (raw fetch), keeping the same `generateAISummary` function signature so command files change minimally.

**Architecture:** A new `src/services/openai-responses.js` makes raw POST requests to `https://api.openai.com/v1/responses` with `tools: [{ type: 'web_search' }]` and `store: false`. The system prompt goes in `instructions`, the user prompt in `input`. Response content is extracted from `output_text` with a fallback to `output[].content[].text`. The two commands (`stock.js`, `crypto.js`) are updated to import from the new file and use `OPENAI_API_KEY`. The old `perplexity.js`, `openai.js`, and their test file are deleted.

**Tech Stack:** Vitest, Cloudflare Workers (native `fetch`), OpenAI Responses API

---

## File Map

| File | Action |
|------|--------|
| `src/services/openai-responses.js` | Create — main new service |
| `tests/services/openai-responses.test.js` | Create — tests for new service |
| `tests/services/openai.test.js` | Delete — tests broken service |
| `src/services/perplexity.js` | Delete |
| `src/services/openai.js` | Delete |
| `src/commands/stock.js` | Modify — update import + env var name |
| `src/commands/crypto.js` | Modify — update import + env var name |
| `src/config.js` | Modify — remove `PERPLEXITY_TIMEOUT` |
| `wrangler.toml` | Modify (if needed) — remove `PERPLEXITY_API_KEY` binding |

---

## Task 1: Delete stale files

**Files:**
- Delete: `src/services/perplexity.js`
- Delete: `src/services/openai.js`
- Delete: `tests/services/openai.test.js`

- [ ] **Step 1: Delete the three stale files**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
rm src/services/perplexity.js src/services/openai.js tests/services/openai.test.js
```

- [ ] **Step 2: Run the test suite to verify deletion doesn't break unrelated tests**

```bash
npm test
```

Expected: some tests will now fail because `stock.js` and `crypto.js` still import from `perplexity.js`. That's fine — those will be fixed in Task 3. The important thing is that no other unexpected failures appear.

**Note:** Do NOT commit yet. The commands still import from `perplexity.js` — committing now would leave the repo in a broken state. The deletions will be committed together with the command updates in Task 3.

---

## Task 2: Create `openai-responses.js` with tests (TDD)

**Files:**
- Create: `tests/services/openai-responses.test.js`
- Create: `src/services/openai-responses.js`

### Step 2a — Write failing tests

- [ ] **Step 1: Create the test file**

```bash
touch /Users/rian/Documents/GitHub/discord-stock-bot/tests/services/openai-responses.test.js
```

- [ ] **Step 2: Write the tests**

Write `tests/services/openai-responses.test.js` with this content:

```javascript
// ABOUTME: Tests for OpenAI Responses API service that generates AI summaries of stock news
// ABOUTME: Mocks globalThis.fetch to test raw HTTP calls to /v1/responses

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAISummary, formatPrompt } from '../../src/services/openai-responses.js';

describe('OpenAI Responses Service', () => {
  describe('formatPrompt', () => {
    it('should include ticker and company name', () => {
      const prompt = formatPrompt('AAPL', 'Apple Inc.');
      expect(prompt).toContain('AAPL');
      expect(prompt).toContain('Apple Inc.');
    });

    it('should include today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const prompt = formatPrompt('AAPL', 'Apple Inc.');
      expect(prompt).toContain(today);
    });

    it('should instruct model to search and return plain text', () => {
      const prompt = formatPrompt('NET', 'Cloudflare Inc.');
      expect(prompt).toContain('72 hours');
      expect(prompt).toContain('800 characters');
      expect(prompt).toContain('NO citations');
    });
  });

  describe('generateAISummary', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call the Responses API with correct shape', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: 'Apple reported strong earnings. Stock is up 5%.',
        }),
      });

      await generateAISummary('AAPL', 'Apple Inc.', 'test-api-key');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/responses');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-5.4');
      expect(body.tools).toEqual([{ type: 'web_search' }]);
      expect(body.store).toBe(false);
      expect(body.max_output_tokens).toBe(800);
      expect(body.instructions).toContain('financial news analyst');
      expect(body.input).toContain('Apple Inc.');
    });

    it('should return content from output_text', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: 'Apple reported strong earnings. Stock is up 5%.',
        }),
      });

      const result = await generateAISummary('AAPL', 'Apple Inc.', 'test-api-key');
      expect(result).toBe('Apple reported strong earnings. Stock is up 5%.');
    });

    it('should fall back to output[].content[].text when output_text is absent', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output: [
            { type: 'web_search_call' },
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Cloudflare launched a new product. Revenue is up.' },
              ],
            },
          ],
        }),
      });

      const result = await generateAISummary('NET', 'Cloudflare Inc.', 'test-api-key');
      expect(result).toBe('Cloudflare launched a new product. Revenue is up.');
    });

    it('should throw on empty content', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: '',
        }),
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('No content in OpenAI response');
    });

    it('should throw a timeout error on timeout', async () => {
      fetchSpy.mockRejectedValue(new Error('Request timeout'));

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API timeout');
    });

    it('should throw a rate limit error on 429', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'rate limit exceeded',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });

    it('should throw an auth error on 401', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'invalid api key',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'invalid-key')
      ).rejects.toThrow('OpenAI API authentication failed');
    });

    it('should throw a generic error on other HTTP failures', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API error');
    });
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail (service doesn't exist yet)**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test -- tests/services/openai-responses.test.js
```

Expected: `FAIL` — "Cannot find module '../../src/services/openai-responses.js'"

### Step 2b — Implement the service

- [ ] **Step 4: Create `src/services/openai-responses.js`**

```javascript
// ABOUTME: OpenAI Responses API client for generating AI-powered news summaries about stocks
// ABOUTME: Uses raw fetch to POST /v1/responses with gpt-5.4 and web_search tool
// ABOUTME: Includes timeout handling, error classification, and response validation

import { CONFIG } from '../config.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

/**
 * Generate AI-powered news summary for a stock using OpenAI Responses API
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} AI-generated summary (2-4 sentences)
 * @throws {Error} If API request fails
 */
export async function generateAISummary(ticker, companyName, apiKey) {
  const startTime = Date.now();

  try {
    console.log('[INFO] Requesting AI summary from OpenAI Responses API', { ticker, companyName });

    const prompt = formatPrompt(ticker, companyName);
    console.log('[DEBUG] OpenAI prompt', { ticker, prompt });

    const apiCallStart = Date.now();

    const response = await Promise.race([
      fetch(RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          instructions: 'You are a financial news analyst. Use succinct, plain language focused on accuracy and professionalism.',
          input: prompt,
          tools: [{ type: 'web_search' }],
          store: false,
          max_output_tokens: 800,
        }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.OPENAI_TIMEOUT)
      ),
    ]);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[ERROR] OpenAI Responses API HTTP error', {
        ticker,
        status: response.status,
        body: errorBody,
      });

      if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded - try again later');
      }
      if (response.status === 401) {
        throw new Error('OpenAI API authentication failed - check API key');
      }
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = extractContent(data);

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('No content in OpenAI response');
    }

    const apiCallDuration = Date.now() - apiCallStart;
    const totalDuration = Date.now() - startTime;
    console.log('[PERF] OpenAI Responses API response time', {
      apiDuration: `${apiCallDuration}ms`,
      totalDuration: `${totalDuration}ms`,
      summaryLength: content.length,
      cached: false,
    });

    console.log('[INFO] AI summary generated successfully', { ticker, length: content.length });

    return content.trim();

  } catch (error) {
    // Re-throw already-classified errors without wrapping them again
    if (
      error.message.includes('rate limit') ||
      error.message.includes('authentication') ||
      error.message.includes('No content') ||
      error.message.startsWith('OpenAI API error')
    ) {
      throw error;
    }

    console.error('[ERROR] OpenAI Responses API error', {
      ticker,
      error: error.message,
    });

    if (error.message.includes('timeout')) {
      throw new Error('OpenAI API timeout - unable to generate summary');
    }

    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Extract text content from an OpenAI Responses API response.
 * Tries output_text first, then walks output[].content[].text.
 * @param {Object} data - Parsed JSON response from /v1/responses
 * @returns {string|null}
 */
function extractContent(data) {
  if (data.output_text) {
    return data.output_text;
  }

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.text) {
            return block.text;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Format the prompt for OpenAI to generate stock news summary
 * @param {string} ticker - Stock ticker symbol
 * @param {string} companyName - Company name
 * @returns {string} Formatted prompt
 */
export function formatPrompt(ticker, companyName) {
  const today = new Date().toISOString().split('T')[0];

  return `Today's date is ${today}. You are a financial news analyst with web search capabilities. Search the web for the most recent news and developments about ${companyName} (${ticker}) from the last 72 hours ONLY. Prioritize any significant events from the last 24 hours.

IMPORTANT: Only include news dated ${today} or within the past 3 days. Ignore any older information. If you cannot find news from this timeframe, state that no recent news is available, and only in those cases, provide a more general summary of the company's recent performance and market sentiment.

Provide a concise summary (3-4 sentences, max 800 characters) focusing on:
1. Recent factual developments that may impact stock price (earnings, product launches, regulatory news, etc.)
2. Current market sentiment based on analyst opinions and market reactions

Important guidelines:
- Use web search to find the latest, most current information
- Be factual about numbers and events
- Provide cautious, balanced interpretation
- Do not make buy/sell recommendations
- Do not reference a recent specific price, we are getting that data elsewhere
- CRITICAL: Keep response under 800 characters (about 70-90 words). Be extremely concise.
- CRITICAL: Provide a plain text summary without any markdown, headers, numbering, bullet points, or special formatting (no bold, italics, underscores, or other text decorations).
- CRITICAL: NO preamble or follow-ups, NO citations, NO URLs, NO links.`;
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test -- tests/services/openai-responses.test.js
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git add src/services/openai-responses.js tests/services/openai-responses.test.js
git commit -m "feat: add OpenAI Responses API service with gpt-5.4 and web search"
```

---

## Task 3: Update commands and config

**Files:**
- Modify: `src/commands/stock.js`
- Modify: `src/commands/crypto.js`
- Modify: `src/config.js`

- [ ] **Step 1: Update `src/commands/stock.js`**

Change the import line (line 10):
```javascript
// Before:
import { generateAISummary } from '../services/perplexity.js';

// After:
import { generateAISummary } from '../services/openai-responses.js';
```

Change the variable name inside `fetchStockData` (line 121):
```javascript
// Before:
const perplexityApiKey = env.PERPLEXITY_API_KEY;

// After:
const openaiApiKey = env.OPENAI_API_KEY;
```

Update the usage of that variable (line 152):
```javascript
// Before:
generateAISummary(ticker, companyName, perplexityApiKey)

// After:
generateAISummary(ticker, companyName, openaiApiKey)
```

Update the log message (line 149):
```javascript
// Before:
console.log('[INFO] Fetching AI summary from Perplexity', { ticker });

// After:
console.log('[INFO] Fetching AI summary from OpenAI', { ticker });
```

- [ ] **Step 2: Update `src/commands/crypto.js`**

Same four changes as stock.js — import, variable name, usage, log message. The relevant lines are 11, 123, 160, and 163.

```javascript
// Import (line 11):
import { generateAISummary } from '../services/openai-responses.js';

// Variable (line 123):
const openaiApiKey = env.OPENAI_API_KEY;

// Log (line 160):
console.log('[INFO] Fetching AI summary from OpenAI', { symbol });

// Usage (line 163):
generateAISummary(symbol, displayName, openaiApiKey)
```

- [ ] **Step 3: Update `src/config.js`** — remove the `PERPLEXITY_TIMEOUT` entry and its JSDoc reference

In the JSDoc comment block, remove:
```javascript
 * @property {number} PERPLEXITY_TIMEOUT - API timeout for Perplexity requests in milliseconds
```

And also remove the inline comment on `OPENAI_TIMEOUT` that says "(deprecated, use PERPLEXITY_TIMEOUT)":
```javascript
// Before:
OPENAI_TIMEOUT: 30000,    // 30 seconds for AI summary with web search (deprecated, use PERPLEXITY_TIMEOUT)
PERPLEXITY_TIMEOUT: 30000, // 30 seconds for AI summary with web search

// After:
OPENAI_TIMEOUT: 30000,    // 30 seconds for AI summary with web search
```

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test
```

Expected: all tests pass with no failures.

- [ ] **Step 5: Commit everything together** (deletions from Task 1 + command/config changes)

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git add -A
git commit -m "feat: replace Perplexity with OpenAI Responses API (gpt-5.4 + web search)"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run the full test suite one more time from a clean state**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test
```

Expected: all tests pass.

- [ ] **Step 2: Confirm deleted files are gone**

```bash
ls src/services/
```

Expected output includes `openai-responses.js` and does NOT include `perplexity.js` or `openai.js`.

- [ ] **Step 3: Confirm no remaining references to Perplexity**

```bash
grep -r "perplexity\|PERPLEXITY" src/ --include="*.js"
```

Expected: no output.

- [ ] **Step 4: Remove `PERPLEXITY_API_KEY` from `wrangler.toml` if present**

```bash
grep -n "PERPLEXITY" wrangler.toml
```

If any lines are returned, remove them from `wrangler.toml`. Then commit:

```bash
git add wrangler.toml
git commit -m "chore: remove PERPLEXITY_API_KEY from wrangler config"
```

If no lines are returned, no action needed.
