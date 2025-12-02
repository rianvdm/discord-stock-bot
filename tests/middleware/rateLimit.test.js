// ABOUTME: Tests for rate limiter behavior
// ABOUTME: Tests outcomes (allowed/blocked) not implementation details

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { enforceRateLimit } from '../../src/middleware/rateLimit.js';
import { CONFIG } from '../../src/config.js';

describe('Rate Limiter', () => {
  let mockKV;

  beforeEach(() => {
    mockKV = {
      get: vi.fn(),
      put: vi.fn().mockResolvedValue(undefined),
    };
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should allow first request from a user', async () => {
    mockKV.get.mockResolvedValue(null);

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).toBeNull(); // null means allowed
  });

  it('should allow up to 5 requests per minute', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // Simulate 4 previous requests
    mockKV.get.mockResolvedValue(JSON.stringify([now - 40000, now - 30000, now - 20000, now - 10000]));

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).toBeNull(); // 5th request allowed
  });

  it('should block 6th request within a minute', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // Simulate 5 previous requests (at limit)
    mockKV.get.mockResolvedValue(JSON.stringify([now - 50000, now - 40000, now - 30000, now - 20000, now - 10000]));

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).not.toBeNull();
    expect(result.rateLimited).toBe(true);
    expect(result.timeRemaining).toBeGreaterThan(0);
  });

  it('should allow request after oldest one expires', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // 5 requests, but oldest is 65 seconds ago (expired)
    mockKV.get.mockResolvedValue(JSON.stringify([now - 65000, now - 40000, now - 30000, now - 20000, now - 10000]));

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).toBeNull(); // Allowed because oldest expired
  });

  it('should track users independently', async () => {
    const now = Date.now();
    vi.setSystemTime(now);

    // User A at limit
    mockKV.get.mockResolvedValueOnce(JSON.stringify([now - 50000, now - 40000, now - 30000, now - 20000, now - 10000]));
    const resultA = await enforceRateLimit(mockKV, 'userA');
    expect(resultA).not.toBeNull();

    // User B has no requests
    mockKV.get.mockResolvedValueOnce(null);
    const resultB = await enforceRateLimit(mockKV, 'userB');
    expect(resultB).toBeNull();
  });

  it('should fail open when KV is unavailable', async () => {
    mockKV.get.mockRejectedValue(new Error('KV unavailable'));

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).toBeNull(); // Allow request when KV fails
  });

  it('should handle corrupted KV data gracefully', async () => {
    mockKV.get.mockResolvedValue('not-valid-json');

    const result = await enforceRateLimit(mockKV, 'user123');

    expect(result).toBeNull(); // Allow request when data is corrupt
  });
});
