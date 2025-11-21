# Discord Stock Bot - Implementation Prompt Plan

## Overview

This document provides a series of implementation prompts for building the Discord Stock Bot on Cloudflare Workers. Each prompt is designed to be test-driven, incremental, integrated, safe, and complete.

**Approach**: Write tests first → Implement → Integrate → Verify

---

## Step 0: Discord Bot Setup

```
Set up the Discord bot on Discord Developer Portal before starting development.

1. **Create Discord Application**:
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Name it "Stock Bot" (or your preferred name)
   - Click "Create"

2. **Configure Bot Settings**:
   - In left sidebar, click "Bot"
   - Click "Add Bot" → "Yes, do it!"
   - Under "Token", click "Reset Token" and copy it
   - Save as DISCORD_BOT_TOKEN (keep secret!)
   - Under "Privileged Gateway Intents": Leave all OFF (not needed for slash commands)
   - Under "Authorization Flow": Uncheck "Public Bot" if you want to control where it's added

3. **Get Application Credentials**:
   - Go to "General Information" in left sidebar
   - Copy "APPLICATION ID" → Save as DISCORD_APP_ID
   - Copy "PUBLIC KEY" → Save as DISCORD_PUBLIC_KEY
   - These will be used for verification and command registration

4. **Configure Bot Permissions**:
   - Go to "Bot" section
   - Under "Bot Permissions", select:
     ✓ Send Messages
     ✓ Embed Links
     ✓ Add Reactions
     ✓ Use Slash Commands (automatically included)
   - Note the permissions integer (e.g., 274877959168)

5. **Set Up OAuth2**:
   - Go to "OAuth2" → "URL Generator" in left sidebar
   - Under "Scopes", select:
     ✓ bot
     ✓ applications.commands
   - Under "Bot Permissions", select the same as step 4
   - Copy the generated URL at bottom
   - Use this URL to add bot to your test server

6. **Add Bot to Test Server**:
   - Open the OAuth2 URL from step 5 in browser
   - Select your test Discord server from dropdown
   - Click "Authorize"
   - Complete the CAPTCHA
   - Bot should now appear in your server (offline until deployed)

7. **Understand Interaction Endpoint**:
   - Go to "General Information"
   - Find "INTERACTIONS ENDPOINT URL" field
   - This will be set to your Cloudflare Worker URL after deployment
   - Format: https://your-worker.your-subdomain.workers.dev
   - DO NOT set this yet - wait until Worker is deployed (Step 20)
   - Discord will send a verification request when you first set this URL

8. **Store Credentials Securely**:
   Create a secure note with:
   - DISCORD_BOT_TOKEN: [your bot token]
   - DISCORD_PUBLIC_KEY: [your public key]
   - DISCORD_APP_ID: [your application id]
   - OAuth2 URL: [generated url]
   
   NEVER commit these to git! They will be added to .dev.vars locally and 
   Cloudflare secrets in production.

9. **Verify Setup**:
   - Bot appears in your server member list (offline)
   - You have all three credentials saved
   - OAuth2 URL is bookmarked for adding to more servers later

You're now ready to begin development. The Worker will handle Discord interactions
via the Interactions Endpoint URL once deployed.
```

**Notes**: 
- Keep your test server handy - you'll need it for testing slash commands in Step 20
- You'll also need Massive.com and OpenAI API keys later (Step 20), but Discord setup is the priority now

---

## Step 1: Project Setup

```
Create a Cloudflare Workers project with this structure:

1. Initialize: `npm init` and install dependencies
   - Dependencies: discord-interactions@^3.4.0, openai@^4.20.0
   - DevDeps: wrangler@^3.20.0, vitest@^1.0.0, @cloudflare/workers-types@^4.20231218.0

2. Create wrangler.toml with KV namespaces (RATE_LIMITS, CACHE)

3. Create src/config.js with all CONFIG constants from spec

4. Create .gitignore (node_modules/, .dev.vars, .wrangler/, dist/)

5. Setup vitest.config.js for Cloudflare Workers

6. Create directory structure: src/{commands,services,middleware,utils}/, tests/, scripts/

7. Add npm scripts: test, test:watch, dev, deploy

8. Create basic src/index.js with "Bot is running" response

Test that npm test and wrangler dev both work.
```

---

## Step 2: Validator Utility

```
Create ticker validator with TDD approach.

Write tests in tests/utils/validator.test.js:
- Valid uppercase tickers: AAPL, GOOGL, NET
- Lowercase conversion: aapl → AAPL
- Invalid: empty, numbers, special chars, too long (>10)
- Edge cases: whitespace trimming, null/undefined

Implement src/utils/validator.js:
export function validateTicker(ticker) {
  // Returns: { valid: boolean, ticker: string, error: string|null }
  // Rules: 1-10 letters only, uppercase, trimmed
}

All tests must pass before proceeding.
```

---

## Step 3: Error Handler

```
Create centralized error handling utility.

Write tests in tests/utils/errorHandler.test.js:
- Error type classification (INVALID_INPUT, RATE_LIMIT, API_FAILURE, etc.)
- Ephemeral flag always true
- User-friendly messages (no stack traces)
- Logging calls made

Implement src/utils/errorHandler.js:
export class BotError extends Error { ... }
export const ErrorTypes = { ... }
export function formatErrorResponse(error) { ... }
export function logError(error, context) { ... }

Error responses must be ephemeral (flags: 64) with helpful messages.
```

---

## Step 4: Chart Generator

```
Create ASCII sparkline generator with TDD.

Write tests in tests/utils/chartGenerator.test.js:
- Upward trend, downward trend, flat line, volatile
- Edge cases: single value, two values, empty array
- Negative values, small differences

Implement src/utils/chartGenerator.js:
const CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export function generateSparkline(prices) { ... }
export function formatChartWithLabels(prices) { 
  // Returns: "▁▃▅▆█\n$171.20 → $175.43"
}

Verify charts visually look correct for various patterns.
```

---

## Step 5: Embed Builder

```
Create Discord embed builder.

Write tests in tests/utils/embedBuilder.test.js:
- Color selection based on price change
- Embed structure validation
- All required fields present
- Partial data handling (missing AI summary)
- Footer formatting

Implement src/utils/embedBuilder.js:
export function getEmbedColor(changePercent) { ... }
export function buildStockEmbed(stockData, chart, aiSummary, marketOpen) { ... }
export function buildHelpEmbed() { ... }

Embeds must match Discord spec with proper colors and formatting.
```

---

## Step 6: Cache Manager

```
Create KV cache manager.

Write tests in tests/middleware/cache.test.js:
- Key generation for price, history, summary
- Get/set operations with TTL
- JSON serialization
- Error handling for KV failures
- Mock KV namespace

Implement src/middleware/cache.js:
export function generateCacheKey(type, ticker, days) { ... }
export async function getCached(kv, type, ticker, days) { ... }
export async function setCached(kv, type, ticker, value, days) { ... }
export function getTTL(type) { ... }

TTLs: price=300s, history=3600s, summary=28800s
```

---

## Step 7: Rate Limiter

```
Create rate limiter with KV storage.

Write tests in tests/middleware/rateLimit.test.js:
- First request allowed
- Second request within 60s blocked
- Request after 60s allowed
- Time remaining calculation
- Multiple users don't interfere
- KV error handling (fail open)

Implement src/middleware/rateLimit.js:
export async function checkRateLimit(kv, userId) { ... }
export async function updateRateLimit(kv, userId) { ... }
export async function enforceRateLimit(kv, userId) { ... }

Key format: ratelimit:{userId}, TTL: 60s
```

---

## Step 8: Massive.com Service

```
Create Massive.com API client.

Write tests in tests/services/massive.test.js:
- Successful quote and historical data fetch
- 404 handling (invalid ticker with suggestions)
- Timeout handling
- Retry logic with exponential backoff
- Response parsing

Implement src/services/massive.js:
export async function fetchQuote(ticker, apiKey) { ... }
export async function fetchHistoricalData(ticker, days, apiKey) { ... }
export function suggestTickers(ticker) { ... }

Use AbortController for timeout (10s), retry once on network errors.
Endpoints: /quote, /stock/candle
```

---

## Step 9: OpenAI Service

```
Create OpenAI API client for summaries.

Write tests in tests/services/openai.test.js:
- Successful summary generation
- Prompt formatting
- Timeout handling
- API error handling
- Response validation (2-4 sentences)

Implement src/services/openai.js:
export async function generateAISummary(ticker, companyName, apiKey) { ... }
export function formatPrompt(ticker, companyName) { ... }

Model: gpt-5-search-api, max_tokens: 10000, temperature: 0.3
On error: throw PARTIAL_FAILURE (don't fail entire request)
```

---

## Step 10: Discord Utilities

```
Create Discord-specific utilities.

Write tests in tests/services/discord.test.js:
- Signature verification
- Response formatting (type 4)
- Ephemeral flag handling
- Slash command parsing

Implement src/services/discord.js:
export async function verifyDiscordRequest(request, publicKey) { ... }
export function createInteractionResponse(data, ephemeral) { ... }
export function createEmbedResponse(embed, ephemeral) { ... }
export function parseSlashCommand(interaction) { ... }

Use discord-interactions library for verification.
```

---

## Step 11: Help Command

```
Create /help command handler.

Write tests in tests/commands/help.test.js:
- Help embed returned
- Correct structure
- All info included
- Not ephemeral

Implement src/commands/help.js:
export async function handleHelpCommand(interaction, env) {
  const embed = buildHelpEmbed();
  return createEmbedResponse(embed, false);
}

Simple command to verify integration works before complex /stock command.
```

---

## Step 12: Stock Command - Structure

```
Create stock command structure with validation and rate limiting.

Write tests in tests/commands/stock.test.js (Part 1):
- Ticker extraction
- Validation (pass/fail)
- Rate limiting (first pass, second block)
- Error responses

Implement src/commands/stock.js (skeleton):
export async function handleStockCommand(interaction, env) {
  // 1. Extract and validate ticker
  // 2. Enforce rate limit
  // 3. (Data fetching - next step)
  // 4. (Response formatting - next step)
}

Just structure and validation, no data fetching yet.
```

---

## Step 13: Stock Command - Data Fetching

```
Add data fetching to stock command.

Add tests for:
- Parallel cache reads
- Parallel API calls on cache miss
- Cache writes after fetch
- Partial failure handling

Extend src/commands/stock.js:
async function fetchStockData(ticker, env) {
  // Parallel: check all caches
  const [priceCache, historyCache, summaryCache] = await Promise.all([...]);
  
  // Fetch missing data in parallel
  const [price, history] = await Promise.all([...]);
  
  // Fetch AI summary (non-blocking, can fail)
  let summary = null;
  try { summary = await generateAISummary(...); } catch { ... }
  
  // Update caches in parallel
  
  return { price, history, summary };
}

Handle partial failures gracefully - show available data.
```

---

## Step 14: Stock Command - Response Building

```
Complete stock command with response formatting.

Add tests for:
- Full response with all data
- Response with missing AI summary
- Chart generation and labeling
- Color coding based on price change
- Market hours handling

Complete src/commands/stock.js:
async function buildStockResponse(stockData, chartData, aiSummary) {
  const chart = formatChartWithLabels(chartData);
  const color = getEmbedColor(stockData.changePercent);
  const embed = buildStockEmbed(stockData, chart, aiSummary, marketOpen);
  return createEmbedResponse(embed, false);
}

Integrate all utilities created earlier into complete response.
```

---

## Step 15: Main Worker Handler

```
Create main Cloudflare Worker entry point.

Write tests in tests/index.test.js:
- Discord signature verification
- PING/PONG handling (type 1)
- Command routing
- Error handling and logging
- Unauthorized requests rejected

Implement src/index.js:
export default {
  async fetch(request, env, ctx) {
    // 1. Verify Discord signature
    // 2. Parse request body
    // 3. Handle PING (type 1) -> PONG
    // 4. Route commands: /stock, /help
    // 5. Handle errors
    // 6. Log all interactions
  }
}

This wires everything together into working Worker.
```

---

## Step 16: Command Registration Script

```
Create script to register slash commands with Discord.

Implement scripts/register-commands.js:
import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

const commands = [
  {
    name: 'stock',
    description: 'Get stock price, trend, and AI summary',
    options: [{ name: 'ticker', description: 'Stock ticker (e.g., AAPL)', type: 3, required: true }]
  },
  {
    name: 'help',
    description: 'Show bot usage instructions',
    options: []
  }
];

// Register with Discord API
// Usage: DISCORD_TOKEN=xxx DISCORD_APP_ID=xxx node scripts/register-commands.js

Script should handle both guild and global command registration.
```

---

## Step 17: Integration Testing

```
Add integration tests that verify the full flow.

Create tests/integration/workflow.test.js:
- Mock all external dependencies (Discord, Massive.com, OpenAI, KV)
- Test complete /stock flow: validation → rate limit → fetch → cache → response
- Test /help flow
- Test error paths end-to-end
- Test cache hit scenarios
- Test partial failures

These tests verify all components work together correctly.
```

---

## Step 18: Documentation

```
Create comprehensive documentation.

1. README.md with:
   - Project description
   - Setup instructions (prerequisites, installation)
   - Configuration (secrets, KV namespaces)
   - Local development (wrangler dev)
   - Deployment (step-by-step)
   - Testing (npm test)
   - Usage examples

2. Update wrangler.toml with comments

3. Add JSDoc comments to all public functions

4. Create DEPLOYMENT.md with detailed deployment checklist

Documentation should enable a developer to set up and deploy without external help.
```

---

## Step 19: Performance Optimization

```
Add performance improvements and monitoring.

1. Implement request timing:
   - Log API response times
   - Log cache hit/miss metrics
   - Track end-to-end request duration

2. Optimize parallel operations:
   - Verify all cache reads are parallel
   - Verify API calls are parallel where possible
   - Add Promise.allSettled for non-critical operations

3. Add performance tests verifying:
   - Cached responses < 1s
   - Uncached responses < 3s

Document performance characteristics in README.
```

---

## Step 20: Final Testing & Deployment

```
Complete testing and prepare for production deployment with Discord integration.

**Pre-Deployment Checklist**:
1. Run full test suite: npm test
2. Verify all tests pass (100% passing)
3. Code review for security issues (no hardcoded secrets)

**Get External API Keys**:
4. Sign up for Massive.com: https://massive.com/
   - Free tier: 5 calls/minute
   - Copy API key → Save as MASSIVE_API_KEY

5. Get OpenAI API key: https://platform.openai.com/api-keys
   - Create new key → Save as OPENAI_API_KEY
   - Ensure billing is set up for gpt-5-search-api

**Cloudflare Setup**:
6. Login to Cloudflare: wrangler login

7. Create KV namespaces:
   ```bash
   wrangler kv:namespace create RATE_LIMITS
   wrangler kv:namespace create CACHE
   ```
   - Copy the namespace IDs from output
   - Update wrangler.toml with the actual IDs

8. Set production secrets (from Step 0):
   ```bash
   wrangler secret put DISCORD_BOT_TOKEN
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put FINNHUB_API_KEY
   wrangler secret put OPENAI_API_KEY
   ```

**Deploy Worker**:
9. Deploy to Cloudflare:
   ```bash
   wrangler deploy
   ```
   - Copy the deployed URL (e.g., https://discord-stock-bot.your-subdomain.workers.dev)
   - Save this URL - you'll need it for Discord

10. Test Worker is responding:
    ```bash
    curl https://discord-stock-bot.your-subdomain.workers.dev
    ```
    - Should return "Bot is running" or similar

**Configure Discord Interactions Endpoint**:
11. Go to Discord Developer Portal → Your Application → General Information

12. Set "INTERACTIONS ENDPOINT URL" to your Worker URL:
    - Enter: https://discord-stock-bot.your-subdomain.workers.dev
    - Click "Save Changes"
    - Discord will send a PING request to verify
    - If verification fails, check Worker logs for errors
    - Common issues: Wrong PUBLIC_KEY, signature verification bug

13. Verify endpoint:
    - Green checkmark should appear if successful
    - If it fails, check wrangler tail for error logs

**Register Slash Commands**:
14. Register commands with Discord:
    ```bash
    DISCORD_TOKEN=<bot_token> DISCORD_APP_ID=<app_id> node scripts/register-commands.js
    ```
    - This registers /stock and /help globally
    - Global commands take ~1 hour to propagate
    - For instant testing, register to specific guild (see script docs)

15. Wait for command propagation (or use guild commands for testing)

**Manual Testing in Discord**:
16. Open your Discord test server

17. Test /help command:
    - Type /help
    - Should show help embed immediately
    - Verify all information is correct

18. Test /stock command - Happy Path:
    - Type /stock AAPL
    - Should return stock data with chart and AI summary
    - Verify colors, formatting, data accuracy
    - Check response time (should be 1-3 seconds)

19. Test /stock command - Error Cases:
    - Invalid ticker: /stock INVALIDTICKER
    - Should show error with suggestions
    - Should be ephemeral (only you see it)

20. Test rate limiting:
    - Type /stock NET
    - Immediately type /stock AAPL (within 30 seconds)
    - Should get ⏰ emoji reaction
    - Should get ephemeral "wait XX seconds" message
    - Wait 30 seconds, try again - should work

21. Test caching:
    - Type /stock GOOGL (first query)
    - Wait 10 seconds
    - Type /stock GOOGL again
    - Second query should be faster (< 1 second)
    - Check logs for cache hit

**Monitor & Verify**:
22. Monitor Cloudflare Workers dashboard:
    - Check request count
    - Check error rate (should be near 0%)
    - Check response times

23. Check Cloudflare KV metrics:
    - Verify reads/writes happening
    - Check storage usage

24. View logs in real-time:
    ```bash
    wrangler tail
    ```
    - Test commands and watch logs
    - Verify [INFO], [WARN], [ERROR] messages appearing correctly

25. Test edge cases:
    - Query during market hours vs. after hours
    - Weekend queries (should show last Friday)
    - Very obscure tickers
    - Multiple users simultaneously (if possible)

**Production Readiness**:
26. Complete Definition of Done from spec.md:
    - [ ] Bot responds to /stock with complete data
    - [ ] Bot responds to /help correctly
    - [ ] Rate limiting works (1/min/user)
    - [ ] Caching works for all data types
    - [ ] Embeds display correctly with colors
    - [ ] ASCII charts render properly
    - [ ] AI summaries are 2-4 sentences
    - [ ] Error messages are helpful
    - [ ] All errors handled gracefully
    - [ ] Tests passing
    - [ ] Documentation complete
    - [ ] Logging captures events

27. Update README.md with:
    - Production Worker URL
    - Any known issues or limitations
    - Support/contact information

28. Optional - Add bot to more servers:
    - Use OAuth2 URL from Step 0
    - Share with trusted users first
    - Monitor usage and costs

**Rollback Plan** (if issues occur):
- Revert wrangler.toml to previous version
- Run: wrangler rollback
- Or disable bot by removing Interactions Endpoint URL in Discord

**Cost Monitoring**:
- Set up Cloudflare billing alerts
- Monitor OpenAI usage dashboard
- Track costs daily for first week

Deployment complete! Bot should now be live and responding to commands in Discord.
```

---

## Implementation Order Summary

1. **Discord Setup** (Step 0): Create bot, get credentials, configure permissions
2. **Foundation** (Steps 1-5): Project setup, utilities, formatters
3. **Infrastructure** (Steps 6-7): Caching, rate limiting  
4. **External Services** (Steps 8-10): Massive.com, OpenAI, Discord
5. **Commands** (Steps 11-14): Help, Stock (incremental)
6. **Integration** (Steps 15-17): Worker handler, registration, testing
7. **Finalization** (Steps 18-20): Docs, optimization, deployment

## Key Principles

- **Test-Driven**: Every component has tests before implementation
- **Incremental**: Each step builds on previous validated work
- **Integrated**: No orphaned code - everything is wired together
- **Safe**: Small enough to verify thoroughly
- **Complete**: Large enough to make meaningful progress

## Testing Strategy

- Unit tests for all utilities and services
- Mock external dependencies (KV, APIs, Discord)
- Integration tests for command flows
- Manual testing in Discord before production

## Success Criteria

- All automated tests passing
- Manual testing checklist complete
- Performance targets met (< 3s uncached, < 1s cached)
- Error handling graceful in all scenarios
- Documentation complete and accurate
- Successfully deployed to production
- Bot responding correctly in Discord
