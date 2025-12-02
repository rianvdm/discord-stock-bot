// ABOUTME: Rate limiter middleware for enforcing per-user rate limits using Cloudflare KV
// ABOUTME: Allows 5 requests per 60 seconds per user using sliding window with timestamp array

import { CONFIG } from '../config.js';

/**
 * Checks if a user is rate limited using a sliding window approach
 * Stores an array of timestamps for recent requests
 * @param {KVNamespace} kv - Cloudflare KV namespace for rate limits
 * @param {string} userId - Discord user ID
 * @returns {Promise<{allowed: boolean, remaining: number, timeRemaining: number}>}
 */
export async function checkRateLimit(kv, userId) {
  try {
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;
    const maxRequests = CONFIG.RATE_LIMIT_MAX_REQUESTS;

    const storedData = await kv.get(key);

    let timestamps = [];
    if (storedData) {
      try {
        timestamps = JSON.parse(storedData);
        if (!Array.isArray(timestamps)) {
          console.warn(`[RATE LIMIT] Invalid data format for user ${userId}, resetting`);
          timestamps = [];
        }
      } catch {
        console.warn(`[RATE LIMIT] Failed to parse data for user ${userId}, resetting`);
        timestamps = [];
      }
    }

    // Filter to only timestamps within the current window
    const validTimestamps = timestamps.filter(ts => (now - ts) < windowMs);

    if (validTimestamps.length >= maxRequests) {
      // Rate limited - find when the oldest request will expire
      const oldestTimestamp = Math.min(...validTimestamps);
      const timeRemaining = Math.ceil((oldestTimestamp + windowMs - now) / 1000);
      const remaining = 0;

      console.log(`[RATE LIMIT] User ${userId} is rate limited (${timeRemaining}s remaining, ${validTimestamps.length}/${maxRequests} used)`);
      return { allowed: false, remaining, timeRemaining };
    }

    // Allowed
    const remaining = maxRequests - validTimestamps.length - 1; // -1 for this request
    return { allowed: true, remaining, timeRemaining: 0 };
  } catch (error) {
    console.error(`[RATE LIMIT ERROR] Failed to check rate limit for ${userId}:`, error.message);
    // Fail open - allow the request if KV is unavailable
    return { allowed: true, remaining: CONFIG.RATE_LIMIT_MAX_REQUESTS - 1, timeRemaining: 0 };
  }
}

/**
 * Updates the rate limit by adding current timestamp to the array
 * @param {KVNamespace} kv - Cloudflare KV namespace for rate limits
 * @param {string} userId - Discord user ID
 * @returns {Promise<void>}
 */
export async function updateRateLimit(kv, userId) {
  try {
    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const windowMs = CONFIG.RATE_LIMIT_WINDOW_SECONDS * 1000;

    // Get existing timestamps
    const storedData = await kv.get(key);
    let timestamps = [];

    if (storedData) {
      try {
        timestamps = JSON.parse(storedData);
        if (!Array.isArray(timestamps)) {
          timestamps = [];
        }
      } catch {
        timestamps = [];
      }
    }

    // Filter to valid timestamps and add current one
    const validTimestamps = timestamps.filter(ts => (now - ts) < windowMs);
    validTimestamps.push(now);

    // Store with 60s TTL (KV minimum) - data will auto-expire
    await kv.put(key, JSON.stringify(validTimestamps), { expirationTtl: CONFIG.RATE_LIMIT_WINDOW_SECONDS });

    console.log(`[RATE LIMIT] Updated rate limit for user ${userId} (${validTimestamps.length}/${CONFIG.RATE_LIMIT_MAX_REQUESTS} requests in window)`);
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

  // Update the rate limit timestamps
  await updateRateLimit(kv, userId);

  return null;
}
