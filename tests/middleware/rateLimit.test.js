// ABOUTME: Tests for the rate limiter middleware that enforces per-user rate limits
// ABOUTME: using Cloudflare KV storage to track user request timestamps.

import { describe, it, expect, beforeEach, vi } from 'vitest';
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
      expect(mockKV.get).toHaveBeenCalledWith('ratelimit:user123');
    });

    it('should block request within 60 seconds', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 30 seconds
      vi.setSystemTime(lastRequest + 30000);

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(false);
      expect(result.timeRemaining).toBe(30);
    });

    it('should allow request after 60 seconds', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 60 seconds
      vi.setSystemTime(lastRequest + 60000);

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should allow request after more than 60 seconds', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 65 seconds
      vi.setSystemTime(lastRequest + 65000);

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should calculate time remaining correctly', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 45 seconds
      vi.setSystemTime(lastRequest + 45000);

      const result = await checkRateLimit(mockKV, 'user123');

      expect(result.allowed).toBe(false);
      expect(result.timeRemaining).toBe(15);
    });

    it('should handle KV errors gracefully (fail open)', async () => {
      mockKV.get.mockRejectedValue(new Error('KV unavailable'));

      const result = await checkRateLimit(mockKV, 'user123');

      // Should allow request when KV is unavailable (fail open for better UX)
      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should handle invalid timestamp data', async () => {
      mockKV.get.mockResolvedValue('invalid-timestamp');

      const result = await checkRateLimit(mockKV, 'user123');

      // Should allow request when timestamp is invalid
      expect(result.allowed).toBe(true);
      expect(result.timeRemaining).toBe(0);
    });

    it('should not interfere between different users', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      // User 1 made a request
      mockKV.get.mockResolvedValueOnce(now.toString());
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
    it('should store current timestamp with 60s TTL', async () => {
      const now = Date.now();
      vi.setSystemTime(now);

      await updateRateLimit(mockKV, 'user123');

      expect(mockKV.put).toHaveBeenCalledWith(
        'ratelimit:user123',
        now.toString(),
        { expirationTtl: 60 }
      );
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.put.mockRejectedValue(new Error('KV unavailable'));

      // Should not throw
      await expect(updateRateLimit(mockKV, 'user123')).resolves.toBeUndefined();
    });

    it('should use different keys for different users', async () => {
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
        now.toString(),
        { expirationTtl: 60 }
      );
    });

    it('should return error object when rate limited', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 30 seconds
      vi.setSystemTime(lastRequest + 30000);

      const result = await enforceRateLimit(mockKV, 'user123');

      expect(result).not.toBeNull();
      expect(result.rateLimited).toBe(true);
      expect(result.timeRemaining).toBe(30);
      expect(mockKV.put).not.toHaveBeenCalled();
    });

    it('should allow request and update after cooldown period', async () => {
      const lastRequest = Date.now();
      vi.setSystemTime(lastRequest);
      mockKV.get.mockResolvedValue(lastRequest.toString());
      
      // Move time forward 60 seconds
      vi.setSystemTime(lastRequest + 60000);

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
