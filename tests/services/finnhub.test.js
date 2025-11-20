import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMarketStatus } from '../../src/services/finnhub.js';

describe('Finnhub Service', () => {
  const mockApiKey = 'test-finnhub-api-key';
  const mockTicker = 'AAPL';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchMarketStatus', () => {
    it('should fetch market status successfully when market is open (recent quote)', async () => {
      const currentTime = 1700000000; // Unix timestamp in seconds
      const recentQuoteTime = currentTime - 60; // 1 minute ago (within 5 min threshold)
      
      vi.setSystemTime(currentTime * 1000); // Convert to ms for Date

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 175.43,  // current price
          d: 2.1,     // change
          dp: 1.21,   // change percent
          h: 176.5,   // high
          l: 174.2,   // low
          o: 174.8,   // open
          pc: 173.33, // previous close
          t: recentQuoteTime
        })
      });

      const result = await fetchMarketStatus(mockTicker, mockApiKey);

      expect(result).toBeDefined();
      expect(result.isOpen).toBe(true); // Quote is recent, so market is open
      expect(result.timestamp).toBe(recentQuoteTime);
      expect(result.currentPrice).toBe(175.43);
      expect(result.change).toBe(2.1);
      expect(result.changePercent).toBe(1.21);
      expect(result.quoteAge).toBeLessThan(300); // Less than 5 minutes old

      // Verify API was called correctly
      expect(global.fetch).toHaveBeenCalledWith(
        `https://finnhub.io/api/v1/quote?symbol=${mockTicker}&token=${mockApiKey}`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should indicate market is closed when quote is old (>5 minutes)', async () => {
      const currentTime = 1700000000;
      const oldQuoteTime = currentTime - 600; // 10 minutes ago (beyond 5 min threshold)
      
      vi.setSystemTime(currentTime * 1000);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 175.43,
          d: 2.1,
          dp: 1.21,
          h: 176.5,
          l: 174.2,
          o: 174.8,
          pc: 173.33,
          t: oldQuoteTime
        })
      });

      const result = await fetchMarketStatus(mockTicker, mockApiKey);

      expect(result.isOpen).toBe(false); // Quote is old, so market is closed
      expect(result.quoteAge).toBeGreaterThanOrEqual(600);
    });

    it('should handle 404 not found error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        `Ticker ${mockTicker} not found on Finnhub`
      );
    });

    it('should handle 429 rate limit error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Finnhub API rate limit exceeded'
      );
    });

    it('should handle 401 unauthorized error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Invalid Finnhub API key'
      );
    });

    it('should handle 403 forbidden error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Invalid Finnhub API key'
      );
    });

    it('should handle generic HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Finnhub API error: 500'
      );
    });

    it('should handle invalid response data (missing timestamp)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 175.43,
          d: 2.1,
          dp: 1.21
          // Missing 't' (timestamp)
        })
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Invalid data received from Finnhub API'
      );
    });

    it('should handle invalid response data (missing current price)', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          t: 1700000000,
          d: 2.1,
          dp: 1.21
          // Missing 'c' (current price)
        })
      });

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Invalid data received from Finnhub API'
      );
    });

    it('should handle timeout errors', async () => {
      vi.useRealTimers(); // Use real timers for actual timeout behavior
      
      // Mock fetch that respects abort signal
      global.fetch = vi.fn().mockImplementation((url, options) => 
        new Promise((resolve, reject) => {
          // Listen for abort signal
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const error = new Error('The operation was aborted');
              error.name = 'AbortError';
              reject(error);
            });
          }
          // Never resolves naturally - will be aborted by timeout
        })
      );

      // Expect the timeout error
      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        /timeout/i
      );
      
      vi.useFakeTimers(); // Restore fake timers for other tests
    }, 15000); // Increase test timeout to 15 seconds to allow for the 5 second API timeout

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow(
        'Network error'
      );
    });

    it('should log request duration on success', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const currentTime = 1700000000;
      vi.setSystemTime(currentTime * 1000);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 175.43,
          d: 2.1,
          dp: 1.21,
          h: 176.5,
          l: 174.2,
          o: 174.8,
          pc: 173.33,
          t: currentTime - 60
        })
      });

      await fetchMarketStatus(mockTicker, mockApiKey);

      expect(consoleSpy).toHaveBeenCalledWith(
        '[INFO] Finnhub quote fetched',
        expect.objectContaining({
          ticker: mockTicker,
          duration: expect.stringContaining('ms')
        })
      );
    });

    it('should log error on failure', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(fetchMarketStatus(mockTicker, mockApiKey)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[ERROR] Finnhub request failed',
        expect.objectContaining({
          ticker: mockTicker,
          error: 'Test error'
        })
      );
    });

    it('should set correct User-Agent header', async () => {
      const currentTime = 1700000000;
      vi.setSystemTime(currentTime * 1000);

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 175.43,
          d: 2.1,
          dp: 1.21,
          h: 176.5,
          l: 174.2,
          o: 174.8,
          pc: 173.33,
          t: currentTime - 60
        })
      });

      await fetchMarketStatus(mockTicker, mockApiKey);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('Mozilla')
          })
        })
      );
    });
  });
});
