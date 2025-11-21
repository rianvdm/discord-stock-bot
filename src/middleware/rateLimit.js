// ABOUTME: Rate limiter middleware for enforcing per-user rate limits using Cloudflare KV
// ABOUTME: Prevents users from making more than 1 request per 60 seconds (KV minimum TTL).

import { CONFIG } from '../config.js';

/**
 * Checks if a user is rate limited
 * @param {KVNamespace} kv - Cloudflare KV namespace for rate limits
 * @param {string} userId - Discord user ID
 * @returns {Promise<{allowed: boolean, timeRemaining: number}>}
 */
export async function checkRateLimit(kv, userId) {
  try {
    const key = `ratelimit:${userId}`;
    const lastRequestStr = await kv.get(key);
    
    if (!lastRequestStr) {
      // No previous request found
      return { allowed: true, timeRemaining: 0 };
    }
    
    const lastRequest = parseInt(lastRequestStr, 10);
    if (isNaN(lastRequest)) {
      // Invalid timestamp, allow request
      console.warn(`[RATE LIMIT] Invalid timestamp for user ${userId}`);
      return { allowed: true, timeRemaining: 0 };
    }
    
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequest;
    const rateLimitMs = CONFIG.RATE_LIMIT_SECONDS * 1000;
    
    if (timeSinceLastRequest < rateLimitMs) {
      // Rate limited
      const timeRemaining = Math.ceil((rateLimitMs - timeSinceLastRequest) / 1000);
      console.log(`[RATE LIMIT] User ${userId} is rate limited (${timeRemaining}s remaining)`);
      return { allowed: false, timeRemaining };
    }
    
    // Rate limit period has passed
    return { allowed: true, timeRemaining: 0 };
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to check rate limit for ${userId}:`, error.message);
    // Fail open - allow the request if KV is unavailable
    return { allowed: true, timeRemaining: 0 };
  }
}

/**
 * Updates the rate limit timestamp for a user
 * @param {KVNamespace} kv - Cloudflare KV namespace for rate limits
 * @param {string} userId - Discord user ID
 * @returns {Promise<void>}
 */
export async function updateRateLimit(kv, userId) {
  try {
    const key = `ratelimit:${userId}`;
    const now = Date.now().toString();
    
    await kv.put(key, now, { expirationTtl: CONFIG.RATE_LIMIT_SECONDS });
    console.log(`[RATE LIMIT] Updated rate limit for user ${userId}`);
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to update rate limit for ${userId}:`, error.message);
    // Fail silently - rate limiting is not critical to operation
  }
}

/**
 * Enforces rate limiting for a user
 * Combines check and update in one function
 * @param {KVNamespace} kv - Cloudflare KV namespace for rate limits
 * @param {string} userId - Discord user ID
 * @returns {Promise<null|{rateLimited: boolean, timeRemaining: number}>}
 *          Returns null if allowed, error object if rate limited
 */
export async function enforceRateLimit(kv, userId) {
  const { allowed, timeRemaining } = await checkRateLimit(kv, userId);
  
  if (!allowed) {
    return {
      rateLimited: true,
      timeRemaining,
    };
  }
  
  // Update the rate limit timestamp
  await updateRateLimit(kv, userId);
  
  return null;
}
