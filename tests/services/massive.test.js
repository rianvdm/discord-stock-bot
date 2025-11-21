// ABOUTME: Tests for Massive.com API client service
// ABOUTME: Verifies quote fetching, historical data, error handling, and retry logic

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchQuote, fetchHistoricalData, suggestTickers, getTickerFromCompanyName, getCompanyName } from '../../src/services/massive.js';

describe('Massive.com Service', () => {
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
        results: [{
          c: 175.43,  // close (current price)
          h: 176.12,  // high
          l: 174.21,  // low
          o: 174.50,  // open
          v: 1000000, // volume
          t: 1700000000000 // timestamp in milliseconds
        }]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await fetchQuote('AAPL', 'test_api_key');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.massive.com/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=test_api_key',
        expect.objectContaining({
          method: 'GET',
          signal: expect.any(AbortSignal)
        })
      );

      expect(result).toEqual({
        ticker: 'AAPL',
        companyName: 'AAPL',
        currentPrice: 175.43,
        changeAmount: 175.43 - 174.50,
        changePercent: ((175.43 - 174.50) / 174.50) * 100,
        high: 176.12,
        low: 174.21,
        open: 174.50,
        previousClose: 174.50,
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
            results: [{
              c: 175.43,
              h: 176.12,
              l: 174.21,
              o: 174.50,
              t: 1700000000000
            }]
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
        .rejects.toThrow('Massive.com API error');
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
        results: [
          { c: 171.33, h: 172.10, l: 170.50, o: 171.00, t: 1699920000000, v: 50000000 },
          { c: 172.45, h: 173.50, l: 171.80, o: 172.00, t: 1700006400000, v: 48000000 },
          { c: 173.12, h: 174.00, l: 172.45, o: 173.00, t: 1700092800000, v: 52000000 },
          { c: 174.21, h: 175.12, l: 173.50, o: 174.00, t: 1700179200000, v: 49000000 },
          { c: 175.43, h: 176.12, l: 174.21, o: 175.00, t: 1700265600000, v: 51000000 }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockResponse
      });

      const result = await fetchHistoricalData('AAPL', 7, 'test_api_key');

      // Verify URL includes proper date range
      const fetchCall = global.fetch.mock.calls[0][0];
      expect(fetchCall).toContain('https://api.massive.com/v2/aggs/ticker/AAPL/range/1/day/');
      expect(fetchCall).toContain('adjusted=true');
      expect(fetchCall).toContain('apiKey=test_api_key');

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
          results: [] // Empty results array means no data
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
            results: [
              { c: 171.33, t: 1699920000000 },
              { c: 172.45, t: 1700006400000 }
            ]
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
          results: [
            { c: 100, t: 1000000000 },
            { c: 101, t: 2000000000 },
            { c: 102, t: 3000000000 }
          ]
        })
      });

      await fetchHistoricalData('AAPL', 30, 'test_api_key');

      const fetchCall = global.fetch.mock.calls[0][0];
      // URL format: /v2/aggs/ticker/AAPL/range/1/day/YYYY-MM-DD/YYYY-MM-DD
      expect(fetchCall).toContain('/v2/aggs/ticker/AAPL/range/1/day/');
      expect(fetchCall).toContain('adjusted=true');
      
      // Extract the dates from the URL path
      const dateMatch = fetchCall.match(/\/range\/1\/day\/(\d{4}-\d{2}-\d{2})\/(\d{4}-\d{2}-\d{2})/);
      if (dateMatch) {
        const fromDate = new Date(dateMatch[1]);
        const toDate = new Date(dateMatch[2]);
        const daysDiff = (toDate - fromDate) / (1000 * 60 * 60 * 24);
        expect(daysDiff).toBeGreaterThanOrEqual(29);
        expect(daysDiff).toBeLessThanOrEqual(31);
      }
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

    it('should map company names to tickers', () => {
      expect(suggestTickers('NVIDIA')).toContain('NVDA');
      expect(suggestTickers('APPLE')).toContain('AAPL');
      expect(suggestTickers('GOOGLE')).toContain('GOOGL');
      expect(suggestTickers('ALPHABET')).toContain('GOOGL');
      expect(suggestTickers('MICROSOFT')).toContain('MSFT');
      expect(suggestTickers('AMAZON')).toContain('AMZN');
      expect(suggestTickers('TESLA')).toContain('TSLA');
      expect(suggestTickers('FACEBOOK')).toContain('META');
      expect(suggestTickers('NETFLIX')).toContain('NFLX');
    });

    it('should map more company names to tickers', () => {
      expect(suggestTickers('DISNEY')).toContain('DIS');
      expect(suggestTickers('INTEL')).toContain('INTC');
      expect(suggestTickers('NIKE')).toContain('NKE');
      expect(suggestTickers('STARBUCKS')).toContain('SBUX');
      expect(suggestTickers('WALMART')).toContain('WMT');
      expect(suggestTickers('COCA-COLA')).toContain('KO');
      expect(suggestTickers('COCACOLA')).toContain('KO');
    });

    it('should handle company names case-insensitively', () => {
      expect(suggestTickers('nvidia')).toContain('NVDA');
      expect(suggestTickers('NvIdIa')).toContain('NVDA');
      expect(suggestTickers('apple')).toContain('AAPL');
    });
  });

  describe('getTickerFromCompanyName', () => {
    it('should return ticker for valid company names', () => {
      expect(getTickerFromCompanyName('NVIDIA')).toBe('NVDA');
      expect(getTickerFromCompanyName('APPLE')).toBe('AAPL');
      expect(getTickerFromCompanyName('GOOGLE')).toBe('GOOGL');
      expect(getTickerFromCompanyName('MICROSOFT')).toBe('MSFT');
    });

    it('should be case-insensitive', () => {
      expect(getTickerFromCompanyName('nvidia')).toBe('NVDA');
      expect(getTickerFromCompanyName('NvIdIa')).toBe('NVDA');
      expect(getTickerFromCompanyName('apple')).toBe('AAPL');
    });

    it('should return null for unknown company names', () => {
      expect(getTickerFromCompanyName('UNKNOWNCOMPANY')).toBeNull();
      expect(getTickerFromCompanyName('INVALIDNAME')).toBeNull();
    });

    it('should return null for invalid input', () => {
      expect(getTickerFromCompanyName('')).toBeNull();
      expect(getTickerFromCompanyName(null)).toBeNull();
      expect(getTickerFromCompanyName(undefined)).toBeNull();
      expect(getTickerFromCompanyName(123)).toBeNull();
    });

    it('should pass through valid tickers as-is', () => {
      expect(getTickerFromCompanyName('NVDA')).toBe('NVDA');
      expect(getTickerFromCompanyName('AAPL')).toBe('AAPL');
      expect(getTickerFromCompanyName('NET')).toBe('NET');
    });
  });

  describe('getCompanyName', () => {
    it('should return company name for valid tickers', () => {
      expect(getCompanyName('AAPL')).toBe('Apple Inc.');
      expect(getCompanyName('MSFT')).toBe('Microsoft Corporation');
      expect(getCompanyName('GOOGL')).toBe('Alphabet Inc.');
      expect(getCompanyName('NVDA')).toBe('NVIDIA Corporation');
      expect(getCompanyName('NET')).toBe('Cloudflare Inc.');
    });

    it('should be case-insensitive', () => {
      expect(getCompanyName('aapl')).toBe('Apple Inc.');
      expect(getCompanyName('AaPl')).toBe('Apple Inc.');
      expect(getCompanyName('MSFT')).toBe('Microsoft Corporation');
      expect(getCompanyName('msft')).toBe('Microsoft Corporation');
    });

    it('should return ticker for unknown tickers', () => {
      expect(getCompanyName('UNKNOWN')).toBe('UNKNOWN');
      expect(getCompanyName('INVALID')).toBe('INVALID');
      expect(getCompanyName('XYZ')).toBe('XYZ');
    });

    it('should handle invalid input gracefully', () => {
      expect(getCompanyName('')).toBe('');
      expect(getCompanyName(null)).toBe(null);
      expect(getCompanyName(undefined)).toBe(undefined);
    });

    it('should return names for popular tech stocks', () => {
      expect(getCompanyName('TSLA')).toBe('Tesla Inc.');
      expect(getCompanyName('AMZN')).toBe('Amazon.com Inc.');
      expect(getCompanyName('META')).toBe('Meta Platforms Inc.');
      expect(getCompanyName('NFLX')).toBe('Netflix Inc.');
    });

    it('should return names for financial stocks', () => {
      expect(getCompanyName('JPM')).toBe('JPMorgan Chase & Co.');
      expect(getCompanyName('V')).toBe('Visa Inc.');
      expect(getCompanyName('MA')).toBe('Mastercard Inc.');
      expect(getCompanyName('GS')).toBe('The Goldman Sachs Group Inc.');
    });

    it('should handle both Class A and Class B Berkshire shares', () => {
      expect(getCompanyName('BRK.A')).toBe('Berkshire Hathaway Inc.');
      expect(getCompanyName('BRK.B')).toBe('Berkshire Hathaway Inc.');
    });

    it('should return names for newer tech companies', () => {
      expect(getCompanyName('UBER')).toBe('Uber Technologies Inc.');
      expect(getCompanyName('ABNB')).toBe('Airbnb Inc.');
      expect(getCompanyName('SNOW')).toBe('Snowflake Inc.');
      expect(getCompanyName('COIN')).toBe('Coinbase Global Inc.');
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
            results: [{
              c: 175.43,
              h: 176.12,
              l: 174.21,
              o: 174.50,
              t: 1700000000000
            }]
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
