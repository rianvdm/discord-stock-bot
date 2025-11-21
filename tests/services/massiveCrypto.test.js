// ABOUTME: Test suite for Massive.com crypto API service
// ABOUTME: Verifies crypto historical data fetching and error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCryptoHistoricalData, fetchCryptoQuote } from '../../src/services/massiveCrypto.js';

describe('Massive Crypto Service', () => {
  const mockApiKey = 'test-massive-api-key';
  const mockPolygonTicker = 'X:BTCUSD';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCryptoHistoricalData', () => {
    it('should fetch historical crypto data successfully', async () => {
      const mockResponse = {
        ticker: mockPolygonTicker,
        status: 'OK',
        results: [
          { c: 42000.00, h: 42500.00, l: 41500.00, o: 41800.00, v: 1000, t: 1700000000000 },
          { c: 42500.00, h: 43000.00, l: 42000.00, o: 42000.00, v: 1200, t: 1700086400000 },
          { c: 43000.00, h: 43500.00, l: 42500.00, o: 42500.00, v: 1100, t: 1700172800000 }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey);

      expect(result).toBeDefined();
      expect(result.status).toBe('ok');
      expect(result.closingPrices).toHaveLength(3);
      expect(result.closingPrices).toEqual([42000.00, 42500.00, 43000.00]);
      expect(result.timestamps).toHaveLength(3);
      expect(result.timestamps[0]).toBe(1700000000); // Converted from ms to seconds

      // Verify API was called with correct Polygon format
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(mockPolygonTicker),
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle empty results', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: []
        })
      });

      await expect(fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey))
        .rejects
        .toThrow('No historical data available');
    });

    it('should handle missing results field', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK'
        })
      });

      await expect(fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey))
        .rejects
        .toThrow('No historical data available');
    });

    it('should handle 404 errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey))
        .rejects
        .toThrow('not found');
    });

    it('should handle API errors in response body', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ERROR',
          error: 'Invalid API key'
        })
      });

      await expect(fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey))
        .rejects
        .toThrow('Invalid API key');
    });

    it('should retry on transient errors', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            status: 'OK',
            results: [
              { c: 42000.00, h: 42500.00, l: 41500.00, o: 41800.00, v: 1000, t: 1700000000000 }
            ]
          })
        });
      });

      const result = await fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey);
      
      expect(result).toBeDefined();
      expect(result.closingPrices).toHaveLength(1);
      expect(callCount).toBe(2); // First call failed, second succeeded
    });

    it('should not retry on 404 errors', async () => {
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: false,
          status: 404,
          statusText: 'Not Found'
        });
      });

      await expect(fetchCryptoHistoricalData(mockPolygonTicker, 7, mockApiKey))
        .rejects
        .toThrow('not found');
      
      expect(callCount).toBe(1); // Should not retry on 404
    });

    it('should handle different time periods', async () => {
      const periods = [7, 30, 90];
      
      for (const days of periods) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            status: 'OK',
            results: Array(days).fill(null).map((_, i) => ({
              c: 42000 + i * 100,
              h: 42500 + i * 100,
              l: 41500 + i * 100,
              o: 41800 + i * 100,
              v: 1000,
              t: 1700000000000 + i * 86400000
            }))
          })
        });

        const result = await fetchCryptoHistoricalData(mockPolygonTicker, days, mockApiKey);
        expect(result.closingPrices).toHaveLength(days);
      }
    });
  });

  describe('fetchCryptoQuote', () => {
    it('should fetch crypto quote successfully', async () => {
      const mockResponse = {
        ticker: mockPolygonTicker,
        status: 'OK',
        results: [
          { c: 42500.50, h: 43000.00, l: 41000.00, o: 41300.20, v: 15000, t: 1700000000000 }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      });

      const result = await fetchCryptoQuote(mockPolygonTicker, mockApiKey);

      expect(result).toBeDefined();
      expect(result.ticker).toBe(mockPolygonTicker);
      expect(result.currentPrice).toBe(42500.50);
      expect(result.open).toBe(41300.20);
      expect(result.high).toBe(43000.00);
      expect(result.low).toBe(41000.00);
      expect(result.volume).toBe(15000);
      
      // Verify change calculations
      const expectedChange = 42500.50 - 41300.20;
      const expectedChangePercent = ((42500.50 - 41300.20) / 41300.20) * 100;
      expect(result.changeAmount).toBeCloseTo(expectedChange, 2);
      expect(result.changePercent).toBeCloseTo(expectedChangePercent, 2);
    });

    it('should handle empty results in quote', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: []
        })
      });

      await expect(fetchCryptoQuote(mockPolygonTicker, mockApiKey))
        .rejects
        .toThrow('Invalid data');
    });

    it('should validate required fields in quote', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'OK',
          results: [
            { c: 42500.50 } // Missing other required fields
          ]
        })
      });

      await expect(fetchCryptoQuote(mockPolygonTicker, mockApiKey))
        .rejects
        .toThrow('Invalid data');
    });
  });
});
