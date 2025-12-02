// ABOUTME: Tests for the rate limiter middleware that enforces per-user rate limits
// ABOUTME: Uses sliding window with timestamp array to allow 5 requests per 60 seconds

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  updateRateLimit,
  enforceRateLimit,
} from '../../src/middleware/rateLimit.js';

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

  describe('checkRateLimit', () => {
    it('should allow first request (no previous record)', async () => {
      mockKV.get.mockResolvedValue(null);
      const now = Date.now();
      vi.setSystemTime(now);

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
      expect(result.remaining).toBe(4); // 5 max - 1 for this request
      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:user123');
    });

    it('should allow up to 5 requests within 60 seconds', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // User has made 4 requests in the last 60 seconds
      const timestamps = [now - 50000, now - 40000, now - 30000, now - 20000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(0); // This is the 5th request
    });

    it('should block 6th request within 60 seconds', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // User has made 5 requests in the last 60 seconds
      const timestamps = [now - 50000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.timeRemaining).toBe(10); // Oldest request (50s ago) expires in 10s
    });

    it('should allow request after oldest timestamp expires', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // 5 requests, but oldest is 65 seconds ago (expired)
      const timestamps = [now - 65000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await checkRateLimit(mockKV, 'user123');

      // Only 4 timestamps are valid (within 60s), so this 5th request is allowed
      expect(result.allowed).toBe(true);
    });

    it('should calculate time remaining correctly', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // 5 requests, oldest was 45 seconds ago
      const timestamps = [now - 45000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(false);
      expect(result.timeRemaining).toBe(15); // 60 - 45 = 15 seconds until oldest expires
    });

    it('should handle KV errors gracefully (fail open)', async () => {
      mockKV.get.mockRejectedValue(new Error('KV unavailable'));

      const result = await checkRateLimit(mockKV, 'user123');

      // Should allow request when KV is unavailable (fail open for better UX)
      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should handle invalid JSON data', async () => {
      mockKV.get.mockResolvedValue('invalid-json');

      const result = await checkRateLimit(mockKV, 'user123');

      // Should allow request when data is invalid
      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should handle non-array data', async () => {
      mockKV.get.mockResolvedValue(JSON.stringify({ not: 'an array' }));

      const result = await checkRateLimit(mockKV, 'user123');

      // Should allow request when data format is wrong
      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should not interfere between different users', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // User 1 is at limit (5 requests)
      const user1Timestamps = [now - 50000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValueOnce(JSON.stringify(user1Timestamps));
      const result1 = await checkRateLimit(mockKV, 'user123');
      expect(result1.allowed).toBe(false);

      // User 2 has no previous request
      mockKV.get.mockResolvedValueOnce(null);
      const result2 = await checkRateLimit(mockKV, 'user456');
      expect(result2.allowed).toBe(true);

      // Verify different keys were used
      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:user123');
      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:user456');
    });
  });

  describe('updateRateLimit', () => {
    it('should store timestamp array with 60s TTL', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      mockKV.get.mockResolvedValue(null);

      await updateRateLimit(mockKV, 'user123');

      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        JSON.stringify([now]),
        { expirationTtl: 60 }
      );
    });

    it('should append to existing timestamps', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      const existingTimestamps = [now - 30000, now - 20000];
      mockKV.get.mockResolvedValue(JSON.stringify(existingTimestamps));

      await updateRateLimit(mockKV, 'user123');

      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        JSON.stringify([now - 30000, now - 20000, now]),
        { expirationTtl: 60 }
      );
    });

    it('should filter out expired timestamps when updating', async () => {
      const now = Date.now();
      vi.setSystemTime(now);
      // One expired (70s ago), two valid
      const existingTimestamps = [now - 70000, now - 30000, now - 20000];
      mockKV.get.mockResolvedValue(JSON.stringify(existingTimestamps));

      await updateRateLimit(mockKV, 'user123');

      // Should only include valid timestamps plus the new one
      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        JSON.stringify([now - 30000, now - 20000, now]),
        { expirationTtl: 60 }
      );
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockRejectedValue(new Error('KV unavailable'));

      // Should not throw
      await expect(updateRateLimit(mockKV, 'user123')).resolves.toBeUndefined();
    });

    it('should use different keys for different users', async () => {
      mockKV.get.mockResolvedValue(null);

      await updateRateLimit(mockKV, 'user123');
      await updateRateLimit(mockKV, 'user456');

      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        expect.any(String),
        { expirationTtl: 60 }
      );
      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user456',
        expect.any(String),
        { expirationTtl: 60 }
      );
    });
  });

  describe('enforceRateLimit', () => {
    it('should return null and update rate limit when allowed', async () => {
      mockKV.get.mockResolvedValue(null);
      const now = Date.now();
      vi.setSystemTime(now);

      const result = await enforceRateLimit(mockKV, 'user123');

      expect(result).toBeNull();
      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        JSON.stringify([now]),
        { expirationTtl: 60 }
      );
    });

    it('should return error object when rate limited', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // User has made 5 requests
      const timestamps = [now - 50000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await enforceRateLimit(mockKV, 'user123');

      expect(result).not.toBeNull();
      expect(result.rateLimited).toBe(true);
      expect(result.timeRemaining).toBe(10);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should allow request and update after oldest timestamp expires', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // 5 requests, but oldest expired
      const timestamps = [now - 65000, now - 40000, now - 30000, now - 20000, now - 10000];
      mockKV.get.mockResolvedValue(JSON.stringify(timestamps));

      const result = await enforceRateLimit(mockKV, 'user123');

      expect(result).toBeNull();
      expect(mockKV.put).toHaveBeenCalled();
    });

    it('should handle KV errors gracefully (fail open)', async () => {
      mockKV.get.mockRejectedValue(new Error('KV unavailable'));

      const result = await enforceRateLimit(mockKV, 'user123');

      // Should allow request when KV is unavailable
      expect(result).toBeNull();
    });
  });
});
