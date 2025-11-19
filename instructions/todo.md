# Discord Stock Bot - Project To-Do List

## ✅ Phase 0: Discord Bot Setup

> **Note:** This bot uses Discord's Interactions API (slash commands) hosted on Cloudflare Workers. It does NOT use Gateway/WebSocket connections, so gateway intents are not needed.

### Step 1: Create Discord Application
- [x] Navigate to https://discord.com/developers/applications
- [x] Click "New Application" button (top right)
- [x] Enter application name: "Stock Bot" (or your preferred name)
- [x] Read and accept Discord's Developer Terms of Service
- [x] Click "Create"
- [x] You'll be redirected to your application's General Information page

### Step 2: Get Application Credentials
- [x] On the General Information page, locate these values:
  - **APPLICATION ID**: Copy this → Save as `DISCORD_APP_ID`
    - Used for command registration and OAuth2 URLs
  - **PUBLIC KEY**: Copy this → Save as `DISCORD_PUBLIC_KEY`
    - Used to verify Discord's signature on incoming interactions
- [x] Store both values securely (password manager or secure notes)

### Step 3: Create Bot User
- [x] Click "Bot" in the left sidebar
- [x] Click "Add Bot" button
- [x] Confirm by clicking "Yes, do it!"
- [x] Your bot user is now created

### Step 4: Get Bot Token
- [x] Under "TOKEN" section, click "Reset Token"
- [x] Confirm the reset (you may need to enter 2FA code)
- [x] **IMMEDIATELY COPY THE TOKEN** (it only shows once!)
- [x] Save as `DISCORD_BOT_TOKEN` in your secure storage
- [x] ⚠️ **CRITICAL**: Never commit this token to git or share it publicly

### Step 5: Configure Bot Settings
- [x] Still on the Bot page, configure these settings:
  - **Public Bot**: Uncheck this if you want the bot private (recommended for testing)
  - **Requires OAuth2 Code Grant**: Leave unchecked (not needed)
  - **Bot Permissions**: (We'll set these in OAuth2, but note them here for reference)

### Step 6: Gateway Intents (Important!)
- [x] Scroll down to "Privileged Gateway Intents" section
- [x] **LEAVE ALL INTENTS DISABLED** ✓
  - ❌ PRESENCE INTENT - Not needed
  - ❌ SERVER MEMBERS INTENT - Not needed  
  - ❌ MESSAGE CONTENT INTENT - Not needed
- [x] **Why?** This bot uses Interactions API (HTTP-based slash commands), not the Gateway (WebSocket). Interactions-based bots don't need gateway intents and work more efficiently.

### Step 7: Generate OAuth2 URL
- [ ] Click "OAuth2" in the left sidebar, then "URL Generator"
- [ ] Under "SCOPES", select:
  - ✅ `bot` - Adds the bot user to servers
  - ✅ `applications.commands` - Enables slash commands (REQUIRED)
- [ ] Under "BOT PERMISSIONS", select these minimum permissions:
  - ✅ **Send Messages** - Required to respond to commands
  - ✅ **Embed Links** - Required for rich embed responses
  - ✅ **Use External Emojis** - For reactions (optional but recommended)
  - ✅ **Add Reactions** - For rate limit emoji indicator
  - ✅ **Read Message History** - May be needed for context (optional)
- [ ] Note the permission integer displayed (e.g., `2147485696`)
- [ ] Copy the generated OAuth2 URL at the bottom
- [ ] Save/bookmark this URL for future use

### Step 8: Add Bot to Test Server
- [ ] Paste the OAuth2 URL into your browser
- [ ] Select a Discord server where you have "Manage Server" permission
  - ⚠️ Use a TEST server, not a production server
  - Create a new test server if needed (recommended)
- [ ] Review the requested permissions
- [ ] Click "Authorize"
- [ ] Complete the CAPTCHA if prompted
- [ ] Verify success message appears

### Step 9: Verify Bot Installation
- [ ] Open your Discord test server
- [ ] Check the member list (right sidebar)
- [ ] Verify your bot appears in the members list
- [ ] Bot will show as OFFLINE (this is expected - it's not running yet)
- [ ] Bot should have a "BOT" badge next to its name

### Step 10: Pre-Development Checklist
Verify you have all required credentials saved:
- [ ] `DISCORD_APP_ID` - Application ID from General Information
- [ ] `DISCORD_PUBLIC_KEY` - Public Key from General Information  
- [ ] `DISCORD_BOT_TOKEN` - Bot token from Bot page (starts with "MTk..." or similar)
- [ ] OAuth2 invite URL saved/bookmarked
- [ ] Bot successfully added to test Discord server
- [ ] Bot appears in server member list (showing as offline)

### Step 11: Understanding Interactions Endpoint URL
- [ ] **DO NOT SET THIS YET** - You'll configure this after deploying to Cloudflare Workers
- [ ] The Interactions Endpoint URL tells Discord where to send slash command HTTP requests
- [ ] For local development, you'll use a tool like `ngrok` to create a tunnel
- [ ] For production, you'll use your Cloudflare Worker URL (e.g., `https://your-worker.workers.dev`)
- [ ] Discord will send a PING request to verify the endpoint when you set it
- [ ] Your worker must respond with PONG (type 1) to verify

### Important Notes
- **Security**: Never commit `.dev.vars` or any file containing your bot token to git
- **Token Rotation**: If your token is ever compromised, immediately regenerate it in the Bot page
- **Rate Limits**: Discord has rate limits on API calls - the bot implements user-level rate limiting to help manage this
- **Slash Commands**: This bot exclusively uses slash commands (no message content parsing)
- **Verification**: If your bot reaches 100+ servers, Discord requires verification and may request additional information

---

## ✅ Phase 1: Project Foundation

### Step 1: Project Setup
- [x] Create project directory: `discord-stock-bot/`
- [x] Run `npm init` to create package.json
- [x] Install dependencies: discord-interactions@^3.4.0, openai@^4.20.0
- [x] Install dev dependencies: wrangler@^3.20.0, vitest@^1.0.0, @cloudflare/workers-types@^4.20231218.0
- [x] Create wrangler.toml with placeholder KV namespace IDs
- [x] Create src/config.js with all CONFIG constants from spec
- [x] Create .gitignore (node_modules/, .dev.vars, .wrangler/, dist/)
- [x] Create vitest.config.js
- [x] Create directory structure: src/{commands,services,middleware,utils}/, tests/, scripts/
- [x] Add npm scripts: test, test:watch, dev, deploy
- [x] Create basic src/index.js with "Bot is running" response
- [x] Test: Run `npm test` (should work even with no tests)
- [x] Test: Run `wrangler dev` (should start without errors)

### Step 2: Validator Utility
- [x] Create tests/utils/validator.test.js
- [x] Write test: Valid uppercase tickers (AAPL, GOOGL, NET)
- [x] Write test: Lowercase conversion (aapl → AAPL)
- [x] Write test: Invalid empty string
- [x] Write test: Invalid numbers only
- [x] Write test: Invalid special characters
- [x] Write test: Invalid too long (>10 chars)
- [x] Write test: Whitespace trimming
- [x] Write test: Null/undefined handling
- [x] Implement src/utils/validator.js with validateTicker function
- [x] Run tests: All validator tests passing
- [x] Code review: Check validation logic is secure

### Step 3: Error Handler
- [ ] Create tests/utils/errorHandler.test.js
- [ ] Write test: Error type classification for all types
- [ ] Write test: Ephemeral flag always true
- [ ] Write test: User-friendly messages (no stack traces)
- [ ] Write test: Logging calls are made
- [ ] Write test: Error responses include suggestions for invalid tickers
- [ ] Implement src/utils/errorHandler.js
- [ ] Create BotError class
- [ ] Create ErrorTypes enum
- [ ] Implement formatErrorResponse function
- [ ] Implement logError function
- [ ] Run tests: All error handler tests passing
- [ ] Verify error messages are user-friendly

### Step 4: Chart Generator
- [ ] Create tests/utils/chartGenerator.test.js
- [ ] Write test: Upward trend visualization
- [ ] Write test: Downward trend visualization
- [ ] Write test: Flat line visualization
- [ ] Write test: Volatile price pattern
- [ ] Write test: Single value handling
- [ ] Write test: Two values handling
- [ ] Write test: Empty array handling
- [ ] Write test: Negative values
- [ ] Write test: Small differences still show variation
- [ ] Implement src/utils/chartGenerator.js
- [ ] Implement generateSparkline function
- [ ] Implement formatChartWithLabels function
- [ ] Run tests: All chart tests passing
- [ ] Visual verification: Check charts look correct for various patterns

### Step 5: Embed Builder
- [ ] Create tests/utils/embedBuilder.test.js
- [ ] Write test: Color selection based on positive price change
- [ ] Write test: Color selection based on negative price change
- [ ] Write test: Color selection for neutral/zero change
- [ ] Write test: Embed structure validation
- [ ] Write test: All required fields present
- [ ] Write test: Partial data handling (missing AI summary)
- [ ] Write test: Footer formatting with timestamp
- [ ] Write test: Help embed structure
- [ ] Implement src/utils/embedBuilder.js
- [ ] Implement getEmbedColor function
- [ ] Implement buildStockEmbed function
- [ ] Implement buildHelpEmbed function
- [ ] Run tests: All embed tests passing
- [ ] Verify embeds match Discord specification

---

## ✅ Phase 2: Infrastructure

### Step 6: Cache Manager
- [ ] Create tests/middleware/cache.test.js
- [ ] Write test: Key generation for price data
- [ ] Write test: Key generation for history data
- [ ] Write test: Key generation for summary data
- [ ] Write test: Get operation (cache hit)
- [ ] Write test: Get operation (cache miss)
- [ ] Write test: Set operation with TTL
- [ ] Write test: JSON serialization/deserialization
- [ ] Write test: KV error handling
- [ ] Mock KV namespace for tests
- [ ] Implement src/middleware/cache.js
- [ ] Implement generateCacheKey function
- [ ] Implement getCached function
- [ ] Implement setCached function
- [ ] Implement getTTL function
- [ ] Run tests: All cache tests passing
- [ ] Verify TTLs are correct (300s, 3600s, 28800s)

### Step 7: Rate Limiter
- [ ] Create tests/middleware/rateLimit.test.js
- [ ] Write test: First request allowed
- [ ] Write test: Second request within 60s blocked
- [ ] Write test: Request after 60s allowed
- [ ] Write test: Time remaining calculation
- [ ] Write test: Multiple users don't interfere
- [ ] Write test: KV error handling (fail open)
- [ ] Implement src/middleware/rateLimit.js
- [ ] Implement checkRateLimit function
- [ ] Implement updateRateLimit function
- [ ] Implement enforceRateLimit function
- [ ] Run tests: All rate limit tests passing
- [ ] Verify rate limit TTL is 60 seconds

---

## ✅ Phase 3: External Services

### Step 8: Finnhub Service
- [ ] Create tests/services/finnhub.test.js
- [ ] Write test: Successful quote fetch
- [ ] Write test: Successful historical data fetch
- [ ] Write test: 404 handling (invalid ticker)
- [ ] Write test: Timeout handling
- [ ] Write test: Retry logic with exponential backoff
- [ ] Write test: Response parsing for quote
- [ ] Write test: Response parsing for historical data
- [ ] Write test: Ticker suggestions for common typos
- [ ] Mock fetch API for tests
- [ ] Implement src/services/finnhub.js
- [ ] Implement fetchQuote function
- [ ] Implement fetchHistoricalData function
- [ ] Implement suggestTickers function
- [ ] Add timeout using AbortController (10s)
- [ ] Add retry logic (1 retry with backoff)
- [ ] Run tests: All Finnhub tests passing
- [ ] Verify API endpoints are correct (/quote, /stock/candle)

### Step 9: OpenAI Service
- [ ] Create tests/services/openai.test.js
- [ ] Write test: Successful summary generation
- [ ] Write test: Prompt formatting with ticker and company
- [ ] Write test: Timeout handling
- [ ] Write test: API error handling (rate limit)
- [ ] Write test: API error handling (invalid key)
- [ ] Write test: Response validation (2-4 sentences)
- [ ] Mock OpenAI client for tests
- [ ] Implement src/services/openai.js
- [ ] Implement generateAISummary function
- [ ] Implement formatPrompt function
- [ ] Configure: model=gpt-5-search-api, max_tokens=10000, temperature=0.3
- [ ] Add timeout using AbortController (15s)
- [ ] Throw PARTIAL_FAILURE on errors (don't fail entire request)
- [ ] Run tests: All OpenAI tests passing
- [ ] Verify prompt template matches spec

### Step 10: Discord Utilities
- [ ] Create tests/services/discord.test.js
- [ ] Write test: Signature verification (valid signature)
- [ ] Write test: Signature verification (invalid signature)
- [ ] Write test: Response formatting (type 4)
- [ ] Write test: Ephemeral flag handling
- [ ] Write test: Slash command parsing
- [ ] Mock crypto for signature tests
- [ ] Implement src/services/discord.js
- [ ] Implement verifyDiscordRequest function
- [ ] Implement createInteractionResponse function
- [ ] Implement createEmbedResponse function
- [ ] Implement parseSlashCommand function
- [ ] Use discord-interactions library for verification
- [ ] Run tests: All Discord utility tests passing

---

## ✅ Phase 4: Command Handlers

### Step 11: Help Command
- [ ] Create tests/commands/help.test.js
- [ ] Write test: Help embed is returned
- [ ] Write test: Embed structure is correct
- [ ] Write test: All information included (commands, rate limits, sources)
- [ ] Write test: Response is not ephemeral
- [ ] Implement src/commands/help.js
- [ ] Implement handleHelpCommand function
- [ ] Use buildHelpEmbed utility
- [ ] Return proper Discord response
- [ ] Run tests: All help command tests passing
- [ ] Manual test: Help command returns expected embed

### Step 12: Stock Command - Structure
- [ ] Create tests/commands/stock.test.js
- [ ] Write test: Ticker extraction from interaction
- [ ] Write test: Valid ticker passes validation
- [ ] Write test: Invalid ticker fails validation
- [ ] Write test: First request passes rate limit
- [ ] Write test: Second request blocked by rate limit
- [ ] Write test: Error response for invalid ticker
- [ ] Write test: Error response for rate limit
- [ ] Implement src/commands/stock.js (skeleton)
- [ ] Extract ticker from interaction options
- [ ] Validate ticker using validator
- [ ] Enforce rate limit using rate limiter
- [ ] Handle validation errors
- [ ] Handle rate limit errors
- [ ] Run tests: All structure tests passing

### Step 13: Stock Command - Data Fetching
- [ ] Add test: Parallel cache reads
- [ ] Add test: Parallel API calls on cache miss
- [ ] Add test: Cache writes after successful fetch
- [ ] Add test: Partial failure handling (stock data succeeds, AI fails)
- [ ] Extend stock.js with fetchStockData function
- [ ] Check all three caches in parallel (Promise.all)
- [ ] Fetch missing price and history in parallel
- [ ] Fetch AI summary (non-blocking, can fail)
- [ ] Update all caches in parallel
- [ ] Return complete data object
- [ ] Run tests: All data fetching tests passing
- [ ] Verify parallel operations are actually parallel

### Step 14: Stock Command - Response Building
- [ ] Add test: Full response with all data
- [ ] Add test: Response with missing AI summary
- [ ] Add test: Chart generation and labeling
- [ ] Add test: Color coding based on positive change
- [ ] Add test: Color coding based on negative change
- [ ] Add test: Market hours vs. closed handling
- [ ] Complete stock.js with buildStockResponse function
- [ ] Generate chart with labels
- [ ] Determine embed color based on price change
- [ ] Build complete embed with all data
- [ ] Handle missing AI summary gracefully
- [ ] Return formatted Discord response
- [ ] Run tests: All response building tests passing
- [ ] Integration test: Full /stock command flow works

---

## ✅ Phase 5: Integration

### Step 15: Main Worker Handler
- [ ] Create tests/index.test.js
- [ ] Write test: Discord signature verification success
- [ ] Write test: Discord signature verification failure
- [ ] Write test: PING (type 1) returns PONG
- [ ] Write test: /stock command routing
- [ ] Write test: /help command routing
- [ ] Write test: Unknown command handling
- [ ] Write test: Error handling and logging
- [ ] Write test: Unauthorized requests rejected
- [ ] Implement src/index.js
- [ ] Verify Discord request signature
- [ ] Parse request body as JSON
- [ ] Handle PING interaction (type 1) → return PONG
- [ ] Route to handleStockCommand for /stock
- [ ] Route to handleHelpCommand for /help
- [ ] Handle unknown commands
- [ ] Wrap all in try-catch with error logging
- [ ] Return proper HTTP responses
- [ ] Run tests: All main handler tests passing
- [ ] Integration test: Worker handles all interaction types

### Step 16: Command Registration Script
- [ ] Install additional packages if needed (@discordjs/rest, discord-api-types)
- [ ] Create scripts/register-commands.js
- [ ] Define /stock command structure with options
- [ ] Define /help command structure
- [ ] Implement Discord API registration
- [ ] Support environment variables: DISCORD_TOKEN, DISCORD_APP_ID
- [ ] Support optional GUILD_ID for guild-specific commands
- [ ] Add error handling for registration failures
- [ ] Add success logging
- [ ] Test script locally (dry run mode if possible)
- [ ] Document usage in script comments

### Step 17: Integration Testing
- [ ] Create tests/integration/workflow.test.js
- [ ] Mock all external dependencies (Discord, Finnhub, OpenAI, KV)
- [ ] Write test: Complete /stock flow (validation → rate limit → fetch → cache → response)
- [ ] Write test: /help flow end-to-end
- [ ] Write test: Invalid ticker error path
- [ ] Write test: Rate limit error path
- [ ] Write test: API failure error path
- [ ] Write test: Cache hit scenario
- [ ] Write test: Partial failure scenario (AI summary fails)
- [ ] Run all integration tests
- [ ] Verify all components work together
- [ ] Check for any race conditions or timing issues

---

## ✅ Phase 6: Documentation

### Step 18: Documentation
- [ ] Create README.md
- [ ] Document project description and features
- [ ] Document prerequisites (Node.js 18+, Wrangler, accounts needed)
- [ ] Document installation steps
- [ ] Document configuration (all secrets and environment variables)
- [ ] Document local development setup (.dev.vars, wrangler dev)
- [ ] Document testing (npm test, test:watch)
- [ ] Document deployment process
- [ ] Document Discord bot setup reference
- [ ] Add usage examples with screenshots (optional)
- [ ] Add troubleshooting section
- [ ] Add contributing guidelines (if open source)
- [ ] Update wrangler.toml with detailed comments
- [ ] Add JSDoc comments to all exported functions
- [ ] Create DEPLOYMENT.md with detailed checklist
- [ ] Include rollback procedures
- [ ] Include monitoring setup instructions

---

## ✅ Phase 7: Optimization & Testing

### Step 19: Performance Optimization
- [ ] Add request timing instrumentation
- [ ] Log API response times for Finnhub
- [ ] Log API response times for OpenAI
- [ ] Log cache hit/miss metrics
- [ ] Track end-to-end request duration
- [ ] Review all Promise.all usage for optimization
- [ ] Add Promise.allSettled for non-critical operations
- [ ] Create performance tests (cached < 1s, uncached < 3s)
- [ ] Run performance tests
- [ ] Document performance characteristics in README
- [ ] Profile Worker CPU usage if possible
- [ ] Optimize any bottlenecks found

---

## ✅ Phase 8: Final Deployment

### Pre-Deployment
- [ ] Run full test suite: `npm test`
- [ ] Verify 100% test pass rate
- [ ] Code review for security issues
- [ ] Verify no hardcoded secrets in code
- [ ] Verify .gitignore includes .dev.vars

### Get API Keys
- [ ] Sign up for Finnhub: https://finnhub.io/register
- [ ] Get Finnhub API key → Save as FINNHUB_API_KEY
- [ ] Verify Finnhub free tier (60 calls/min)
- [ ] Get OpenAI API key: https://platform.openai.com/api-keys
- [ ] Save OpenAI key → Save as OPENAI_API_KEY
- [ ] Verify OpenAI billing is set up
- [ ] Confirm gpt-5-search-api is available

### Cloudflare Setup
- [ ] Login to Cloudflare: `wrangler login`
- [ ] Create RATE_LIMITS KV namespace: `wrangler kv:namespace create RATE_LIMITS`
- [ ] Create CACHE KV namespace: `wrangler kv:namespace create CACHE`
- [ ] Copy KV namespace IDs from output
- [ ] Update wrangler.toml with actual namespace IDs
- [ ] Set DISCORD_BOT_TOKEN secret: `wrangler secret put DISCORD_BOT_TOKEN`
- [ ] Set DISCORD_PUBLIC_KEY secret: `wrangler secret put DISCORD_PUBLIC_KEY`
- [ ] Set FINNHUB_API_KEY secret: `wrangler secret put FINNHUB_API_KEY`
- [ ] Set OPENAI_API_KEY secret: `wrangler secret put OPENAI_API_KEY`

### Deploy Worker
- [ ] Deploy to Cloudflare: `wrangler deploy`
- [ ] Copy deployed Worker URL
- [ ] Test Worker is responding: `curl https://your-worker.workers.dev`
- [ ] Verify "Bot is running" response or similar

### Configure Discord Integration
- [ ] Go to Discord Developer Portal → Your Application → General Information
- [ ] Set INTERACTIONS ENDPOINT URL to Worker URL
- [ ] Click "Save Changes"
- [ ] Wait for Discord's PING verification
- [ ] Verify green checkmark appears
- [ ] If verification fails, check `wrangler tail` for errors
- [ ] Troubleshoot signature verification if needed

### Register Commands
- [ ] Run command registration: `DISCORD_TOKEN=xxx DISCORD_APP_ID=xxx node scripts/register-commands.js`
- [ ] Verify success message
- [ ] Note: Global commands take ~1 hour to propagate
- [ ] Alternative: Register to specific guild for instant testing
- [ ] Wait for command propagation (or use guild commands)

### Manual Testing - Basic
- [ ] Open Discord test server
- [ ] Test /help command
- [ ] Verify help embed displays correctly
- [ ] Verify all information is accurate
- [ ] Test /stock AAPL (happy path)
- [ ] Verify stock data displays correctly
- [ ] Verify ASCII chart renders properly
- [ ] Verify AI summary is 2-4 sentences
- [ ] Verify colors match price direction (green/red/gray)
- [ ] Verify response time < 3 seconds

### Manual Testing - Error Handling
- [ ] Test /stock INVALIDTICKER
- [ ] Verify error message displays
- [ ] Verify error is ephemeral (only you see it)
- [ ] Verify suggestions are included
- [ ] Test /stock with very long invalid ticker
- [ ] Test /stock with special characters

### Manual Testing - Rate Limiting
- [ ] Test /stock NET
- [ ] Immediately test /stock AAPL (within 60s)
- [ ] Verify ⏰ emoji reaction appears
- [ ] Verify ephemeral rate limit message
- [ ] Verify time remaining is accurate
- [ ] Wait 60+ seconds
- [ ] Test /stock GOOGL
- [ ] Verify request succeeds after cooldown

### Manual Testing - Caching
- [ ] Test /stock MSFT (first query)
- [ ] Note response time
- [ ] Wait 10 seconds
- [ ] Test /stock MSFT again
- [ ] Verify response time < 1 second
- [ ] Check logs for cache hit message

### Manual Testing - Edge Cases
- [ ] Test during market hours (if possible)
- [ ] Test after market close
- [ ] Test on weekend (should show Friday close)
- [ ] Test very obscure ticker
- [ ] Test ticker with no recent news (AI summary handling)
- [ ] Have second user test simultaneously (if possible)

### Monitoring & Verification
- [ ] Open Cloudflare Workers dashboard
- [ ] Check request count is incrementing
- [ ] Check error rate (should be near 0%)
- [ ] Check average response times
- [ ] Open Cloudflare KV dashboard
- [ ] Verify RATE_LIMITS namespace has reads/writes
- [ ] Verify CACHE namespace has reads/writes
- [ ] Check storage usage
- [ ] Run `wrangler tail` in terminal
- [ ] Test commands while watching logs
- [ ] Verify [INFO], [WARN], [ERROR] logs appear correctly
- [ ] Verify no unexpected errors

### Production Readiness Checklist
- [ ] Bot responds to /stock with complete data
- [ ] Bot responds to /help correctly
- [ ] Rate limiting works (1 query/min/user)
- [ ] Caching works for price data (5 min TTL)
- [ ] Caching works for history data (1 hour TTL)
- [ ] Caching works for AI summaries (8 hour TTL)
- [ ] Rich embeds display correctly
- [ ] Color coding works (green/red/gray)
- [ ] ASCII sparkline charts render properly
- [ ] AI summaries are 2-4 sentences and factually accurate
- [ ] Invalid tickers show helpful error messages
- [ ] All errors handled gracefully (no crashes)
- [ ] Unit tests all passing
- [ ] Integration tests all passing
- [ ] Documentation complete (README, DEPLOYMENT.md)
- [ ] Code follows consistent style
- [ ] Logging captures all important events
- [ ] No secrets in committed code
- [ ] Performance targets met (< 3s uncached, < 1s cached)

### Post-Deployment
- [ ] Update README with production Worker URL
- [ ] Document any known issues or limitations
- [ ] Add support/contact information
- [ ] Set up Cloudflare billing alerts
- [ ] Set up OpenAI usage monitoring
- [ ] Monitor costs daily for first week
- [ ] Create rollback plan documentation
- [ ] Test rollback procedure works
- [ ] Optional: Add bot to additional servers
- [ ] Optional: Share OAuth2 URL with trusted users
- [ ] Monitor user feedback and error rates

---

## 🎉 Launch Complete!

### Post-Launch Monitoring (First Week)
- [ ] Day 1: Check error rates and logs every few hours
- [ ] Day 1: Monitor API usage (Finnhub, OpenAI)
- [ ] Day 1: Verify costs are within expected range
- [ ] Day 2-3: Check metrics twice daily
- [ ] Day 4-7: Check metrics once daily
- [ ] Week 1: Review all error logs
- [ ] Week 1: Analyze cache hit rates (should be >60% for prices)
- [ ] Week 1: Review user feedback (if any)
- [ ] Week 1: Document any issues encountered
- [ ] Week 1: Create issue backlog for improvements

### Maintenance & Iteration
- [ ] Set up weekly cost review process
- [ ] Set up monthly usage review
- [ ] Plan feature enhancements (from spec Future Enhancements)
- [ ] Consider international markets support
- [ ] Consider configurable time periods
- [ ] Consider additional commands (/compare, /watchlist)
- [ ] Keep dependencies updated (monthly check)
- [ ] Monitor Discord API changes
- [ ] Monitor Finnhub API changes
- [ ] Monitor OpenAI API changes

---

## 📊 Success Metrics to Track

### Performance Metrics
- [ ] Average response time for uncached requests (target: < 3s)
- [ ] Average response time for cached requests (target: < 1s)
- [ ] Error rate (target: < 1%)
- [ ] Cache hit rate for prices (target: > 60%)
- [ ] Cache hit rate for history (target: > 80%)
- [ ] Cache hit rate for summaries (target: > 90%)

### Cost Metrics
- [ ] Daily Cloudflare Workers requests (free: 100k/day)
- [ ] Daily KV reads (free: 100k/day)
- [ ] Daily KV writes (free: 1k/day)
- [ ] Daily Finnhub API calls (free: 60/minute)
- [ ] Monthly OpenAI costs (estimate: $5-20/month small server)
- [ ] Total monthly costs

### Usage Metrics
- [ ] Total commands processed
- [ ] Unique users
- [ ] Most queried tickers
- [ ] Rate limit hits per day
- [ ] Commands per user per day
- [ ] Help command usage vs. stock command usage

---

**Total Tasks: 350+**

This checklist covers every aspect of the Discord Stock Bot project from initial setup through deployment, testing, and ongoing maintenance. Check off items as you complete them to track your progress!
