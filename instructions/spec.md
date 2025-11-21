# Discord Stock Bot - Technical Specification

## 1. Project Overview

A Discord bot deployed on Cloudflare Workers that provides stock information, price trends, and AI-powered news summaries through slash commands.

### 1.1 Core Features
- Stock price lookup via slash command (previous close price)
- 30-day price trend visualization (ASCII sparkline)
- AI-generated news summary with sentiment analysis
- Rate limiting per user
- Smart caching to optimize API costs
- Rich Discord embeds with color-coded responses

---

## 2. User Interface & Interaction

### 2.1 Commands

#### `/stock <ticker>`
Primary command for stock lookups.

**Parameters:**
- `ticker` (required, string): Stock ticker symbol (e.g., "AAPL", "NET")

**Example Usage:**
```
/stock AAPL
/stock NET
```

**Future Extension Point:**
Architecture should support adding optional `period` parameter later (e.g., `/stock AAPL period:30d`)

#### `/help`
Displays bot usage instructions, rate limits, and data sources.

**Response includes:**
- Available commands
- Rate limit information
- Data source attribution (Massive.com)
- Example usage

### 2.2 Response Format

**Rich Discord Embed:**
- **Color coding:**
  - Green: Positive price movement
  - Red: Negative price movement
  - Gray: No change or markets closed
- **Embed fields:**
  1. **Current Price:** `$XXX.XX` with percentage change
  2. **30-Day Trend:** ASCII sparkline with start/end values
  3. **Market Status:** "Market Open" or "Last Close: [timestamp]"
  4. **AI Summary:** 2-4 sentence news summary with markdown formatting
- **Footer:** Data sources and timestamp

**Example Response Structure:**
```
┌─────────────────────────────────────┐
│ 📊 AAPL - Apple Inc.                │
│ ──────────────────────────────────  │
│ Current Price: $175.43 (+2.3%)      │
│ 30-Day Trend: ▁▂▃▅▆▇█               │
│ $171.20 → $175.43                   │
│                                     │
│ 📰 News & Sentiment                 │
│ Apple's Q4 earnings exceeded...     │
│ [2-4 sentence AI summary]           │
│ ──────────────────────────────────  │
│ Data: Massive.com • 2:45 PM ET       │
└─────────────────────────────────────┘
```

### 2.3 Error Handling - User-Facing

#### Invalid Ticker
**Trigger:** User enters non-existent or malformed ticker
**Response:** Ephemeral embed (visible only to user)
- Clear error message
- Suggestions for common alternatives or similar tickers
- Example: "Ticker 'APPL' not found. Did you mean 'AAPL'?"

#### Rate Limit Hit
**Trigger:** User exceeds 1 query per minute
**Response:**
- React to command with ⏰ emoji
- Ephemeral message: "You're querying too quickly! Please wait XX seconds before trying again."

#### Partial Data Failure
**Trigger:** Some data sources succeed, others fail (e.g., stock data loads but AI summary fails)
**Response:**
- Display all available data
- Add note in affected section: "⚠️ [Service] unavailable - showing cached data" or "⚠️ Unable to fetch [data type]"

#### Complete Failure
**Trigger:** All data sources fail or critical error
**Response:** Ephemeral embed with specific error
- "Unable to fetch stock data. Please try again later."
- Do not expose internal errors to users

---

## 3. Technical Architecture

### 3.1 Platform: Cloudflare Workers

**Why Cloudflare Workers:**
- Edge computing for low latency
- Built-in scaling
- Integrated KV storage
- Generous free tier
- Simple deployment

**Runtime:** JavaScript/TypeScript on V8 isolates

### 3.2 System Components

```
┌─────────────────────────────────────────────────────┐
│                  Discord Platform                    │
└────────────────────┬────────────────────────────────┘
                     │ Slash Command
                     ↓
┌─────────────────────────────────────────────────────┐
│         Cloudflare Worker (Main Handler)            │
│  ┌──────────────────────────────────────────────┐  │
│  │  1. Command Router                           │  │
│  │  2. Rate Limiter (KV Check)                  │  │
│  │  3. Cache Layer (KV Read)                    │  │
│  │  4. Data Orchestrator                        │  │
│  │     - Stock Price Service                    │  │
│  │     - Historical Data Service                │  │
│  │     - AI Summary Service                     │  │
│  │  5. Response Formatter                       │  │
│  │  6. Error Handler                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │                │                 │
         ↓                ↓                 ↓
    ┌──────────┐    ┌──────────┐    ┌──────────────┐
    │ Massive  │    │Perplexi │    │ Cloudflare   │
    │   .com   │    │  ty     │    │      KV      │
    │   API    │    │ SONAR   │    │   Storage    │
    └──────────┘    └──────────┘    └──────────────┘
```

### 3.3 Data Flow

**Successful Request Flow:**
1. Discord sends slash command to Worker
2. Worker validates and parses command
3. Rate limiter checks user's last request time (KV lookup)
4. If rate limited: return error, else continue
5. Check cache for all three data types (parallel KV reads)
6. For cache misses, fetch from external APIs (parallel when possible)
7. Generate AI summary if needed (with web search)
8. Format response as rich embed
9. Store/update cache entries (parallel KV writes)
10. Return formatted response to Discord
11. Log metrics to Cloudflare Analytics

---

## 4. External Services & APIs

### 4.1 Stock Data: Massive.com

**API:** https://massive.com/ (formerly Polygon.io)
**Free Tier:** 5 API calls/minute
**Authentication:** API key in request headers or query parameters

**Endpoints Used:**

1. **Previous Day Quote:** `GET /v2/aggs/ticker/{ticker}/prev`
   - Returns: previous trading day's OHLC data (open, high, low, close)
   - Note: This provides previous close price, not real-time intraday data
   - Cache: 5 minutes

2. **Historical Data:** `GET /v2/aggs/ticker/{ticker}/range/1/day/{from}/{to}`
   - Parameters: ticker, date range (7 days)
   - Returns: Array of daily bars with closing prices
   - Cache: 1 hour

**Error Handling:**
- Timeout: 10 seconds
- Retry: 1 attempt with exponential backoff
- Fallback: Return cached data if available, else fail gracefully

### 4.2 AI Summary: Perplexity

**Model:** `sonar`
**Features:** Web search enabled for recent news via SONAR model

**Prompt Template:**
```
You are a financial news analyst. Search the web for recent news about [COMPANY_NAME] ([TICKER]) and provide 
a concise 2-4 sentence summary focusing on:
1. Recent factual developments that may impact stock price
2. Current market sentiment (cautious interpretation, not bold predictions)

Note: Price data shown is from the previous trading day's close, not real-time.
Be factual about numbers and events. Provide cautious, balanced interpretation. 
Do not make buy/sell recommendations.
```

**Configuration:**
- Max tokens: 800
- Cache: 8 hours
- Timeout: 30 seconds

**Error Handling:**
- If fails: Show stock data without summary + note
- Log error details to console

### 4.3 Discord Bot API

**Interaction Type:** Slash commands via Discord Interactions API
**Webhook:** Cloudflare Worker receives POST requests from Discord

**Required Bot Permissions:**
- Send Messages
- Use Slash Commands
- Embed Links
- Add Reactions

**Authentication:**
- Verify request signature from Discord
- Use bot token for API responses

---

## 5. Data Storage: Cloudflare KV

### 5.1 KV Namespace: Rate Limits

**Key Format:** `ratelimit:{user_id}`
**Value:** Timestamp of last request (Unix epoch ms)
**TTL:** 60 seconds (automatic expiry)

**Logic:**
```javascript
const key = `ratelimit:${userId}`;
const lastRequest = await KV.get(key);
const now = Date.now();

if (lastRequest && (now - parseInt(lastRequest)) < 60000) {
  // Rate limited
  return errorResponse(timeRemaining);
}

// Allow request, update timestamp
await KV.put(key, now.toString(), { expirationTtl: 60 });
```

### 5.2 KV Namespace: Cache

**Stock Price Cache:**
- Key: `stock:price:{ticker}`
- Value: JSON object with price data
- TTL: 300 seconds (5 minutes)

**Historical Data Cache:**
- Key: `stock:history:{ticker}:{days}`
- Value: JSON array of closing prices
- TTL: 3600 seconds (1 hour)

**AI Summary Cache:**
- Key: `stock:summary:{ticker}`
- Value: Plain text summary
- TTL: 28800 seconds (8 hours)

---

## 6. Configuration Management

### 6.1 Secrets (Cloudflare Workers Secrets)

**Never commit these to version control.**

Store via CLI:
```bash
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put FINNHUB_API_KEY
wrangler secret put OPENAI_API_KEY
```

**Access in code:**
```javascript
env.DISCORD_BOT_TOKEN
env.FINNHUB_API_KEY
env.OPENAI_API_KEY
```

### 6.2 Configuration File (Safe to Commit)

**File:** `config.js` or constants in code

**Settings:**
```javascript
export const CONFIG = {
  // Rate Limiting
  RATE_LIMIT_SECONDS: 60,
  
  // Cache TTLs (seconds)
  CACHE_TTL_PRICE: 300,        // 5 minutes
  CACHE_TTL_HISTORY: 3600,     // 1 hour
  CACHE_TTL_SUMMARY: 28800,    // 8 hours
  
  // Stock Data
  DEFAULT_PERIOD_DAYS: 7,      // Future: make configurable per command
  
  // API Timeouts (milliseconds)
  FINNHUB_TIMEOUT: 10000,
  OPENAI_TIMEOUT: 15000,
  
  // Market Configuration
  SUPPORTED_MARKETS: ['US'],   // Future: add international
  
  // Display
  CHART_HEIGHT: 7,             // ASCII chart resolution
  EMBED_COLOR_POSITIVE: 0x00ff00,  // Green
  EMBED_COLOR_NEGATIVE: 0xff0000,  // Red
  EMBED_COLOR_NEUTRAL: 0x808080,   // Gray
};
```

### 6.3 wrangler.toml (Safe to Commit)

**File:** Configuration for Cloudflare Workers deployment

```toml
name = "discord-stock-bot"
main = "src/index.js"
compatibility_date = "2024-01-01"

# KV Namespaces
[[kv_namespaces]]
binding = "RATE_LIMITS"
id = "your_rate_limit_namespace_id"

[[kv_namespaces]]
binding = "CACHE"
id = "your_cache_namespace_id"

# Environment variables (non-secret)
[vars]
ENVIRONMENT = "production"
```

---

## 7. Error Handling & Logging

### 7.1 User-Facing Errors

All user errors should be:
- **Ephemeral** (only visible to the user who triggered command)
- **Specific** but not exposing internal details
- **Actionable** (tell user what to do)

**Error Categories:**
1. Invalid input (bad ticker)
2. Rate limiting
3. Service unavailable
4. Partial failures
5. Unknown errors

### 7.2 Backend Logging

**Use Cloudflare Workers built-in observability:**

```javascript
console.log('[INFO] Stock lookup', { ticker, userId, cached });
console.warn('[WARN] Cache miss', { key, reason });
console.error('[ERROR] API failure', { 
  service: 'Massive.com', 
  error: error.message,
  ticker,
  timestamp: new Date().toISOString()
});
```

**Log Levels:**
- `INFO`: Successful operations, cache hits
- `WARN`: Cache misses, retry attempts, fallbacks
- `ERROR`: API failures, validation errors, unexpected exceptions

**Metrics to Track:**
- Request count per ticker
- Cache hit/miss rates
- API response times
- Error rates by type
- Rate limit hits

---

## 8. Market Hours & Stock Exchange Handling

### 8.1 US Market Hours

**Regular Trading:** 9:30 AM - 4:00 PM ET, Monday-Friday
**Closed:** Weekends and US market holidays

### 8.2 Outside Market Hours Behavior

**Current Limitation:**
- Bot always shows previous trading day's close price (not real-time intraday)
- This is because we use the `/prev` endpoint which returns previous day aggregate data
- Add timestamp to indicate when data is from
- Color coding still reflects day-over-day change
- Trend chart shows previous 7 trading days
- AI summary still attempts to fetch latest news

**Implementation:**
- Massive.com `/prev` endpoint always returns previous complete trading day
- Display should clarify this is "Previous Close" not "Current Price"
- Track timestamp from API response to show data freshness

### 8.3 Future: International Markets

**Architecture considerations:**
- Ticker format varies by exchange (e.g., "0700.HK" for Hong Kong)
- Different trading hours and holidays
- Design ticker validation to support exchange prefixes/suffixes
- Prepare for timezone handling in display

---

## 9. Performance & Optimization

### 9.1 Caching Strategy

**Three-tier caching:**

1. **Stock Prices (5 min):** Balance real-time data with API costs
2. **Historical Data (1 hour):** Changes infrequently, safe to cache longer
3. **AI Summaries (8 hours):** Most expensive, news doesn't change minute-to-minute

**Cache Key Design:**
- Include ticker symbol
- Future: include period/timeframe for historical data
- Use consistent naming convention

### 9.2 Parallel Operations

**Fetch data in parallel when possible:**
```javascript
const [priceData, historyData, cachedSummary] = await Promise.all([
  getStockPrice(ticker),
  getHistoricalData(ticker, days),
  getCachedSummary(ticker)
]);
```

**Benefits:**
- Reduced latency
- Better user experience
- Efficient use of Worker execution time

### 9.3 API Rate Limits

**Massive.com Free Tier:** 5 calls/minute
**Strategy:**
- Cache aggressively
- User rate limiting (1/min/user) naturally limits total requests
- Monitor usage via logging
- Consider implementing circuit breaker for API failures

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Test Framework:** Vitest (works well with Cloudflare Workers)

**Core Functions to Test:**

1. **Command Parser**
   - Valid ticker symbols
   - Invalid formats
   - Edge cases (lowercase, special chars)

2. **Rate Limiter**
   - First request (allow)
   - Second request within 60s (block)
   - Request after 60s (allow)
   - Mock KV storage

3. **Chart Generator**
   - ASCII sparkline generation
   - Handle various price trends (up, down, flat, volatile)
   - Start/end value display

4. **Response Formatter**
   - Embed structure
   - Color selection logic (positive/negative/neutral)
   - Markdown formatting in AI summary

5. **Cache Manager**
   - TTL calculation
   - Key generation
   - Fetch/store operations (mocked)

6. **Error Handler**
   - Different error types map to correct user messages
   - Ephemeral flag set correctly
   - Logging calls made

**Mock External Dependencies:**
- Massive.com API responses (success, failure, timeout)
- Perplexity API responses
- KV storage operations
- Discord API interactions

### 10.2 Manual Testing Checklist

**Setup:**
- [ ] Bot registered on Discord Developer Portal
- [ ] Slash commands registered
- [ ] Bot added to test server with correct permissions
- [ ] All secrets configured in Cloudflare

**Happy Path:**
- [ ] `/stock AAPL` returns complete data
- [ ] `/stock NET` returns complete data
- [ ] `/help` displays correct information
- [ ] Embed colors match price direction
- [ ] ASCII chart renders correctly
- [ ] AI summary is 2-4 sentences

**Error Cases:**
- [ ] Invalid ticker shows error with suggestions
- [ ] Rate limit triggers after 2 quick requests
- [ ] Rate limit message is ephemeral
- [ ] ⏰ emoji reaction appears on rate limited command

**Edge Cases:**
- [ ] Query during market hours vs. after hours
- [ ] Weekend queries show last Friday close
- [ ] Very long ticker symbols
- [ ] Ticker with special characters

**Performance:**
- [ ] Response time < 3 seconds (first query)
- [ ] Response time < 1 second (cached query)
- [ ] Check Cloudflare logs for errors
- [ ] Verify cache hit rates in logs

---

## 11. Deployment & Development

### 11.1 Local Development

**Prerequisites:**
- Node.js 18+
- Wrangler CLI: `npm install -g wrangler`

**Setup:**
```bash
# Clone repository
git clone <repo-url>
cd discord-stock-bot

# Install dependencies
npm install

# Set up local secrets (for testing)
# Create .dev.vars file (NEVER commit this)
echo "DISCORD_BOT_TOKEN=your_token" > .dev.vars
echo "FINNHUB_API_KEY=your_key" >> .dev.vars
echo "OPENAI_API_KEY=your_key" >> .dev.vars

# Create KV namespaces for local dev
wrangler kv:namespace create RATE_LIMITS
wrangler kv:namespace create CACHE

# Run local development server
wrangler dev
```

**Local Testing:**
- Use Discord's slash command test endpoint
- Or set up test Discord server pointing to local Worker
- Use `wrangler tail` to view logs in real-time

### 11.2 Production Deployment

**Prerequisites:**
- Cloudflare account with Workers enabled
- Discord bot created and configured

**Deployment Steps:**

```bash
# 1. Create production KV namespaces
wrangler kv:namespace create RATE_LIMITS
wrangler kv:namespace create CACHE

# 2. Update wrangler.toml with namespace IDs

# 3. Set production secrets
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put DISCORD_PUBLIC_KEY
wrangler secret put FINNHUB_API_KEY
wrangler secret put OPENAI_API_KEY

# 4. Deploy
wrangler deploy

# 5. Register slash commands with Discord
# (Run registration script with production worker URL)
node scripts/register-commands.js
```

**Post-Deployment:**
- Test bot in Discord server
- Monitor Cloudflare Workers dashboard for errors
- Check KV storage metrics
- Verify logs in Cloudflare Analytics

---

## 12. Project Structure

```
discord-stock-bot/
├── src/
│   ├── index.js                 # Main Worker entry point
│   ├── commands/
│   │   ├── stock.js             # /stock command handler
│   │   └── help.js              # /help command handler
│   ├── services/
│   │   ├── massive.js           # Massive.com API client
│   │   ├── perplexity.js        # Perplexity API client
│   │   └── discord.js           # Discord API utilities
│   ├── middleware/
│   │   ├── rateLimit.js         # Rate limiting logic
│   │   └── cache.js             # Cache management
│   ├── utils/
│   │   ├── chartGenerator.js    # ASCII sparkline generator
│   │   ├── embedBuilder.js      # Discord embed formatter
│   │   ├── errorHandler.js      # Centralized error handling
│   │   └── validator.js         # Input validation
│   └── config.js                # Configuration constants
├── scripts/
│   └── register-commands.js     # Discord slash command registration
├── tests/
│   ├── commands/
│   ├── services/
│   ├── middleware/
│   └── utils/
├── .gitignore
├── package.json
├── wrangler.toml                # Cloudflare Workers config
├── README.md                    # Setup and usage instructions
└── spec.md                      # This file
```

---

## 13. Security Considerations

### 13.1 Secret Management
- ✅ All API keys stored as Cloudflare Workers secrets
- ✅ Never log secrets or tokens
- ✅ `.dev.vars` in `.gitignore`
- ✅ `wrangler.toml` contains no secrets

### 13.2 Discord Request Verification
- Verify request signature from Discord using `DISCORD_PUBLIC_KEY`
- Reject unsigned or invalid requests
- Prevents unauthorized API calls to Worker

### 13.3 Input Validation
- Sanitize ticker symbols (alphanumeric only, max length)
- Prevent injection attacks via user input
- Validate all command parameters

### 13.4 Rate Limiting
- Per-user rate limiting prevents abuse
- Protects against API quota exhaustion
- Reduces costs from malicious usage

---

## 14. Future Enhancements

**Not in MVP, but architected for:**

1. **Configurable Time Periods**
   - Add optional `period` parameter to `/stock` command
   - Support 1d, 1w, 1m, 3m, 1y, etc.

2. **International Markets**
   - Support LSE, TSE, HKEX, etc.
   - Handle different ticker formats
   - Multiple timezones

3. **Additional Commands**
   - `/compare AAPL GOOGL` - compare multiple stocks
   - `/watchlist` - user-specific stock watchlists
   - `/alert AAPL 180` - price alerts

4. **Admin Features**
   - `/stats` - bot usage statistics
   - `/clear-cache` - manual cache clearing
   - Server-specific configurations

5. **Enhanced Analytics**
   - Technical indicators (RSI, MACD, etc.)
   - Volume analysis
   - More detailed charts

6. **Crypto Support**
   - Extend to cryptocurrencies
   - Different data sources may be needed

---

## 15. Success Metrics

**Key Performance Indicators:**

1. **Response Time**
   - Target: < 3s for uncached requests
   - Target: < 1s for cached requests

2. **Error Rate**
   - Target: < 1% of requests fail
   - Monitor by error type

3. **Cache Hit Rate**
   - Target: > 60% for stock prices
   - Target: > 80% for historical data
   - Target: > 90% for AI summaries

4. **API Usage**
   - Stay within Massive.com free tier (5/min)
   - Monitor Perplexity costs
   - Track cost per request

5. **User Satisfaction**
   - Response accuracy
   - Minimal false positives on invalid tickers
   - Clear, actionable error messages

---

## 16. Dependencies

### 16.1 NPM Packages

```json
{
  "dependencies": {
    "discord-interactions": "^3.4.0",
    "openai": "^4.20.0"
  },
  "devDependencies": {
    "wrangler": "^3.20.0",
    "vitest": "^1.0.0",
    "@cloudflare/workers-types": "^4.20231218.0"
  }
}
```

### 16.2 External Services

- **Massive.com:** Stock market data
- **Perplexity:** AI-powered news summaries with SONAR model
- **Discord:** Bot platform
- **Cloudflare Workers:** Hosting and compute
- **Cloudflare KV:** Data storage

---

## 17. Estimated Costs (Free Tier)

**Cloudflare Workers:**
- Free: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day

**Massive.com:**
- Free: 5 API calls/minute

**Perplexity:**
- Pay per request (estimate $0.005-0.01 per request with SONAR model)
- Cache aggressively to minimize costs

**Discord:**
- Free

**Total Monthly Cost (Estimate):**
- Small server (< 100 users): $3-15/month (primarily Perplexity)
- Medium server (100-1000 users): $20-100/month

---

## 18. Definition of Done

The project is complete when:

- [ ] Bot responds to `/stock <ticker>` with complete data
- [ ] Bot responds to `/help` with usage information
- [ ] Rate limiting works (1 query/min/user)
- [ ] Caching works for all three data types
- [ ] Rich embeds display correctly with color coding
- [ ] ASCII sparkline chart generates properly
- [ ] AI summaries are 2-4 sentences and factually accurate
- [ ] Invalid tickers show helpful error messages
- [ ] All errors are handled gracefully (no crashes)
- [ ] Unit tests pass for core functions
- [ ] Local development environment works
- [ ] Production deployment successful
- [ ] All secrets properly configured
- [ ] Documentation complete (README)
- [ ] Code follows consistent style
- [ ] Logging captures all important events

---

## 19. Timeline Estimate

**Phase 1: Setup & Infrastructure (2-3 hours)**
- Cloudflare Workers project setup
- Discord bot registration
- KV namespaces creation
- External API account setup

**Phase 2: Core Functionality (6-8 hours)**
- Command routing and parsing
- Massive.com integration
- Basic response formatting
- Error handling

**Phase 3: Caching & Rate Limiting (3-4 hours)**
- KV cache implementation
- Rate limiter with KV
- Cache invalidation logic

**Phase 4: AI Integration (2-3 hours)**
- Perplexity API integration
- Prompt engineering
- Summary caching

**Phase 5: UI Polish (2-3 hours)**
- Rich embed formatting
- ASCII chart generation
- Color coding logic

**Phase 6: Testing (3-4 hours)**
- Unit test implementation
- Manual testing
- Bug fixes

**Phase 7: Documentation & Deployment (2 hours)**
- README
- Deployment scripts
- Production deployment

**Total: 20-27 hours**

---

## Appendix A: Discord Slash Command Registration

**Commands to Register:**

```javascript
[
  {
    name: 'stock',
    description: 'Get current stock price, trend, and AI news summary',
    options: [
      {
        name: 'ticker',
        description: 'Stock ticker symbol (e.g., AAPL, NET)',
        type: 3, // STRING
        required: true
      }
    ]
  },
  {
    name: 'help',
    description: 'Show bot usage instructions and information',
    options: []
  }
]
```

---

## Appendix B: Example API Responses

### Massive.com Quote Response (Previous Day Bar)
```json
{
  "c": 175.43,
  "h": 176.12,
  "l": 174.21,
  "o": 174.50,
  "pc": 171.33,
  "t": 1700000000
}
```

### Massive.com Historical Data Response
```json
{
  "c": [171.33, 172.45, 173.12, 174.21, 175.43],
  "h": [172.10, 173.50, 174.00, 175.12, 176.12],
  "l": [170.50, 171.80, 172.45, 173.50, 174.21],
  "o": [171.00, 172.00, 173.00, 174.00, 175.00],
  "s": "ok",
  "t": [1699920000, 1700006400, 1700092800, 1700179200, 1700265600],
  "v": [50000000, 48000000, 52000000, 49000000, 51000000]
}
```

---

**End of Specification**
