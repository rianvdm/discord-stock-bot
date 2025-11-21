// ABOUTME: Handler for /crypto command that provides cryptocurrency price, trend, and AI summary
// ABOUTME: Validates crypto symbol, enforces rate limiting, and returns rich Discord embed response

import { parseSlashCommand, createEmbedResponse } from '../services/discord.js';
import { validateCrypto, suggestCryptos, getCryptoDisplayName } from '../utils/cryptoValidator.js';
import { enforceRateLimit } from '../middleware/rateLimit.js';
import { BotError, ErrorTypes, formatErrorResponse, logError } from '../utils/errorHandler.js';
import { getCached, setCached } from '../middleware/cache.js';
import { fetchCryptoHistoricalData } from '../services/massiveCrypto.js';
import { fetchCryptoQuote } from '../services/finnhubCrypto.js';
import { generateAISummary } from '../services/openai.js';
import { formatChartWithLabels } from '../utils/chartGenerator.js';
import { buildCryptoEmbed } from '../utils/embedBuilder.js';
import { CONFIG } from '../config.js';

/**
 * Handle the /crypto command
 * @param {Object} interaction - Discord interaction object
 * @param {Object} env - Cloudflare Workers environment with KV namespaces and API keys
 * @returns {Promise<Object>} Discord interaction response
 */
export async function handleCryptoCommand(interaction, env) {
  try {
    // 1. Parse the slash command to extract options and user info
    const parsed = parseSlashCommand(interaction);
    const rawSymbol = parsed.options.symbol || parsed.options.crypto;
    const userId = parsed.userId;

    console.log('[INFO] Crypto command received', {
      symbol: rawSymbol,
      userId,
      username: parsed.username
    });

    // 2. Validate the crypto symbol
    const validation = validateCrypto(rawSymbol);
    
    if (!validation.valid) {
      const error = new BotError(
        ErrorTypes.INVALID_INPUT,
        validation.error,
        null,
        { symbol: rawSymbol }
      );
      
      logError(error, { userId, rawSymbol });
      return formatErrorResponse(error);
    }

    const symbol = validation.symbol; // Cleaned crypto symbol (e.g., 'BTC')
    const polygonTicker = validation.polygonTicker; // Polygon format (e.g., 'X:BTCUSD')
    console.log('[INFO] Crypto symbol validated', { symbol, polygonTicker, userId });

    // 3. Enforce rate limiting
    const rateLimitResult = await enforceRateLimit(env.RATE_LIMITS, userId);
    
    if (rateLimitResult && rateLimitResult.rateLimited) {
      const error = new BotError(
        ErrorTypes.RATE_LIMIT,
        `You're querying too quickly! Please wait ${rateLimitResult.timeRemaining} seconds before trying again.`,
        null,
        { timeRemaining: rateLimitResult.timeRemaining }
      );
      
      logError(error, { userId, symbol });
      return formatErrorResponse(error);
    }

    console.log('[INFO] Rate limit passed', { userId, symbol });

    // 4. Fetch crypto data (price, history, AI summary)
    const cryptoData = await fetchCryptoData(symbol, polygonTicker, env);

    console.log('[INFO] Crypto data fetched successfully', { 
      symbol, 
      userId,
      hasSummary: !!cryptoData.summary 
    });

    // 5. Build and return response
    const response = buildCryptoResponse(cryptoData);

    console.log('[INFO] Crypto command completed successfully', { symbol, userId });
    
    return response;
    
  } catch (error) {
    // If it's already a BotError with specific handling, re-throw it
    if (error instanceof BotError) {
      throw error;
    }
    
    // Handle unexpected errors
    console.error('[ERROR] Crypto command failed', {
      error: error.message,
      stack: error.stack,
      userId: interaction.user?.id || interaction.member?.user?.id
    });

    // Return generic error to user
    const botError = new BotError(
      ErrorTypes.UNKNOWN,
      'An unexpected error occurred. Please try again later.',
      null,
      { originalError: error.message }
    );
    
    return formatErrorResponse(botError);
  }
}

/**
 * Fetch crypto data with parallel cache checks and API calls
 * @param {string} symbol - Validated crypto symbol (e.g., 'BTC')
 * @param {string} polygonTicker - Polygon.io format ticker (e.g., 'X:BTCUSD')
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Promise<Object>} Crypto data with price, history, and optional summary
 * @throws {BotError} If crypto data cannot be fetched
 */
async function fetchCryptoData(symbol, polygonTicker, env) {
  const cacheKV = env.CACHE;
  const massiveApiKey = env.MASSIVE_API_KEY;
  const openaiApiKey = env.OPENAI_API_KEY;
  const finnhubApiKey = env.FINNHUB_API_KEY;

  try {
    // Step 1: Check all caches in parallel
    console.log('[INFO] Checking caches for crypto', symbol);
    const [cachedHistory, cachedSummary, cachedQuote] = await Promise.all([
      getCached(cacheKV, 'crypto_history', symbol, CONFIG.DEFAULT_PERIOD_DAYS),
      getCached(cacheKV, 'crypto_summary', symbol),
      getCached(cacheKV, 'crypto_quote', symbol)
    ]);

    // Step 2: Fetch missing data from APIs in parallel
    const fetchPromises = [];
    
    // Fetch history if not cached (from Massive.com)
    if (!cachedHistory) {
      console.log('[INFO] Fetching crypto historical data from Massive.com', { symbol, polygonTicker });
      fetchPromises.push(
        fetchCryptoHistoricalData(polygonTicker, CONFIG.DEFAULT_PERIOD_DAYS, massiveApiKey)
          .then(data => ({ type: 'history', data }))
          .catch(error => ({ type: 'history', error }))
      );
    }

    // Fetch real-time quote if not cached (from Finnhub)
    if (!cachedQuote) {
      console.log('[INFO] Fetching crypto quote from Finnhub', { symbol });
      fetchPromises.push(
        fetchCryptoQuote(symbol, finnhubApiKey)
          .then(data => ({ type: 'quote', data }))
          .catch(error => ({ type: 'quote', error }))
      );
    }

    // Fetch AI summary if not cached (non-blocking, can fail)
    if (!cachedSummary) {
      console.log('[INFO] Fetching AI summary from OpenAI', { symbol });
      const displayName = getCryptoDisplayName(symbol);
      fetchPromises.push(
        generateAISummary(symbol, displayName, openaiApiKey)
          .then(data => ({ type: 'summary', data }))
          .catch(error => ({ type: 'summary', error }))
      );
    }

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // Step 3: Process fetch results and prepare final data
    let historyData = cachedHistory;
    let summaryData = cachedSummary;
    let quoteData = cachedQuote;
    let hasCryptoDataError = false;

    for (const result of fetchResults) {
      if (result.error) {
        // Handle errors
        if (result.type === 'history' || result.type === 'quote') {
          // Critical data failed
          hasCryptoDataError = true;
          console.error(`[ERROR] Failed to fetch ${result.type}`, {
            symbol,
            error: result.error.message
          });
        } else if (result.type === 'summary') {
          // AI summary failed - not critical
          console.warn(`[WARN] ${result.type} failed (non-critical)`, {
            symbol,
            error: result.error.message
          });
        }
      } else {
        // Store successful results
        if (result.type === 'history') {
          historyData = result.data;
        } else if (result.type === 'summary') {
          summaryData = result.data;
        } else if (result.type === 'quote') {
          quoteData = result.data;
        }
      }
    }

    // If critical crypto data failed, throw error with suggestions
    if (hasCryptoDataError || !quoteData || !historyData) {
      const suggestions = suggestCryptos(symbol);
      throw new BotError(
        ErrorTypes.NOT_FOUND,
        `Cryptocurrency **"${symbol}"** not found. Please check the symbol and try again.`,
        suggestions.length > 0 ? suggestions : null,
        { symbol }
      );
    }

    // Build price data object
    const displayName = getCryptoDisplayName(symbol);
    const priceData = {
      symbol: symbol,
      name: displayName,
      currentPrice: quoteData.currentPrice,
      changeAmount: quoteData.change,
      changePercent: quoteData.changePercent,
      timestamp: quoteData.timestamp,
      isOpen: quoteData.isOpen, // Always true for crypto
      exchange: quoteData.exchange
    };

    // Step 4: Update caches in parallel for successfully fetched data
    const cacheUpdatePromises = [];

    if (!cachedHistory && historyData) {
      cacheUpdatePromises.push(
        setCached(cacheKV, 'crypto_history', symbol, historyData, CONFIG.DEFAULT_PERIOD_DAYS)
      );
    }

    if (!cachedSummary && summaryData) {
      cacheUpdatePromises.push(setCached(cacheKV, 'crypto_summary', symbol, summaryData));
    }

    if (!cachedQuote && quoteData) {
      cacheUpdatePromises.push(setCached(cacheKV, 'crypto_quote', symbol, quoteData));
    }

    // Update caches (fire and forget, don't wait)
    if (cacheUpdatePromises.length > 0) {
      Promise.all(cacheUpdatePromises).catch(error => {
        console.warn('[WARN] Cache update failed', { symbol, error: error.message });
      });
    }

    // Step 5: Return complete crypto data
    return {
      symbol,
      price: priceData,
      history: historyData,
      summary: summaryData || null, // null if AI summary failed
    };

  } catch (error) {
    // Handle errors that are already BotErrors
    if (error instanceof BotError) {
      throw error;
    }

    // Handle API-specific errors
    if (error.message && error.message.includes('not found')) {
      const suggestions = suggestCryptos(symbol);
      throw new BotError(
        ErrorTypes.NOT_FOUND,
        `Cryptocurrency **"${symbol}"** not found. Please check the symbol and try again.`,
        suggestions.length > 0 ? suggestions : null,
        { symbol, originalError: error.message }
      );
    }

    // Generic API failure
    throw new BotError(
      ErrorTypes.API_FAILURE,
      'Unable to fetch crypto data. Please try again later.',
      null,
      { symbol, originalError: error.message }
    );
  }
}

/**
 * Build the final crypto response with embed
 * @param {Object} cryptoData - Complete crypto data including price, history, and summary
 * @returns {Object} Discord interaction response with embed
 */
function buildCryptoResponse(cryptoData) {
  const { price, history, summary } = cryptoData;

  // Combine 29 days of historical data with current price for accurate 30-day trend
  const last29Days = history.closingPrices.slice(0, 29);
  const trendPrices = [...last29Days, price.currentPrice];
  
  // Generate chart from combined price data
  const chart = formatChartWithLabels(trendPrices);

  // Build the crypto embed with all data
  const embed = buildCryptoEmbed(
    {
      symbol: price.symbol,
      name: price.name,
      currentPrice: price.currentPrice,
      changePercent: price.changePercent,
      changeAmount: price.changeAmount,
      exchange: price.exchange
    },
    chart,
    summary // Can be null if AI summary failed
  );

  // Return as non-ephemeral embed response (visible to everyone)
  return createEmbedResponse(embed, false);
}
