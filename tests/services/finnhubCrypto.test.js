// ABOUTME: Test suite for Finnhub crypto API service
// ABOUTME: Verifies crypto quote fetching and error handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCryptoQuote } from '../../src/services/finnhubCrypto.js';

describe('Finnhub Crypto Service', () => {
  const mockApiKey = 'test-finnhub-api-key';
  const mockSymbol = 'BTC';

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchCryptoQuote', () => {
    it('should fetch crypto quote successfully', async () => {
      const currentTime = 1700000000;
      const quoteTime = currentTime - 10; // 10 seconds ago
      
      vi.setSystemTime(currentTime * 1000);

      // Mock fetch response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 42500.50,  // current price
          d: 1200.30,   // change
          dp: 2.9,      // change percent
          h: 43000.00,  // high
          l: 41000.00,  // low
          o: 41300.20,  // open
          pc: 41300.20, // previous close
          t: quoteTime
        })
      });

      const result = await fetchCryptoQuote(mockSymbol, mockApiKey);

      expect(result).toBeDefined();
      expect(result.currentPrice).toBe(42500.50);
      expect(result.change).toBe(1200.30);
      expect(result.changePercent).toBe(2.9);
      expect(result.isOpen).toBe(true); // Crypto markets are always open
      expect(result.exchange).toBe('BINANCE');

      // Verify API was called with Binance exchange format
      expect(global.fetch).toHaveBeenCalledWith(
        `https://finnhub.io/api/v1/quote?symbol=BINANCE:${mockSymbol}USDT&token=${mockApiKey}`,
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should handle API errors correctly', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('not found');
    });

    it('should handle rate limit errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('rate limit');
    });

    it('should handle invalid API key errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('Invalid Finnhub API key');
    });

    it('should reject zero price data', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          c: 0,
          d: 0,
          dp: 0,
          h: 0,
          l: 0,
          o: 0,
          pc: 0,
          t: 1700000000
        })
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('No trading data available');
    });

    it('should validate response data structure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing required fields
          c: 42500.50
        })
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('Invalid data');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow();
    });

    it('should handle timeout errors', async () => {
      global.fetch = vi.fn().mockImplementation(() => {
        const error = new Error('Aborted');
        error.name = 'AbortError';
        return Promise.reject(error);
      });

      await expect(fetchCryptoQuote(mockSymbol, mockApiKey))
        .rejects
        .toThrow('timeout');
    });

    it('should work with different crypto symbols', async () => {
      const symbols = ['BTC', 'ETH', 'DOGE'];
      
      for (const symbol of symbols) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            c: 1000.00,
            d: 10.00,
            dp: 1.0,
            h: 1100.00,
            l: 900.00,
            o: 990.00,
            pc: 990.00,
            t: 1700000000
          })
        });

        const result = await fetchCryptoQuote(symbol, mockApiKey);
        expect(result).toBeDefined();
        expect(result.currentPrice).toBe(1000.00);
        
        // Verify correct Binance symbol was used
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`BINANCE:${symbol}USDT`),
          expect.anything()
        );
      }
    });
  });
});
