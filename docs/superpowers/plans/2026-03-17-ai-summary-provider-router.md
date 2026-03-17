# AI Summary Provider Router Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a thin router so the AI summary provider (Perplexity or OpenAI) can be switched with one line in `config.js`, with both implementations kept in the codebase.

**Architecture:** Restore `perplexity.js` from `main`, add `AI_SUMMARY_PROVIDER` and `PERPLEXITY_TIMEOUT` to config, create `src/services/ai-summary.js` as a router that reads the config and delegates to the correct service. Commands import from the router and pass `env` directly instead of extracting an API key themselves.

**Tech Stack:** Vitest, Cloudflare Workers (native `fetch`), OpenAI SDK (Perplexity), OpenAI Responses API (raw fetch)

---

## File Map

| File | Action |
|------|--------|
| `src/services/perplexity.js` | Restore from `main` |
| `src/services/ai-summary.js` | Create — router |
| `src/config.js` | Add `AI_SUMMARY_PROVIDER`, `PERPLEXITY_TIMEOUT`, JSDoc entries |
| `src/commands/stock.js` | Update import + call signature |
| `src/commands/crypto.js` | Same |
| `tests/services/ai-summary.test.js` | Create — router tests |
| `tests/commands/stock.test.js` | Add `PERPLEXITY_API_KEY` to `mockEnv` |
| `tests/commands/crypto.test.js` | Same |
| `wrangler.toml` | Document `PERPLEXITY_API_KEY` secret |

---

## Task 1: Restore `perplexity.js` and update config

**Files:**
- Restore: `src/services/perplexity.js`
- Modify: `src/config.js`

- [ ] **Step 1: Restore `perplexity.js` from `main`**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git checkout main -- src/services/perplexity.js
```

- [ ] **Step 2: Verify it restored correctly**

```bash
head -5 src/services/perplexity.js
```

Expected: `// ABOUTME: Perplexity API client...`

- [ ] **Step 3: Add `AI_SUMMARY_PROVIDER` and `PERPLEXITY_TIMEOUT` to `src/config.js`**

Add the JSDoc entries:
```javascript
 * @property {string} AI_SUMMARY_PROVIDER - Active AI summary provider ('perplexity' or 'openai')
 * @property {number} PERPLEXITY_TIMEOUT - API timeout for Perplexity requests in milliseconds
```

In the `// API Timeouts` section, `OPENAI_TIMEOUT` already exists. Add `PERPLEXITY_TIMEOUT` on the line immediately after it (do NOT remove or replace `OPENAI_TIMEOUT`):
```javascript
  OPENAI_TIMEOUT: 30000,    // 30 seconds for AI summary with web search
  PERPLEXITY_TIMEOUT: 30000, // 30 seconds for AI summary with web search  ← ADD THIS LINE
  FINNHUB_TIMEOUT: 5000,    // ...existing line, stays unchanged
```

And add a new `// AI Provider` section after the timeouts:
```javascript
  // AI Provider
  AI_SUMMARY_PROVIDER: 'perplexity', // 'perplexity' or 'openai' — one line to switch
```

- [ ] **Step 4: Update `wrangler.toml` to document `PERPLEXITY_API_KEY`**

Add to the secrets comment block (after `OPENAI_API_KEY`):
```
#   wrangler secret put PERPLEXITY_API_KEY
```

And add to the description comments:
```
#   - PERPLEXITY_API_KEY: Perplexity API key for AI-powered news summaries (sonar model)
```

- [ ] **Step 5: Run the test suite to confirm nothing is broken yet**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test 2>&1 | tail -6
```

Expected: all tests pass (perplexity.js is restored but not yet wired up).

- [ ] **Step 6: Commit**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git add src/services/perplexity.js src/config.js wrangler.toml
git commit -m "chore: restore perplexity service, add AI_SUMMARY_PROVIDER config"
```

---

## Task 2: Create `ai-summary.js` router with tests (TDD)

**Files:**
- Create: `tests/services/ai-summary.test.js`
- Create: `src/services/ai-summary.js`

### Step 2a — Write failing tests

- [ ] **Step 1: Create the test file**

Write `tests/services/ai-summary.test.js`:

```javascript
// ABOUTME: Tests for AI summary router that delegates to Perplexity or OpenAI based on config
// ABOUTME: Mocks both provider modules to test routing logic in isolation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CONFIG } from '../../src/config.js';

// Mock both provider modules
vi.mock('../../src/services/perplexity.js', () => ({
  generateAISummary: vi.fn(),
}));
vi.mock('../../src/services/openai-responses.js', () => ({
  generateAISummary: vi.fn(),
}));

import { generateAISummary } from '../../src/services/ai-summary.js';
import { generateAISummary as perplexitySummary } from '../../src/services/perplexity.js';
import { generateAISummary as openaiSummary } from '../../src/services/openai-responses.js';

describe('AI Summary Router', () => {
  const mockEnv = {
    PERPLEXITY_API_KEY: 'test-perplexity-key',
    OPENAI_API_KEY: 'test-openai-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset config to default after each test
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
  });

  it('should delegate to Perplexity when provider is perplexity', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    perplexitySummary.mockResolvedValue('Perplexity summary.');

    const result = await generateAISummary('AAPL', 'Apple Inc.', mockEnv);

    expect(perplexitySummary).toHaveBeenCalledWith('AAPL', 'Apple Inc.', 'test-perplexity-key');
    expect(openaiSummary).not.toHaveBeenCalled();
    expect(result).toBe('Perplexity summary.');
  });

  it('should delegate to OpenAI when provider is openai', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'openai';
    openaiSummary.mockResolvedValue('OpenAI summary.');

    const result = await generateAISummary('NET', 'Cloudflare Inc.', mockEnv);

    expect(openaiSummary).toHaveBeenCalledWith('NET', 'Cloudflare Inc.', 'test-openai-key');
    expect(perplexitySummary).not.toHaveBeenCalled();
    expect(result).toBe('OpenAI summary.');
  });

  it('should throw immediately for an unknown provider', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'unknown-provider';

    await expect(
      generateAISummary('AAPL', 'Apple Inc.', mockEnv)
    ).rejects.toThrow('Unknown AI_SUMMARY_PROVIDER: unknown-provider');
  });

  it('should pass through errors from the provider', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    perplexitySummary.mockRejectedValue(new Error('Perplexity API timeout'));

    await expect(
      generateAISummary('AAPL', 'Apple Inc.', mockEnv)
    ).rejects.toThrow('Perplexity API timeout');
  });

  it('should pass undefined API key to provider when env key is missing', async () => {
    // The router is thin and does not guard against missing keys.
    // It passes undefined to the provider, which throws its own auth error.
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    const envWithoutKey = { OPENAI_API_KEY: 'test-openai-key' };
    perplexitySummary.mockResolvedValue('summary');

    await generateAISummary('AAPL', 'Apple Inc.', envWithoutKey);

    expect(perplexitySummary).toHaveBeenCalledWith('AAPL', 'Apple Inc.', undefined);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test -- tests/services/ai-summary.test.js 2>&1 | tail -8
```

Expected: `FAIL` — "Cannot find module '../../src/services/ai-summary.js'"

### Step 2b — Implement the router

- [ ] **Step 3: Create `src/services/ai-summary.js`**

```javascript
// ABOUTME: AI summary router — delegates to the configured provider (Perplexity or OpenAI)
// ABOUTME: Switch providers by changing CONFIG.AI_SUMMARY_PROVIDER in config.js

import { generateAISummary as perplexityGenerateAISummary } from './perplexity.js';
import { generateAISummary as openaiGenerateAISummary } from './openai-responses.js';
import { CONFIG } from '../config.js';

/**
 * Generate AI-powered news summary using the configured provider.
 * Switch providers by changing CONFIG.AI_SUMMARY_PROVIDER in src/config.js.
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {Object} env - Cloudflare Workers environment bindings
 * @returns {Promise<string>} AI-generated summary
 * @throws {Error} If provider is unknown or the provider call fails
 */
export async function generateAISummary(ticker, companyName, env) {
  if (CONFIG.AI_SUMMARY_PROVIDER === 'perplexity') {
    return perplexityGenerateAISummary(ticker, companyName, env.PERPLEXITY_API_KEY);
  }

  if (CONFIG.AI_SUMMARY_PROVIDER === 'openai') {
    return openaiGenerateAISummary(ticker, companyName, env.OPENAI_API_KEY);
  }

  throw new Error(`Unknown AI_SUMMARY_PROVIDER: ${CONFIG.AI_SUMMARY_PROVIDER}`);
}
```

- [ ] **Step 4: Run the router tests**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test -- tests/services/ai-summary.test.js 2>&1 | tail -8
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git add src/services/ai-summary.js tests/services/ai-summary.test.js
git commit -m "feat: add AI summary provider router"
```

---

## Task 3: Wire commands to the router

**Files:**
- Modify: `src/commands/stock.js` (lines 10, 121, 149, 152)
- Modify: `src/commands/crypto.js` (lines 11, 123, 160, 163)
- Modify: `tests/commands/stock.test.js`
- Modify: `tests/commands/crypto.test.js`

- [ ] **Step 1: Update `src/commands/stock.js`**

Change the import (line 10):
```javascript
// Before:
import { generateAISummary } from '../services/openai-responses.js';
// After:
import { generateAISummary } from '../services/ai-summary.js';
```

Remove the `openaiApiKey` variable (line 121) — no longer needed:
```javascript
// Before:
const openaiApiKey = env.OPENAI_API_KEY;
// After:
// (delete this line entirely)
```

Update the call (line 152) to pass `env` directly:
```javascript
// Before:
generateAISummary(ticker, companyName, openaiApiKey)
// After:
generateAISummary(ticker, companyName, env)
```

Update the log message (line 149):
```javascript
// Before:
console.log('[INFO] Fetching AI summary from OpenAI', { ticker });
// After:
console.log('[INFO] Fetching AI summary', { ticker, provider: CONFIG.AI_SUMMARY_PROVIDER });
```

- [ ] **Step 2: Update `src/commands/crypto.js`**

Same four changes (lines 11, 123, 160, 163):

```javascript
// Import (line 11):
import { generateAISummary } from '../services/ai-summary.js';

// Remove variable (line 123):
// delete: const openaiApiKey = env.OPENAI_API_KEY;

// Log (line 160):
console.log('[INFO] Fetching AI summary', { symbol, provider: CONFIG.AI_SUMMARY_PROVIDER });

// Call (line 163):
generateAISummary(symbol, displayName, env)
```

Also add the `CONFIG` import to `crypto.js` if not already present. Check line 14:
```javascript
import { CONFIG } from '../config.js';
```
(It's already there — no change needed.)

- [ ] **Step 3: Add `PERPLEXITY_API_KEY` to `mockEnv` in both test files**

In `tests/commands/stock.test.js`, find `mockEnv` (around line 22) and add the key:
```javascript
mockEnv = {
  RATE_LIMITS: mockKV,
  CACHE: mockKV,
  MASSIVE_API_KEY: 'test_massive_key',
  OPENAI_API_KEY: 'test_openai_key',
  PERPLEXITY_API_KEY: 'test_perplexity_key',  // add this line
  FINNHUB_API_KEY: 'test_finnhub_key',
};
```

Do the same in `tests/commands/crypto.test.js`.

- [ ] **Step 4: Run the full test suite**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test 2>&1 | tail -6
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
git add src/commands/stock.js src/commands/crypto.js tests/commands/stock.test.js tests/commands/crypto.test.js
git commit -m "feat: wire commands through AI summary router"
```

---

## Task 4: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot && npm test 2>&1 | tail -6
```

Expected: all tests pass.

- [ ] **Step 2: Confirm commands import from router (not direct providers)**

```bash
cd /Users/rian/Documents/GitHub/discord-stock-bot
grep -n "perplexity\|openai-responses" src/commands/stock.js src/commands/crypto.js
grep -n "ai-summary" src/commands/stock.js src/commands/crypto.js
```

Expected: first command — no output (no direct provider imports).
Expected: second command — two lines, one per file, each showing `import.*ai-summary.js`.

- [ ] **Step 3: Confirm the one-line switch works**

In `src/config.js`, the active line should read:
```javascript
AI_SUMMARY_PROVIDER: 'perplexity', // 'perplexity' or 'openai' — one line to switch
```

Changing `'perplexity'` to `'openai'` is the entire switch.
