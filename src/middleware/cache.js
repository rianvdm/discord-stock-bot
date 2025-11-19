// ABOUTME: Cache manager for handling Cloudflare KV storage operations
// ABOUTME: Manages caching of stock prices, historical data, and AI summaries with configurable TTLs

import { CONFIG } from '../config.js';

/**
 * Generates a cache key for KV storage
 * @param {string} type - Type of data: 'price', 'history', or 'summary'
 * @param {string} ticker - Stock ticker symbol
 * @param {number} [days] - Number of days (for history data)
 * @returns {string} Cache key
 */
export function generateCacheKey(type, ticker, days) {
  const normalizedTicker = ticker.toUpperCase();
  
  if (type === 'history' && days !== undefined) {
    return `stock:history:${normalizedTicker}:${days}`;
  }
  
  return `stock:${type}:${normalizedTicker}`;
}

/**
 * Gets the TTL (Time To Live) in seconds for a cache type
 * @param {string} type - Type of data: 'price', 'history', or 'summary'
 * @returns {number} TTL in seconds
 */
export function getTTL(type) {
  const ttls = {
    price: CONFIG.CACHE_TTL_PRICE,       // 300 seconds (5 minutes)
    history: CONFIG.CACHE_TTL_HISTORY,   // 3600 seconds (1 hour)
    summary: CONFIG.CACHE_TTL_SUMMARY,   // 28800 seconds (8 hours)
  };
  
  return ttls[type] || CONFIG.CACHE_TTL_PRICE;
}

/**
 * Retrieves cached data from KV storage
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} type - Type of data: 'price', 'history', or 'summary'
 * @param {string} ticker - Stock ticker symbol
 * @param {number} [days] - Number of days (for history data)
 * @returns {Promise<any|null>} Cached data or null if not found/error
 */
export async function getCached(kv, type, ticker, days) {
  try {
    const key = generateCacheKey(type, ticker, days);
    const cached = await kv.get(key);
    
    if (!cached) {
      console.log(`[CACHE MISS] ${key}`);
      return null;
    }
    
    console.log(`[CACHE HIT] ${key}`);
    return JSON.parse(cached);
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to get cached data for ${ticker}:`, error.message);
    return null;
  }
}

/**
 * Stores data in KV cache with appropriate TTL
 * @param {KVNamespace} kv - Cloudflare KV namespace
 * @param {string} type - Type of data: 'price', 'history', or 'summary'
 * @param {string} ticker - Stock ticker symbol
 * @param {any} value - Data to cache
 * @param {number} [days] - Number of days (for history data)
 * @returns {Promise<void>}
 */
export async function setCached(kv, type, ticker, value, days) {
  try {
    const key = generateCacheKey(type, ticker, days);
    const ttl = getTTL(type);
    const serialized = JSON.stringify(value);
    
    await kv.put(key, serialized, { expirationTtl: ttl });
    console.log(`[CACHE SET] ${key} (TTL: ${ttl}s)`);
  } catch (error) {
    console.warn(`[CACHE ERROR] Failed to set cache for ${ticker}:`, error.message);
    // Fail silently - caching is not critical to operation
  }
}
