// ABOUTME: Massive.com API client for fetching stock quotes and historical data
// ABOUTME: Includes timeout handling, retry logic, and ticker suggestion functionality

import { CONFIG } from '../config.js';

const MASSIVE_BASE_URL = 'https://api.massive.com';

/**
 * Common ticker misspellings and company name mappings
 */
const COMMON_TICKER_CORRECTIONS = {
  // Common typos
  'APPL': 'AAPL',
  'GOGL': 'GOOGL',
  
  // Company names to tickers
  'APPLE': 'AAPL',
  'NVIDIA': 'NVDA',
  'GOOGLE': 'GOOGL',
  'ALPHABET': 'GOOGL',
  'MICROSOFT': 'MSFT',
  'AMAZON': 'AMZN',
  'TESLA': 'TSLA',
  'FACEBOOK': 'META',
  'META': 'META',
  'NETFLIX': 'NFLX',
  'CLOUDFLARE': 'NET',
  'AMD': 'AMD',
  'INTEL': 'INTC',
  'DISNEY': 'DIS',
  'BOEING': 'BA',
  'VISA': 'V',
  'JPMORGAN': 'JPM',
  'WALMART': 'WMT',
  'COCA-COLA': 'KO',
  'COCACOLA': 'KO',
  'PEPSI': 'PEP',
  'MCDONALD': 'MCD',
  'MCDONALDS': 'MCD',
  'STARBUCKS': 'SBUX',
  'NIKE': 'NKE',
  'ORACLE': 'ORCL',
  'SALESFORCE': 'CRM',
  'ADOBE': 'ADBE',
  'PAYPAL': 'PYPL',
  'UBER': 'UBER',
  'LYFT': 'LYFT',
  'SPOTIFY': 'SPOT',
  'SNAPCHAT': 'SNAP',
  'TWITTER': 'X',
  'AIRBNB': 'ABNB',
  'ZOOM': 'ZM',
  'PINTEREST': 'PINS',
  'ROBLOX': 'RBLX',
  'SHOPIFY': 'SHOP',
  'SQUARE': 'SQ',
  'STRIPE': 'PRIVATE', // Not public yet, but commonly searched
  
  // Existing correct tickers (pass-through)
  'AAPL': 'AAPL',
  'NVDA': 'NVDA',
  'GOOGL': 'GOOGL',
  'GOOG': 'GOOG',
  'MSFT': 'MSFT',
  'AMZN': 'AMZN',
  'TSLA': 'TSLA',
  'NFLX': 'NFLX',
  'NET': 'NET',
  'INTC': 'INTC',
  'DIS': 'DIS',
  'BA': 'BA',
  'V': 'V',
  'JPM': 'JPM',
};

/**
 * Popular tickers for partial match suggestions
 */
const POPULAR_TICKERS = [
  'AAPL', 'GOOGL', 'GOOG', 'MSFT', 'AMZN', 'TSLA', 'META', 
  'NVDA', 'NFLX', 'NET', 'AMD', 'INTC', 'DIS', 'BA', 'V', 'JPM'
];

/**
 * Ticker to company name mapping for popular stocks
 * Used for AI summaries to provide better context
 */
const TICKER_TO_COMPANY_NAME = {
  'AAPL': 'Apple Inc.',
  'MSFT': 'Microsoft Corporation',
  'GOOGL': 'Alphabet Inc.',
  'GOOG': 'Alphabet Inc.',
  'AMZN': 'Amazon.com Inc.',
  'NVDA': 'NVIDIA Corporation',
  'META': 'Meta Platforms Inc.',
  'TSLA': 'Tesla Inc.',
  'BRK.B': 'Berkshire Hathaway Inc.',
  'BRK.A': 'Berkshire Hathaway Inc.',
  'LLY': 'Eli Lilly and Company',
  'V': 'Visa Inc.',
  'UNH': 'UnitedHealth Group Inc.',
  'XOM': 'Exxon Mobil Corporation',
  'WMT': 'Walmart Inc.',
  'JPM': 'JPMorgan Chase & Co.',
  'MA': 'Mastercard Inc.',
  'JNJ': 'Johnson & Johnson',
  'PG': 'Procter & Gamble Co.',
  'AVGO': 'Broadcom Inc.',
  'HD': 'The Home Depot Inc.',
  'CVX': 'Chevron Corporation',
  'MRK': 'Merck & Co. Inc.',
  'ABBV': 'AbbVie Inc.',
  'COST': 'Costco Wholesale Corporation',
  'KO': 'The Coca-Cola Company',
  'PEP': 'PepsiCo Inc.',
  'ADBE': 'Adobe Inc.',
  'NFLX': 'Netflix Inc.',
  'CRM': 'Salesforce Inc.',
  'DIS': 'The Walt Disney Company',
  'CSCO': 'Cisco Systems Inc.',
  'ORCL': 'Oracle Corporation',
  'INTC': 'Intel Corporation',
  'AMD': 'Advanced Micro Devices Inc.',
  'NKE': 'Nike Inc.',
  'PYPL': 'PayPal Holdings Inc.',
  'CMCSA': 'Comcast Corporation',
  'TMO': 'Thermo Fisher Scientific Inc.',
  'QCOM': 'QUALCOMM Inc.',
  'TXN': 'Texas Instruments Inc.',
  'BA': 'The Boeing Company',
  'UNP': 'Union Pacific Corporation',
  'NEE': 'NextEra Energy Inc.',
  'HON': 'Honeywell International Inc.',
  'SBUX': 'Starbucks Corporation',
  'PM': 'Philip Morris International Inc.',
  'T': 'AT&T Inc.',
  'VZ': 'Verizon Communications Inc.',
  'GE': 'General Electric Company',
  'IBM': 'International Business Machines',
  'CAT': 'Caterpillar Inc.',
  'GS': 'The Goldman Sachs Group Inc.',
  'MS': 'Morgan Stanley',
  'AXP': 'American Express Company',
  'MMM': '3M Company',
  'NET': 'Cloudflare Inc.',
  'UBER': 'Uber Technologies Inc.',
  'LYFT': 'Lyft Inc.',
  'ABNB': 'Airbnb Inc.',
  'SNOW': 'Snowflake Inc.',
  'ZM': 'Zoom Video Communications',
  'SPOT': 'Spotify Technology',
  'SNAP': 'Snap Inc.',
  'PINS': 'Pinterest Inc.',
  'RBLX': 'Roblox Corporation',
  'SHOP': 'Shopify Inc.',
  'SQ': 'Block Inc.',
  'COIN': 'Coinbase Global Inc.',
  'ROKU': 'Roku Inc.',
  'DKNG': 'DraftKings Inc.',
  'PLTR': 'Palantir Technologies Inc.',
};

/**
 * Fetch current stock quote from Massive.com
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} apiKey - Massive.com API key
 * @returns {Promise<Object>} Quote data with current price, change, etc.
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchQuote(ticker, apiKey) {
  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Validate response data
  if (!data || !data.results || data.results.length === 0) {
    throw new Error('Invalid data received from Massive.com API');
  }

  const result = data.results[0];
  
  // Validate required fields
  if (typeof result.c !== 'number' || typeof result.o !== 'number') {
    throw new Error('Invalid data received from Massive.com API');
  }

  // Transform Massive.com response to our format
  // API returns previous day's data, so we use close as current price
  const changeAmount = result.c - result.o;
  const changePercent = ((result.c - result.o) / result.o) * 100;
  
  return {
    ticker: ticker,
    companyName: ticker, // Massive.com doesn't provide company name, use ticker for now
    currentPrice: result.c,
    changeAmount: changeAmount,
    changePercent: changePercent,
    high: result.h,
    low: result.l,
    open: result.o,
    previousClose: result.o, // Open price is the previous close for this day
    timestamp: Math.floor(result.t / 1000) // Convert from ms to seconds
  };
}

/**
 * Fetch historical stock data from Massive.com
 * @param {string} ticker - Stock ticker symbol
 * @param {number} days - Number of days of historical data to fetch
 * @param {string} apiKey - Massive.com API key
 * @returns {Promise<Object>} Historical data with closing prices and timestamps
 * @throws {Error} If API request fails or data is invalid
 */
export async function fetchHistoricalData(ticker, days, apiKey) {
  // Calculate date range in YYYY-MM-DD format
  const toDate = new Date();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - days);
  
  const to = toDate.toISOString().split('T')[0];
  const from = fromDate.toISOString().split('T')[0];

  const url = `${MASSIVE_BASE_URL}/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?adjusted=true&sort=asc&apiKey=${apiKey}`;
  
  const data = await fetchWithRetry(url, {
    method: 'GET',
  });

  // Validate response data
  if (!data || !data.results || !Array.isArray(data.results)) {
    throw new Error('No historical data available for this ticker');
  }

  if (data.results.length === 0) {
    throw new Error('No historical data available for this ticker');
  }

  // Extract closing prices and timestamps
  const closingPrices = data.results.map(r => r.c);
  const timestamps = data.results.map(r => Math.floor(r.t / 1000)); // Convert from ms to seconds

  return {
    closingPrices,
    timestamps,
    status: 'ok'
  };
}

/**
 * Get ticker symbol from company name if it exists in our mappings
 * @param {string} companyName - Company name (e.g., "NVIDIA")
 * @returns {string|null} Ticker symbol (e.g., "NVDA") or null if not found
 */
export function getTickerFromCompanyName(companyName) {
  if (!companyName || typeof companyName !== 'string') {
    return null;
  }
  
  const upperName = companyName.toUpperCase();
  return COMMON_TICKER_CORRECTIONS[upperName] || null;
}

/**
 * Get company name from ticker symbol
 * @param {string} ticker - Stock ticker symbol (e.g., "AAPL")
 * @returns {string} Company name if found in mapping, otherwise returns the ticker
 */
export function getCompanyName(ticker) {
  if (!ticker || typeof ticker !== 'string') {
    return ticker;
  }
  
  const upperTicker = ticker.toUpperCase();
  return TICKER_TO_COMPANY_NAME[upperTicker] || ticker;
}

/**
 * Suggest alternative ticker symbols for potential typos
 * @param {string} ticker - User-entered ticker symbol
 * @returns {string[]} Array of suggested ticker symbols
 */
export function suggestTickers(ticker) {
  if (!ticker || ticker.length === 0) {
    return [];
  }

  const upperTicker = ticker.toUpperCase();
  const suggestions = new Set();

  // Check for exact match in corrections
  if (COMMON_TICKER_CORRECTIONS[upperTicker]) {
    suggestions.add(COMMON_TICKER_CORRECTIONS[upperTicker]);
  }

  // Check for partial matches in popular tickers
  if (upperTicker.length >= 2) {
    for (const popularTicker of POPULAR_TICKERS) {
      // Exact match
      if (popularTicker === upperTicker) {
        suggestions.add(popularTicker);
      }
      // Starts with the input
      else if (popularTicker.startsWith(upperTicker)) {
        suggestions.add(popularTicker);
      }
      // Levenshtein distance of 1 (one character different)
      else if (isCloseMatch(upperTicker, popularTicker)) {
        suggestions.add(popularTicker);
      }
    }
  }

  // Limit to 5 suggestions
  return Array.from(suggestions).slice(0, 5);
}

/**
 * Check if two strings are close matches (Levenshtein distance <= 1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {boolean} True if strings differ by at most 1 character
 */
function isCloseMatch(str1, str2) {
  if (Math.abs(str1.length - str2.length) > 1) {
    return false;
  }

  let differences = 0;
  const maxLen = Math.max(str1.length, str2.length);
  
  for (let i = 0; i < maxLen; i++) {
    if (str1[i] !== str2[i]) {
      differences++;
      if (differences > 1) {
        return false;
      }
    }
  }

  return differences === 1;
}

/**
 * Fetch with timeout, retry logic, and error handling
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} If request fails after retries
 */
async function fetchWithRetry(url, options = {}) {
  const maxRetries = 1;
  let lastError;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const attemptStart = Date.now();
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.MASSIVE_TIMEOUT);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Handle HTTP errors
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Stock ticker not found');
        }
        throw new Error(`Massive.com API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Performance: Log API response time
      const duration = Date.now() - attemptStart;
      const totalDuration = Date.now() - startTime;
      console.log('[PERF] Massive.com API response time', {
        duration: `${duration}ms`,
        totalDuration: `${totalDuration}ms`,
        attempt: attempt + 1,
        cached: false,
      });
      
      // Debug: log response for troubleshooting
      console.log('[DEBUG] Massive.com API response:', JSON.stringify(data).substring(0, 200));
      
      // Check for API error in response body (Massive.com returns 200 with error field)
      if (data.status === 'ERROR' || data.error) {
        throw new Error(data.error || data.message || 'Unknown API error');
      }
      
      return data;

    } catch (error) {
      lastError = error;

      // Don't retry on 404, validation errors, or abort/timeout errors
      if (error.message.includes('not found') || 
          error.message.includes('Invalid data') ||
          error.message.includes('aborted') ||
          error.name === 'AbortError') {
        throw error;
      }

      // If this wasn't the last attempt, wait before retrying (exponential backoff)
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, delay));
        console.warn(`[WARN] Massive.com request failed, retrying (attempt ${attempt + 2}/${maxRetries + 1})`, {
          error: error.message,
          url
        });
      }
    }
  }

  // All retries exhausted
  console.error('[ERROR] Massive.com request failed after all retries', {
    error: lastError?.message,
    url
  });
  throw lastError;
}
