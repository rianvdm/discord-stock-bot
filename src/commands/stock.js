// ABOUTME: Handler for /stock command that provides stock price, trend, and AI summary
// ABOUTME: Validates ticker, enforces rate limiting, and returns rich Discord embed response

import { parseSlashCommand, createEmbedResponse } from '../services/discord.js';
import { validateTicker } from '../utils/validator.js';
import { enforceRateLimit } from '../middleware/rateLimit.js';
import { BotError, ErrorTypes, formatErrorResponse, logError } from '../utils/errorHandler.js';
import { getCached, setCached } from '../middleware/cache.js';
import { fetchQuote, fetchHistoricalData, suggestTickers } from '../services/massive.js';
import { generateAISummary } from '../services/openai.js';
import { formatChartWithLabels } from '../utils/chartGenerator.js';
import { buildStockEmbed } from '../utils/embedBuilder.js';
import { CONFIG } from '../config.js';

/**
 * Handle the /stock command
 * @param {Object} interaction - Discord interaction object
 * @param {Object} env - Cloudflare Workers environment with KV namespaces and API keys
 * @returns {Promise<Object>} Discord interaction response
 */
export async function handleStockCommand(interaction, env) {
  try {
    // 1. Parse the slash command to extract options and user info
    const parsed = parseSlashCommand(interaction);
    const rawTicker = parsed.options.ticker;
    const userId = parsed.userId;

    console.log('[INFO] Stock command received', {
      ticker: rawTicker,
      userId,
      username: parsed.username
    });

    // 2. Validate the ticker symbol
    const validation = validateTicker(rawTicker);
    
    if (!validation.valid) {
      const error = new BotError(
        ErrorTypes.INVALID_INPUT,
        validation.error,
        null,
        { ticker: rawTicker }
      );
      
      logError(error, { userId, rawTicker });
      return formatErrorResponse(error);
    }

    const ticker = validation.ticker; // Cleaned and uppercase ticker
    console.log('[INFO] Ticker validated', { ticker, userId });

    // 3. Enforce rate limiting
    const rateLimitResult = await enforceRateLimit(env.RATE_LIMITS, userId);
    
    if (rateLimitResult && rateLimitResult.rateLimited) {
      const error = new BotError(
        ErrorTypes.RATE_LIMIT,
        `You're querying too quickly! Please wait ${rateLimitResult.timeRemaining} seconds before trying again.`,
        null,
        { timeRemaining: rateLimitResult.timeRemaining }
      );
      
      logError(error, { userId, ticker });
      return formatErrorResponse(error);
    }

    console.log('[INFO] Rate limit passed', { userId, ticker });

    // 4. Fetch stock data (price, history, AI summary)
    const stockData = await fetchStockData(ticker, env);

    console.log('[INFO] Stock data fetched successfully', { 
      ticker, 
      userId,
      hasSummary: !!stockData.summary 
    });

    // 5. Build and return response
    const response = buildStockResponse(stockData);

    console.log('[INFO] Stock command completed successfully', { ticker, userId });
    
    return response;
    
  } catch (error) {
    // Handle unexpected errors
    console.error('[ERROR] Stock command failed', {
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
 * Fetch stock data with parallel cache checks and API calls
 * @param {string} ticker - Validated and uppercase ticker symbol
 * @param {Object} env - Cloudflare Workers environment
 * @returns {Promise<Object>} Stock data with price, history, and optional summary
 * @throws {BotError} If stock data cannot be fetched
 */
async function fetchStockData(ticker, env) {
  const cacheKV = env.CACHE;
  const massiveApiKey = env.MASSIVE_API_KEY;
  const openaiApiKey = env.OPENAI_API_KEY;

  try {
    // Step 1: Check all caches in parallel
    console.log('[INFO] Checking caches for', ticker);
    const [cachedPrice, cachedHistory, cachedSummary] = await Promise.all([
      getCached(cacheKV, 'price', ticker),
      getCached(cacheKV, 'history', ticker, CONFIG.DEFAULT_PERIOD_DAYS),
      getCached(cacheKV, 'summary', ticker)
    ]);

    // Step 2: Fetch missing data from APIs in parallel
    const fetchPromises = [];
    
    // Fetch price if not cached
    if (!cachedPrice) {
      console.log('[INFO] Fetching quote from Massive.com', { ticker });
      fetchPromises.push(
        fetchQuote(ticker, massiveApiKey)
          .then(data => ({ type: 'price', data }))
          .catch(error => ({ type: 'price', error }))
      );
    }

    // Fetch history if not cached
    if (!cachedHistory) {
      console.log('[INFO] Fetching historical data from Massive.com', { ticker });
      fetchPromises.push(
        fetchHistoricalData(ticker, CONFIG.DEFAULT_PERIOD_DAYS, massiveApiKey)
          .then(data => ({ type: 'history', data }))
          .catch(error => ({ type: 'history', error }))
      );
    }

    // Fetch AI summary if not cached (non-blocking, can fail)
    if (!cachedSummary) {
      console.log('[INFO] Fetching AI summary from OpenAI', { ticker });
      fetchPromises.push(
        generateAISummary(ticker, ticker, openaiApiKey) // Using ticker as company name for now
          .then(data => ({ type: 'summary', data }))
          .catch(error => ({ type: 'summary', error }))
      );
    }

    // Wait for all fetches to complete
    const fetchResults = await Promise.all(fetchPromises);

    // Step 3: Process fetch results and prepare final data
    let priceData = cachedPrice;
    let historyData = cachedHistory;
    let summaryData = cachedSummary;
    let hasStockDataError = false;

    for (const result of fetchResults) {
      if (result.error) {
        // Handle errors
        if (result.type === 'price' || result.type === 'history') {
          // Critical data failed
          hasStockDataError = true;
          console.error(`[ERROR] Failed to fetch ${result.type}`, {
            ticker,
            error: result.error.message
          });
        } else if (result.type === 'summary') {
          // AI summary failed - not critical
          console.warn(`[WARN] AI summary failed (non-critical)`, {
            ticker,
            error: result.error.message
          });
        }
      } else {
        // Store successful results
        if (result.type === 'price') {
          priceData = result.data;
        } else if (result.type === 'history') {
          historyData = result.data;
        } else if (result.type === 'summary') {
          summaryData = result.data;
        }
      }
    }

    // If critical stock data failed, throw error with suggestions
    if (hasStockDataError || !priceData || !historyData) {
      const suggestions = suggestTickers(ticker);
      throw new BotError(
        ErrorTypes.NOT_FOUND,
        `Stock ticker **"${ticker}"** not found. Please check the ticker symbol and try again.`,
        suggestions.length > 0 ? suggestions : null,
        { ticker }
      );
    }

    // Step 4: Update caches in parallel for successfully fetched data
    const cacheUpdatePromises = [];

    if (!cachedPrice && priceData) {
      cacheUpdatePromises.push(setCached(cacheKV, 'price', ticker, priceData));
    }

    if (!cachedHistory && historyData) {
      cacheUpdatePromises.push(
        setCached(cacheKV, 'history', ticker, historyData, CONFIG.DEFAULT_PERIOD_DAYS)
      );
    }

    if (!cachedSummary && summaryData) {
      cacheUpdatePromises.push(setCached(cacheKV, 'summary', ticker, summaryData));
    }

    // Update caches (fire and forget, don't wait)
    if (cacheUpdatePromises.length > 0) {
      Promise.all(cacheUpdatePromises).catch(error => {
        console.warn('[WARN] Cache update failed', { ticker, error: error.message });
      });
    }

    // Step 5: Return complete stock data
    return {
      ticker,
      price: priceData,
      history: historyData,
      summary: summaryData || null // null if AI summary failed
    };

  } catch (error) {
    // Handle errors that are already BotErrors
    if (error instanceof BotError) {
      throw error;
    }

    // Handle API-specific errors
    if (error.message && error.message.includes('not found')) {
      const suggestions = suggestTickers(ticker);
      throw new BotError(
        ErrorTypes.NOT_FOUND,
        `Stock ticker **"${ticker}"** not found. Please check the ticker symbol and try again.`,
        suggestions.length > 0 ? suggestions : null,
        { ticker, originalError: error.message }
      );
    }

    // Generic API failure
    throw new BotError(
      ErrorTypes.API_FAILURE,
      'Unable to fetch stock data. Please try again later.',
      null,
      { ticker, originalError: error.message }
    );
  }
}

/**
 * Build the final stock response with embed
 * @param {Object} stockData - Complete stock data including price, history, and summary
 * @returns {Object} Discord interaction response with embed
 */
function buildStockResponse(stockData) {
  const { price, history, summary } = stockData;

  // Generate chart from historical closing prices
  const chart = formatChartWithLabels(history.closingPrices);

  // Determine if market is open (for now, always show as closed since we use previous close)
  // Future enhancement: implement actual market hours detection
  const marketOpen = false;

  // Build the stock embed with all data
  const embed = buildStockEmbed(
    {
      ticker: price.ticker,
      companyName: price.companyName,
      currentPrice: price.currentPrice,
      changePercent: price.changePercent,
      changeAmount: price.changeAmount
    },
    chart,
    summary, // Can be null if AI summary failed
    marketOpen
  );

  // Return as non-ephemeral embed response (visible to everyone)
  return createEmbedResponse(embed, false);
}
