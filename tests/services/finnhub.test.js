// ABOUTME: Tests for Finnhub API client service
// ABOUTME: Verifies quote fetching, historical data, error handling, and retry logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchQuote, fetchHistoricalData, suggestTickers } from '../../src/services/finnhub.js';

describe('Finnhub Service', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.useFakeTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchQuote', () => {
    it('should successfully fetch quote data', async () => {
      vi.useRealTimers(); // Use real timers for this test
      
      const mockResponse = {
        c: 175.43,  // current price
        h: 176.12,  // high
        l: 174.21,  // low
        o: 174.50,  // open
        pc: 171.33, // previous close
        t: 1700000000 // timestamp
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await fetchQuote('AAPL', 'test_api_key');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://finnhub.io/api/v1/quote?symbol=AAPL&token=test_api_key',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal)
        })
      );

      expect(result).toEqual({
        currentPrice: 175.43,
        change: 175.43 - 171.33,
        changePercent: ((175.43 - 171.33) / 171.33) * 100,
        high: 176.12,
        low: 174.21,
        open: 174.50,
        previousClose: 171.33,
        timestamp: 1700000000
      });
    });

    it('should handle 404 error for invalid ticker', async () => {
      vi.useRealTimers(); // Use real timers
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fetchQuote('INVALIDTICKER', 'test_api_key'))
        .rejects.toThrow('Stock ticker not found');
    });

    it('should timeout after 10 seconds', async () => {
      vi.useRealTimers(); // Use real timers for timeout test
      
      global.fetch = vi.fn().mockImplementation((_url, options) => 
        new Promise((resolve, reject) => {
          // Simulate a slow response that will be aborted
          options.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        })
      );

      await expect(fetchQuote('AAPL', 'test_api_key'))
        .rejects.toThrow();
    }, 12000); // Extend test timeout to 12 seconds

    it('should retry once on network error', async () => {
      vi.useRealTimers(); // Use real timers for retry test
      
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            c: 175.43,
            h: 176.12,
            l: 174.21,
            o: 174.50,
            pc: 171.33,
            t: 1700000000
          })
        });
      });

      const result = await fetchQuote('AAPL', 'test_api_key');

      expect(callCount).toBe(2);
      expect(result.currentPrice).toBe(175.43);
    }, 10000);

    it('should fail after retry attempts exhausted', async () => {
      vi.useRealTimers(); // Use real timers
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchQuote('AAPL', 'test_api_key'))
        .rejects.toThrow('Network error');

      expect(global.fetch).toHaveBeenCalledTimes(2); // Original + 1 retry
    }, 10000);

    it('should handle API error responses', async () => {
      vi.useRealTimers(); // Use real timers
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(fetchQuote('AAPL', 'test_api_key'))
        .rejects.toThrow('Finnhub API error');
    });

    it('should handle missing data in response', async () => {
      vi.useRealTimers(); // Use real timers
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}) // Empty response
      });

      await expect(fetchQuote('AAPL', 'test_api_key'))
        .rejects.toThrow('Invalid data received');
    });
  });

  describe('fetchHistoricalData', () => {
    it('should successfully fetch historical data', async () => {
      vi.useRealTimers();
      
      const mockResponse = {
        c: [171.33, 172.45, 173.12, 174.21, 175.43],
        h: [172.10, 173.50, 174.00, 175.12, 176.12],
        l: [170.50, 171.80, 172.45, 173.50, 174.21],
        o: [171.00, 172.00, 173.00, 174.00, 175.00],
        s: 'ok',
        t: [1699920000, 1700006400, 1700092800, 1700179200, 1700265600],
        v: [50000000, 48000000, 52000000, 49000000, 51000000]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await fetchHistoricalData('AAPL', 7, 'test_api_key');

      // Verify URL includes proper timestamps
      const fetchCall = global.fetch.mock.calls[0][0];
      expect(fetchCall).toContain('https://finnhub.io/api/v1/stock/candle');
      expect(fetchCall).toContain('symbol=AAPL');
      expect(fetchCall).toContain('resolution=D');
      expect(fetchCall).toContain('from=');
      expect(fetchCall).toContain('to=');
      expect(fetchCall).toContain('token=test_api_key');

      expect(result).toEqual({
        closingPrices: [171.33, 172.45, 173.12, 174.21, 175.43],
        timestamps: [1699920000, 1700006400, 1700092800, 1700179200, 1700265600],
        status: 'ok'
      });
    });

    it('should handle no_data status from API', async () => {
      vi.useRealTimers();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          s: 'no_data'
        })
      });

      await expect(fetchHistoricalData('AAPL', 7, 'test_api_key'))
        .rejects.toThrow('No historical data available');
    });

    it('should retry on network error', async () => {
      vi.useRealTimers();
      
      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            c: [171.33, 172.45],
            s: 'ok',
            t: [1699920000, 1700006400]
          })
        });
      });

      const result = await fetchHistoricalData('AAPL', 7, 'test_api_key');

      expect(callCount).toBe(2);
      expect(result.closingPrices).toEqual([171.33, 172.45]);
    }, 10000);

    it('should timeout after 10 seconds', async () => {
      vi.useRealTimers();
      
      global.fetch = vi.fn().mockImplementation((_url, options) => 
        new Promise((resolve, reject) => {
          // Simulate a slow response that will be aborted
          options.signal.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        })
      );

      await expect(fetchHistoricalData('AAPL', 7, 'test_api_key'))
        .rejects.toThrow();
    }, 12000);

    it('should handle 404 error', async () => {
      vi.useRealTimers();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found'
      });

      await expect(fetchHistoricalData('INVALIDTICKER', 7, 'test_api_key'))
        .rejects.toThrow('Stock ticker not found');
    });

    it('should calculate correct date range for different periods', async () => {
      vi.useRealTimers();
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          c: [100, 101, 102],
          s: 'ok',
          t: [1, 2, 3]
        })
      });

      await fetchHistoricalData('AAPL', 30, 'test_api_key');

      const fetchCall = global.fetch.mock.calls[0][0];
      const url = new URL(fetchCall);
      const fromParam = parseInt(url.searchParams.get('from'));
      const toParam = parseInt(url.searchParams.get('to'));

      // Should be approximately 30 days apart (in seconds)
      const daysDiff = (toParam - fromParam) / (60 * 60 * 24);
      expect(daysDiff).toBeGreaterThanOrEqual(29);
      expect(daysDiff).toBeLessThanOrEqual(31);
    });
  });

  describe('suggestTickers', () => {
    it('should suggest common alternatives for misspellings', () => {
      expect(suggestTickers('APPL')).toContain('AAPL');
      expect(suggestTickers('GOGL')).toContain('GOOGL');
      expect(suggestTickers('MSFT')).toContain('MSFT'); // Exact match
      expect(suggestTickers('TSLA')).toContain('TSLA'); // Exact match
    });

    it('should suggest NET for Cloudflare variations', () => {
      const suggestions = suggestTickers('CLOUDFLARE');
      expect(suggestions).toContain('NET');
    });

    it('should handle empty or invalid input', () => {
      expect(suggestTickers('')).toEqual([]);
      expect(suggestTickers('XYZ123456789')).toEqual([]);
    });

    it('should suggest case-insensitive matches', () => {
      expect(suggestTickers('aapl')).toContain('AAPL');
      expect(suggestTickers('AaPl')).toContain('AAPL');
    });

    it('should limit suggestions to reasonable number', () => {
      const suggestions = suggestTickers('A');
      expect(suggestions.length).toBeLessThanOrEqual(5);
    });

    it('should handle partial matches', () => {
      const suggestions = suggestTickers('AA');
      expect(suggestions.length).toBeGreaterThan(0);
      // Should include tickers starting with AA like AAPL
      expect(suggestions).toContain('AAPL');
    });
  });

  describe('exponential backoff', () => {
    it('should wait before retrying', async () => {
      vi.useRealTimers();
      
      let callCount = 0;
      const callTimes = [];
      
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        callTimes.push(Date.now());
        
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            c: 175.43,
            h: 176.12,
            l: 174.21,
            o: 174.50,
            pc: 171.33,
            t: 1700000000
          })
        });
      });

      await fetchQuote('AAPL', 'test_api_key');

      expect(callCount).toBe(2);
      // Verify there was a delay between calls (should be at least 1 second)
      if (callTimes.length === 2) {
        const delay = callTimes[1] - callTimes[0];
        expect(delay).toBeGreaterThanOrEqual(900); // Allow some tolerance
      }
    }, 10000);
  });
});
