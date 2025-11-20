// ABOUTME: Configuration constants for the Discord Stock Bot
// ABOUTME: Contains rate limits, cache TTLs, timeouts, and display settings

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
  // Using deferred responses, we have up to 15 minutes
  MASSIVE_TIMEOUT: 10000,   // 10 seconds for stock data
  OPENAI_TIMEOUT: 30000,    // 30 seconds for AI summary with web search
  
  // Market Configuration
  SUPPORTED_MARKETS: ['US'],   // Future: add international
  
  // Display
  CHART_HEIGHT: 7,             // ASCII chart resolution
  EMBED_COLOR_POSITIVE: 0x00ff00,  // Green
  EMBED_COLOR_NEGATIVE: 0xff0000,  // Red
  EMBED_COLOR_NEUTRAL: 0x808080,   // Gray
};
