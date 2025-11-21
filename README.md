# 📊 Discord Stock Bot

A powerful Discord bot that provides real-time stock information, 30-day price trends, and AI-powered news summaries through slash commands. Built on Cloudflare Workers for global edge deployment.

[![Add to Discord](https://img.shields.io/badge/Add%20to-Discord-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.com/oauth2/authorize?client_id=1440825435612254280&permissions=346176&integration_type=0&scope=bot+applications.commands)


## ✨ Features

- **💰 Real-Time Stock Prices**: Live current prices when market is open, previous close when market is closed
- **🕐 Market Status Detection**: Automatically detects market hours using real-time quote freshness
- **📉 30-Day Trend Visualization**: Beautiful ASCII sparkline charts showing price movement
- **🤖 AI News Summaries**: GPT-powered summaries of recent news with sentiment analysis
- **⚡ Smart Caching**: Reduces API costs with intelligent multi-tier caching (1min/5min/1hr/8hr)
- **🛡️ Rate Limiting**: Built-in rate limiting (1 query every 30 seconds per user) prevents abuse
- **🎨 Rich Embeds**: Color-coded Discord embeds (green/red/gray) with detailed information
- **🌍 Edge Deployment**: Runs on Cloudflare's global network for ultra-low latency

![](https://file.elezea.com/20251121-001354-2.png)

## 🎯 Quick Start

### Prerequisites

- **Node.js 18+** (for local development)
- **Cloudflare Account** (free tier works great)
- **Discord Bot Token** (from [Discord Developer Portal](https://discord.com/developers/applications))
- **Massive.com API Key** (for historical stock data, free tier: 5 calls/min)
- **Finnhub API Key** (for real-time quotes & market status, free tier: 60 calls/min)
- **OpenAI API Key** (for AI summaries)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd discord-stock-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Discord Bot**
   - Go to [Discord Developer Portal](https://discord.com/developers/applications)
   - Create a new application
   - Go to "Bot" section and create a bot user
   - Copy the **Bot Token** and **Public Key**
   - Copy the **Application ID**
   - See [Discord Bot Setup Guide](./instructions/prompt_plan.md#step-0-discord-bot-setup) for detailed instructions

4. **Get API Keys**
   - **Massive.com**: Sign up at https://massive.com/ (formerly Polygon.io) for historical data
   - **Finnhub**: Sign up at https://finnhub.io/ for real-time quotes
   - **OpenAI**: Get API key from https://platform.openai.com/api-keys

5. **Configure Local Development**

   Create a `.dev.vars` file in the project root (⚠️ never commit this file):
   ```bash
   DISCORD_BOT_TOKEN=your_bot_token_here
   DISCORD_PUBLIC_KEY=your_public_key_here
   MASSIVE_API_KEY=your_massive_api_key_here
   FINNHUB_API_KEY=your_finnhub_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   DEV_MODE=true
   ```

6. **Create KV Namespaces**
   ```bash
   wrangler kv:namespace create RATE_LIMITS
   wrangler kv:namespace create CACHE
   ```
   
   Update `wrangler.toml` with the generated namespace IDs.

7. **Run Tests**
   ```bash
   npm test
   ```
   You should see 280 tests passing ✅

8. **Start Local Development**
   ```bash
   npm run dev
   ```

## 🚀 Deployment

### Production Deployment

1. **Login to Cloudflare**
   ```bash
   wrangler login
   ```

2. **Set Production Secrets**
   ```bash
   wrangler secret put DISCORD_BOT_TOKEN
   wrangler secret put DISCORD_PUBLIC_KEY
   wrangler secret put MASSIVE_API_KEY
   wrangler secret put FINNHUB_API_KEY
   wrangler secret put OPENAI_API_KEY
   ```

3. **Deploy to Cloudflare Workers**
   ```bash
   npm run deploy
   ```

4. **Configure Discord Interaction Endpoint**
   - Copy your deployed Worker URL (e.g., `https://discord-stock-bot.your-subdomain.workers.dev`)
   - Go to Discord Developer Portal → Your Application → General Information
   - Set "Interactions Endpoint URL" to your Worker URL
   - Discord will send a PING to verify the endpoint

5. **Register Slash Commands**
   ```bash
   DISCORD_TOKEN=<bot_token> DISCORD_APP_ID=<app_id> node scripts/register-commands.js
   ```

For detailed deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## 📖 Usage

### Commands

#### `/stock <ticker>`
Get comprehensive stock information for a ticker symbol.

**Example:**
```
/stock AAPL
```

**Response includes:**
- 💰 Current Price (when market open) or Previous Close (when market closed)
- 🕐 Market Status (Open/Closed with real-time detection)
- 📈 30-Day price trend (ASCII sparkline chart)
- 📰 AI-generated news summary with sentiment

#### `/help`
Display bot usage instructions, rate limits, and data sources.

### Example Interactions

```
User: /stock NET
Bot: 📊 NET - Cloudflare Inc.
     💰 Current Price: $85.50 (+1.2%)
     📈 30-Day Trend: ▁▃▅▆█
     $84.00 → $85.50
     🕐 Market Status: ✅ Market Open
     
     📰 News & Sentiment
     Cloudflare reported strong Q3 earnings...
```

## 🏗️ Architecture

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
│  │     - Stock Price Service (Massive.com)     │  │
│  │     - Real-Time Quotes (Finnhub)            │  │
│  │     - Historical Data Service               │  │
│  │     - AI Summary Service                    │  │
│  │  5. Response Formatter                       │  │
│  │  6. Error Handler                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │          │          │              │
         ↓          ↓          ↓              ↓
    ┌──────────┐ ┌────────┐ ┌────────┐ ┌──────────┐
    │ Massive  │ │Finnhub │ │ OpenAI │ │Cloudflare│
    │   .com   │ │  API   │ │gpt-4o- │ │    KV    │
    │   API    │ │        │ │ mini   │ │ Storage  │
    └──────────┘ └────────┘ └────────┘ └──────────┘
```

### Tech Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **Language**: JavaScript (ES Modules)
- **APIs**:
  - Discord Interactions API (slash commands)
  - Massive.com API (historical stock data)
  - Finnhub API (real-time quotes & market status)
  - OpenAI API (AI summaries with web search)
- **Storage**: Cloudflare KV (caching & rate limiting)
- **Testing**: Vitest (280 tests, comprehensive coverage)

## 🔧 Development

### Project Structure

```
discord-stock-bot/
├── src/
│   ├── index.js                 # Main Worker entry point
│   ├── config.js                # Configuration constants
│   ├── commands/
│   │   ├── stock.js             # /stock command handler
│   │   └── help.js              # /help command handler
│   ├── services/
│   │   ├── massive.js           # Massive.com API client
│   │   ├── finnhub.js           # Finnhub API client (real-time quotes)
│   │   ├── openai.js            # OpenAI API client
│   │   └── discord.js           # Discord API utilities
│   ├── middleware/
│   │   ├── rateLimit.js         # Rate limiting logic
│   │   └── cache.js             # Cache management
│   └── utils/
│       ├── chartGenerator.js    # ASCII sparkline generator
│       ├── embedBuilder.js      # Discord embed formatter
│       ├── errorHandler.js      # Centralized error handling
│       └── validator.js         # Input validation
├── tests/                       # Test suites (289 tests)
├── scripts/
│   └── register-commands.js     # Discord command registration
├── instructions/                # Development guides
├── package.json
├── wrangler.toml               # Cloudflare Workers config
└── vitest.config.js            # Test configuration
```

### Available Scripts

```bash
npm test              # Run all tests once
npm run test:watch    # Run tests in watch mode
npm run dev           # Start local development server
npm run deploy        # Deploy to Cloudflare Workers
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- tests/commands/stock.test.js

# Run tests in watch mode (auto-rerun on changes)
npm run test:watch

# Run tests with coverage
npm test -- --coverage
```

Current test results: **280 tests passing** ✅
- 269 unit tests
- 11 integration tests

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The worker will be available at `http://localhost:8787`

3. For Discord testing, use a tool like ngrok to expose your local server:
   ```bash
   ngrok http 8787
   ```
   Then set the ngrok URL as your Discord Interaction Endpoint.

## 📊 Caching Strategy

The bot uses a four-tier caching strategy to optimize API costs and response times:

| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| **Market Status** | 1 minute | Real-time detection needs frequent updates |
| **Stock Prices** | 5 minutes | Balance between real-time data and API costs |
| **Historical Data** | 1 hour | Changes infrequently, safe to cache longer |
| **AI Summaries** | 8 hours | Most expensive, news doesn't change minute-to-minute |

**Cache Hit Rates (Target):**
- Market status: >50%
- Stock prices: >60%
- Historical data: >80%
- AI summaries: >90%

## 📈 Performance Monitoring

The bot includes comprehensive performance instrumentation:

**Automated Metrics:**
- **[PERF]** API response times (Massive.com & OpenAI) with attempt tracking
- **[CACHE HIT/MISS]** Cache operations with duration and data size
- **[INFO]** End-to-end request duration tracking
- **[WARN/ERROR]** Performance issues and bottlenecks

**Monitoring in Production:**
```bash
# Watch real-time logs
wrangler tail

# Look for performance metrics
wrangler tail | grep PERF
wrangler tail | grep CACHE
```

**Performance Targets:**
- Cached requests: <1 second
- Uncached requests: <3 seconds (with deferred responses)
- Cache operations: <50ms
- API calls: Massive.com <2s, OpenAI <15s

## ⚙️ Configuration

### Environment Variables (Secrets)

Set via `wrangler secret put <NAME>`:

- `DISCORD_BOT_TOKEN` - Discord bot token
- `DISCORD_PUBLIC_KEY` - Discord application public key
- `MASSIVE_API_KEY` - Massive.com API key (historical data)
- `FINNHUB_API_KEY` - Finnhub API key (real-time quotes)
- `OPENAI_API_KEY` - OpenAI API key
- `DEV_MODE` - Set to "true" to skip signature verification in local dev

### Configuration Constants

See `src/config.js` for configurable constants:

```javascript
export const CONFIG = {
  RATE_LIMIT_SECONDS: 60,              // Rate limit window
  CACHE_TTL_MARKET_STATUS: 60,         // 1 minute
  CACHE_TTL_PRICE: 300,                // 5 minutes
  CACHE_TTL_HISTORY: 3600,             // 1 hour
  CACHE_TTL_SUMMARY: 28800,            // 8 hours
  DEFAULT_PERIOD_DAYS: 7,              // Historical data period
  MASSIVE_TIMEOUT: 10000,              // Massive.com API timeout (ms)
  FINNHUB_TIMEOUT: 5000,               // Finnhub API timeout (ms)
  OPENAI_TIMEOUT: 30000,               // OpenAI timeout (ms)
  EMBED_COLOR_POSITIVE: 0x00ff00,      // Green
  EMBED_COLOR_NEGATIVE: 0xff0000,      // Red
  EMBED_COLOR_NEUTRAL: 0x808080,       // Gray
};
```

## 🐛 Troubleshooting

### Common Issues

**Bot not responding to commands**
- Verify the Interactions Endpoint URL is set correctly in Discord Developer Portal
- Check that the endpoint returns a 200 OK with `{"type":1}` for PING requests
- Ensure all secrets are set: `wrangler secret list`

**"Invalid request signature" errors**
- Make sure `DISCORD_PUBLIC_KEY` is set correctly
- In local development, set `DEV_MODE=true` in `.dev.vars`

**Rate limit errors**
- Users can only make 1 query every 30 seconds
- This is by design to prevent API quota exhaustion
- Wait 30 seconds before trying again

**Stock data not found**
- Verify the ticker symbol is correct (uppercase, no spaces)
- Some tickers may not be available in Massive.com's database
- Check Massive.com API status: https://massive.com/

**AI summary unavailable**
- OpenAI API may be rate limited or experiencing issues
- Check your OpenAI API key is valid and has credits
- The bot will still show stock data even if AI summary fails

### Debugging

**View Worker Logs:**
```bash
wrangler tail
```

**Check KV Storage:**
```bash
wrangler kv:key list --binding=CACHE
wrangler kv:key get --binding=CACHE "stock:price:AAPL"
```

**Test Individual Components:**
```bash
# Test a specific service
npm test -- tests/services/massive.test.js

# Test with verbose output
npm test -- --reporter=verbose
```

## 💰 Cost Estimate

With the free tiers:

**Cloudflare Workers**
- Free: 100,000 requests/day
- KV: 100,000 reads/day, 1,000 writes/day

**Massive.com**
- Free: 5 API calls/minute (historical data)

**Finnhub**
- Free: 60 API calls/minute (real-time quotes)

**OpenAI**
- Pay per token (~$0.01-0.05 per request with gpt-4o-mini)
- Smart caching reduces costs significantly

**Estimated Monthly Cost:**
- Small server (<100 active users): $5-15/month (primarily OpenAI)
- Medium server (100-1000 users): $15-50/month

## 🔒 Security

- ✅ All API keys stored as Cloudflare Workers secrets (never in code)
- ✅ Discord request signature verification
- ✅ Input validation and sanitization
- ✅ Rate limiting prevents abuse
- ✅ Error messages don't expose internal details
- ✅ `.dev.vars` in `.gitignore`

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

### Code Style

- Follow existing code patterns
- Write clear, self-documenting code
- Add comments for complex logic
- All exported functions should have JSDoc comments
- Keep functions small and focused

## 📝 License

ISC

## 🙏 Acknowledgments

- **Massive.com** (formerly Polygon.io) for historical stock market data
- **Finnhub** for real-time quotes and market status
- **OpenAI** for AI-powered summaries with web search
- **Cloudflare** for edge computing platform
- **Discord** for the bot platform

## 📚 Additional Documentation

- [Deployment Guide](./DEPLOYMENT_GUIDE.md) - Step-by-step deployment instructions
- [Technical Specification](./instructions/spec.md) - Detailed technical documentation
- [Development Plan](./instructions/prompt_plan.md) - Implementation roadmap
- [Manual Testing Guide](./MANUAL_TESTING.md) - Testing checklist

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the troubleshooting section above

---

**Built with ❤️ using Cloudflare Workers**
