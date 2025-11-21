# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Discord bot providing real-time stock and cryptocurrency information with AI-powered news summaries. Built on Cloudflare Workers for global edge deployment with sub-second response times.

**Key Features:**
- Real-time stock/crypto prices with 30-day trend visualization
- AI-powered news summaries using Perplexity SONAR with web search
- Multi-tier caching strategy (1min/5min/1hr/8hr TTLs)
- Rate limiting (60 seconds per user)
- Deferred response pattern for slow API calls (prevents 3-second timeout)

## Development Workflow

### Session Workflow

1. **CRITICAL FIRST STEP**: Read `README.md` to understand current project state
2. For each task:
   - Otherwise, provide an ELI5 explanation before starting implementation
   - Ensure tests pass and the program builds/runs
   - Commit changes with a clear commit message
3. After finishing each task, explain what was done and what should now be possible

### Coding Principles

**Simplicity & Maintainability:**
- Prefer simple, clean, maintainable solutions over clever or complex ones
- Prioritize readability and maintainability over conciseness or performance
- Write code that works today but can grow tomorrow
- Avoid premature optimization, but don't create architectural dead-ends

**Minimal Changes:**
- Make the smallest reasonable changes to achieve the desired outcome
- **MUST ask permission** before reimplementing features or systems from scratch instead of updating existing implementation
- **NEVER make code changes** unrelated to the current task
- If you notice unrelated issues, document them in `todo.md` with priority level (P0/P1/P2)

**Comments & Documentation:**
- Only remove comments that are demonstrably incorrect or misleading
- All code files must start with 2-line ABOUTME comments
- Avoid temporal references in comments (no "recently changed" or "refactored")
- Comments should be evergreen and describe code as it is, not how it evolved
- Update README.md and CLAUDE.md when adding features or changing how the project works

**Error Handling:**
- Handle errors gracefully with clear, actionable messages
- Fail fast for programming errors
- Recover gracefully for user/external errors

**Dependencies & Testing:**
- Minimize external dependencies (justify and document when adding new ones)
- Avoid mocks for core business logic
- Mocks are acceptable for external APIs during development

**Bug Fixing:**
- **NEVER throw away old implementation and rewrite** without explicit permission
- If considering a rewrite, **MUST STOP** and get explicit user permission first

**Naming Conventions:**
- **NEVER** name things as "improved", "new", "enhanced", etc.
- Code naming should be evergreen (what is new today will be old someday)

**Getting Help:**
- ALWAYS ask for clarification rather than making assumptions
- If stuck, stop and ask for help (especially for things the user might be better at)

### Testing Workflow

**Running Tests:**
- If a development server is needed, ask user to run `npm run dev`
- Ask user to run tests with `npm test` and provide output
- **NEVER ignore system output or test results** - they contain CRITICAL information
- If logs should contain errors, capture and test them

## Development Commands

### Testing
```bash
npm test                    # Run all tests once (280 tests)
npm run test:watch          # Run tests in watch mode
npm test -- tests/commands/stock.test.js  # Run specific test file
npm test -- --coverage      # Run with coverage report
```

### Local Development
```bash
npm run dev                 # Start local Wrangler dev server on :8787
wrangler tail               # Watch real-time production logs
wrangler tail | grep PERF   # Monitor performance metrics
wrangler tail | grep CACHE  # Monitor cache hit/miss rates
```

### Deployment
```bash
npm run deploy              # Deploy to Cloudflare Workers
wrangler secret put <NAME>  # Set production secrets
wrangler kv:key list --binding=CACHE           # List cache keys
wrangler kv:key get --binding=CACHE "stock:price:AAPL"  # Get cached value
```

### Discord Setup
```bash
# Register slash commands (after modifying command definitions)
DISCORD_TOKEN=<bot_token> DISCORD_APP_ID=<app_id> node scripts/register-commands.js
```

## Architecture Overview

### Request Flow
```
Discord → Cloudflare Worker → Command Router → Rate Limiter → Cache Layer → API Services → Response
```

**Critical Pattern: Deferred Responses**
- Stock and crypto commands use deferred responses (`InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE`)
- Immediate response: "thinking..." message to Discord (< 3 seconds)
- Background processing: Up to 45 seconds to fetch data via `ctx.waitUntil()`
- Follow-up message: Actual data sent via Discord webhook
- Timeout protection: Commands timeout after 45 seconds with user-friendly error

### Core Components

**Entry Point: `src/index.js`**
- Main Worker fetch handler
- Discord signature verification (skipped in DEV_MODE)
- Command routing (stock, crypto, help)
- Deferred response orchestration with timeout protection
- Global error handling

**Commands: `src/commands/`**
- `stock.js`: Stock ticker lookup with price, trend, AI summary
- `crypto.js`: Cryptocurrency lookup with price, trend, AI summary
- `help.js`: Usage instructions
- Pattern: Parse → Validate → Rate Limit → Fetch Data → Build Response

**Services: `src/services/`**
- `massive.js`: Historical stock data (Massive.com API, formerly Polygon.io)
- `massiveCrypto.js`: Historical crypto data (Massive.com API)
- `finnhub.js`: Real-time stock quotes & market status (Finnhub API)
- `finnhubCrypto.js`: Real-time crypto quotes (Finnhub API)
- `openai.js`: AI news summaries with web search (OpenAI gpt-4o-mini)
- `discord.js`: Discord interaction utilities (signature verification, deferred responses, follow-ups)

**Middleware: `src/middleware/`**
- `rateLimit.js`: 30-second rate limit per user (KV-based)
- `cache.js`: Multi-tier caching with different TTLs per data type

**Utils: `src/utils/`**
- `chartGenerator.js`: ASCII sparkline charts (30-day trends)
- `embedBuilder.js`: Discord rich embeds with color coding
- `errorHandler.js`: BotError class with typed errors (INVALID_INPUT, RATE_LIMIT, NOT_FOUND, API_FAILURE, UNKNOWN)
- `validator.js`: Stock ticker validation (1-5 uppercase letters)
- `cryptoValidator.js`: Crypto symbol validation with mapping (BTC → Bitcoin)

## Configuration (`src/config.js`)

**Rate Limiting:**
- `RATE_LIMIT_SECONDS: 30` - User cooldown between queries

**Cache TTLs:**
- `CACHE_TTL_MARKET_STATUS: 60` - Market status/price (1 minute)
- `CACHE_TTL_PRICE: 300` - Stock prices (5 minutes)
- `CACHE_TTL_HISTORY: 3600` - Historical data (1 hour)
- `CACHE_TTL_SUMMARY: 28800` - AI summaries (8 hours)
- `CACHE_TTL_COMPANY_PROFILE: 259200` - Company names (3 days)

**API Timeouts:**
- `MASSIVE_TIMEOUT: 10000` - Massive.com (10s)
- `FINNHUB_TIMEOUT: 5000` - Finnhub (5s)
- `OPENAI_TIMEOUT: 30000` - OpenAI (30s)
- `COMMAND_TIMEOUT: 45000` - Overall command timeout (45s)

## Caching Strategy

**Four-Tier System:**
1. Market Status (1 min) - Real-time detection needs frequent updates
2. Stock Prices (5 min) - Balance between real-time and API costs
3. Historical Data (1 hour) - Changes infrequently
4. AI Summaries (8 hours) - Most expensive, news doesn't change minute-to-minute

**Cache Keys:**
```javascript
`stock:price:${ticker}`              // TTL: 5 min
`stock:history:${ticker}:${days}`    // TTL: 1 hour
`stock:summary:${ticker}`            // TTL: 8 hours
`stock:market_status:${ticker}`      // TTL: 1 min
`stock:company_profile:${ticker}`    // TTL: 3 days
```

**Pattern:**
```javascript
// 1. Check all caches in parallel
const [cachedHistory, cachedSummary, ...] = await Promise.all([...]);

// 2. Fetch missing data from APIs in parallel
const fetchPromises = [];
if (!cachedHistory) fetchPromises.push(fetchHistoricalData(...));
if (!cachedSummary) fetchPromises.push(generateAISummary(...));
const results = await Promise.all(fetchPromises);

// 3. Update caches in parallel (fire and forget)
Promise.all([setCached(...), ...]).catch(error => console.warn(...));
```

## Testing Patterns

**Test Structure:**
- Use Vitest with `describe` and `it` blocks
- Mock KV namespaces: `{ get: vi.fn(), put: vi.fn(), delete: vi.fn() }`
- Mock environment: `{ RATE_LIMITS: mockKV, CACHE: mockKV, MASSIVE_API_KEY: '...' }`
- Test error cases and edge cases thoroughly
- Current: 280 tests (269 unit, 11 integration)

**Running Tests:**
```bash
npm test                              # All tests
npm test -- tests/commands/stock.test.js  # Specific file
npm run test:watch                    # Watch mode
```

## Code Style & Conventions

**File Headers:**
Every file starts with ABOUTME comments:
```javascript
// ABOUTME: Brief description of file purpose
// ABOUTME: Key responsibilities or patterns
```

**Function Documentation:**
Use JSDoc for exported functions:
```javascript
/**
 * Brief description
 * @param {string} ticker - Parameter description
 * @param {Object} env - Environment description
 * @returns {Promise<Object>} Return value description
 * @throws {BotError} Error conditions
 */
export async function handleStockCommand(interaction, env) { ... }
```

**Error Handling:**
- Always use `BotError` for user-facing errors
- Error types: `ErrorTypes.INVALID_INPUT`, `ErrorTypes.RATE_LIMIT`, `ErrorTypes.NOT_FOUND`, `ErrorTypes.API_FAILURE`, `ErrorTypes.UNKNOWN`
- Log errors with context: `console.error('[ERROR] Message', { ticker, userId, error })`
- Use `formatErrorResponse(error)` to convert BotError to Discord response

**Logging Conventions:**
- `[INFO]` - Normal operations
- `[WARN]` - Non-critical issues (cache miss, optional feature failed)
- `[ERROR]` - Critical failures
- `[PERF]` - Performance metrics (API response times)
- `[CACHE HIT/MISS]` - Cache operations
- Include context: `{ ticker, userId, duration: '123ms' }`

**Async Patterns:**
- Use `Promise.all()` for parallel operations (cache checks, API calls)
- Use `Promise.race()` for timeout protection
- Use `ctx.waitUntil()` for background operations in Workers
- Fire-and-forget for cache updates: `Promise.all([...]).catch(error => console.warn(...))`

## Environment Variables

**Required Secrets (set via `wrangler secret put <NAME>`):**
- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_PUBLIC_KEY` - Discord application public key (signature verification)
- `MASSIVE_API_KEY` - Massive.com API key (historical data)
- `FINNHUB_API_KEY` - Finnhub API key (real-time quotes)
- `OPENAI_API_KEY` - OpenAI API key (AI summaries)

**Optional:**
- `DEV_MODE=true` - Skip signature verification in local development (set in `.dev.vars`)

**Local Development (`.dev.vars` file - never commit):**
```bash
DISCORD_BOT_TOKEN=your_token
DISCORD_PUBLIC_KEY=your_key
MASSIVE_API_KEY=your_key
FINNHUB_API_KEY=your_key
OPENAI_API_KEY=your_key
DEV_MODE=true
```

## Cloudflare Workers Specifics

**KV Namespaces:**
- `RATE_LIMITS` - User rate limit timestamps (60s TTL)
- `CACHE` - Stock/crypto data cache (variable TTLs)

**Entry Point:**
```javascript
export default {
  async fetch(request, env, ctx) {
    // env: Contains KV bindings and secrets
    // ctx: Worker context (use ctx.waitUntil() for background work)
  }
}
```

**Important Constraints:**
- Workers have a 50ms CPU time limit (use async I/O)
- KV has eventual consistency (usually < 60 seconds)
- Use `ctx.waitUntil()` for non-blocking background tasks
- Deferred responses allow up to 15 minutes for processing

## Common Development Tasks

### Adding a New Command
1. Create handler in `src/commands/new-command.js`
2. Export `handleNewCommand(interaction, env)`
3. Add route in `src/index.js` switch statement
4. Use deferred response if command may be slow (>3s)
5. Register command with Discord: Update `scripts/register-commands.js`
6. Write tests in `tests/commands/new-command.test.js`

### Adding a New API Service
1. Create service file in `src/services/new-service.js`
2. Add timeout constant in `src/config.js`
3. Implement with timeout protection and error handling
4. Add caching in command handler if needed
5. Add corresponding secret to `wrangler.toml` documentation
6. Write tests in `tests/services/new-service.test.js`

### Modifying Cache TTLs
1. Update constants in `src/config.js`
2. Existing cached data will expire naturally
3. No cache invalidation needed

### Debugging Production Issues
```bash
wrangler tail                    # Live logs
wrangler tail | grep ERROR       # Filter errors
wrangler tail | grep "ticker:"   # Search for specific ticker
wrangler kv:key list --binding=CACHE  # Inspect cache contents
wrangler kv:key get --binding=CACHE "stock:price:AAPL"  # Get specific cached value
```

## API Usage & Costs

**Massive.com (Historical Data):**
- Free tier: 5 calls/minute
- Used for: 30-day historical price data
- Cache: 1 hour TTL

**Finnhub (Real-time Quotes):**
- Free tier: 60 calls/minute
- Used for: Current price, market status
- Cache: 1 minute TTL

**OpenAI (AI Summaries):**
- Pay-per-token (~$0.01-0.05 per request with gpt-4o-mini)
- Used for: News summaries with web search
- Cache: 8 hours TTL (most expensive, longest cache)

**Cost Optimization:**
- Rate limiting (30s/user) reduces API calls
- Aggressive caching (especially for AI summaries)
- Parallel fetching reduces latency, not cost
- Fire-and-forget cache updates don't block responses

## Troubleshooting

**Bot not responding:**
- Verify Interactions Endpoint URL in Discord Developer Portal
- Check worker logs: `wrangler tail`
- Ensure all secrets are set: `wrangler secret list`

**Rate limit errors:**
- By design: 60 seconds per user (Cloudflare KV minimum TTL requirement)
- Check rate limit logic in `src/middleware/rateLimit.js`

**API timeouts:**
- Check service timeouts in `src/config.js`
- Monitor performance: `wrangler tail | grep PERF`
- Commands timeout after 45 seconds with user-friendly error

**Cache not working:**
- Check KV namespace IDs in `wrangler.toml`
- Monitor cache operations: `wrangler tail | grep CACHE`
- KV has eventual consistency (~60s max delay)

**Tests failing:**
- Ensure all mocks are set up correctly
- Check for unhandled promise rejections
- Run single test file for debugging: `npm test -- tests/path/to/test.js`
