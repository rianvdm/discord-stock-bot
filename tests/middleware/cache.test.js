// ABOUTME: Tests for the cache manager middleware that handles KV storage operations
// ABOUTME: for stock price, historical data, and AI summary caching.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateCacheKey,
  getCached,
  setCached,
  getTTL,
} from '../../src/middleware/cache.js';

describe('Cache Manager', () => {
  describe('generateCacheKey', () => {
    it('should generate key for price data', () => {
      const key = generateCacheKey('price', 'AAPL');
      expect(key).toBe('stock:price:AAPL');
    });

    it('should generate key for history data with days', () => {
      const key = generateCacheKey('history', 'AAPL', 7);
      expect(key).toBe('stock:history:AAPL:7');
    });

    it('should generate key for summary data', () => {
      const key = generateCacheKey('summary', 'NET');
      expect(key).toBe('stock:summary:NET');
    });

    it('should normalize ticker to uppercase', () => {
      const key = generateCacheKey('price', 'aapl');
      expect(key).toBe('stock:price:AAPL');
    });
  });

  describe('getTTL', () => {
    it('should return 300 seconds for price data', () => {
      expect(getTTL('price')).toBe(300);
    });

    it('should return 3600 seconds for history data', () => {
      expect(getTTL('history')).toBe(3600);
    });

    it('should return 28800 seconds for summary data', () => {
      expect(getTTL('summary')).toBe(28800);
    });

    it('should return default TTL for unknown type', () => {
      expect(getTTL('unknown')).toBe(300);
    });
  });

  describe('getCached', () => {
    let mockKV;

    beforeEach(() => {
      mockKV = {
        get: vi.fn(),
      };
    });

    it('should return parsed data on cache hit', async () => {
      const testData = { price: 175.43, change: 2.3 };
      mockKV.get.mockResolvedValue(JSON.stringify(testData));

      const result = await getCached(mockKV, 'price', 'AAPL');

      expect(result).toEqual(testData);
      expect(mockKV.get).toHaveBeenCalledWith('stock:price:AAPL');
    });

    it('should return null on cache miss', async () => {
      mockKV.get.mockResolvedValue(null);

      const result = await getCached(mockKV, 'price', 'AAPL');

      expect(result).toBeNull();
    });

    it('should handle JSON parse errors gracefully', async () => {
      mockKV.get.mockResolvedValue('invalid json{');

      const result = await getCached(mockKV, 'price', 'AAPL');

      expect(result).toBeNull();
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.get.mockRejectedValue(new Error('KV unavailable'));

      const result = await getCached(mockKV, 'price', 'AAPL');

      expect(result).toBeNull();
    });

    it('should pass days parameter for history data', async () => {
      const testData = [171.2, 172.5, 173.1, 174.2, 175.4];
      mockKV.get.mockResolvedValue(JSON.stringify(testData));

      const result = await getCached(mockKV, 'history', 'AAPL', 7);

      expect(result).toEqual(testData);
      expect(mockKV.get).toHaveBeenCalledWith('stock:history:AAPL:7');
    });
  });

  describe('setCached', () => {
    let mockKV;

    beforeEach(() => {
      mockKV = {
        put: vi.fn().mockResolvedValue(undefined),
      };
    });

    it('should store data with correct TTL for price', async () => {
      const testData = { price: 175.43, change: 2.3 };

      await setCached(mockKV, 'price', 'AAPL', testData);

      expect(mockKV.put).toHaveBeenCalledWith(
        'stock:price:AAPL',
        JSON.stringify(testData),
        { expirationTtl: 300 }
      );
    });

    it('should store data with correct TTL for history', async () => {
      const testData = [171.2, 172.5, 173.1];

      await setCached(mockKV, 'history', 'NET', testData, 7);

      expect(mockKV.put).toHaveBeenCalledWith(
        'stock:history:NET:7',
        JSON.stringify(testData),
        { expirationTtl: 3600 }
      );
    });

    it('should store data with correct TTL for summary', async () => {
      const testData = 'AI generated summary about the stock';

      await setCached(mockKV, 'summary', 'GOOGL', testData);

      expect(mockKV.put).toHaveBeenCalledWith(
        'stock:summary:GOOGL',
        JSON.stringify(testData),
        { expirationTtl: 28800 }
      );
    });

    it('should handle KV errors gracefully', async () => {
      mockKV.put.mockRejectedValue(new Error('KV unavailable'));

      // Should not throw
      await expect(
        setCached(mockKV, 'price', 'AAPL', { price: 100 })
      ).resolves.toBeUndefined();
    });

    it('should handle non-serializable data gracefully', async () => {
      const circular = {};
      circular.self = circular; // Create circular reference

      // Should not throw
      await expect(
        setCached(mockKV, 'price', 'AAPL', circular)
      ).resolves.toBeUndefined();
    });
  });
});
