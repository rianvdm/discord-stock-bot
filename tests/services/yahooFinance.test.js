// ABOUTME: Tests for the Yahoo Finance chart client used as the primary live-quote source
// ABOUTME: Covers session-window market detection, change maths, and unknown-symbol handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYahooQuote, YahooQuoteError } from '../../src/services/yahooFinance.js';

// A regular US session running 13:30-20:00 UTC on the day of `SESSION_START`.
const SESSION_START = 1787319000;
const SESSION_END = 1787342400;

function chartResponse(overrides = {}) {
  return {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            regularMarketPrice: 307.93,
            chartPreviousClose: 311.3,
            regularMarketTime: SESSION_START + 600,
            longName: 'Apple Inc.',
            shortName: 'Apple',
            currentTradingPeriod: {
              regular: { start: SESSION_START, end: SESSION_END },
            },
            ...overrides,
          },
        },
      ],
      error: null,
    },
  };
}

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

describe('Yahoo Finance Service', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('fetchYahooQuote', () => {
    it('returns a normalized quote and reports the market open inside the session window', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(okResponse(chartResponse()));

      const result = await fetchYahooQuote('AAPL');

      expect(result.currentPrice).toBe(307.93);
      expect(result.timestamp).toBe(SESSION_START + 600);
      expect(result.companyName).toBe('Apple Inc.');
      expect(result.source).toBe('yahoo');
      expect(result.isOpen).toBe(true);
      expect(result.quoteAge).toBe(0);
    });

    it('derives change and percent change from the previous close', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(okResponse(chartResponse()));

      const result = await fetchYahooQuote('AAPL');

      expect(result.change).toBeCloseTo(-3.37, 2);
      expect(result.changePercent).toBeCloseTo(-1.0826, 3);
    });

    it('reports the market closed once the session window has passed', async () => {
      vi.setSystemTime((SESSION_END + 3600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ regularMarketTime: SESSION_END }))
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.isOpen).toBe(false);
      expect(result.currentPrice).toBe(307.93);
    });

    it('reports the market closed before the session window opens', async () => {
      vi.setSystemTime((SESSION_START - 3600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(okResponse(chartResponse()));

      const result = await fetchYahooQuote('AAPL');

      expect(result.isOpen).toBe(false);
    });

    it('falls back to shortName when longName is absent', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ longName: undefined }))
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.companyName).toBe('Apple');
    });

    it('throws YahooQuoteError when Yahoo reports an unknown symbol', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({
          chart: { result: null, error: { code: 'Not Found', description: 'No data found, symbol may be delisted' } },
        }),
      });

      await expect(fetchYahooQuote('ZZZZQQ')).rejects.toThrow(YahooQuoteError);
      await expect(fetchYahooQuote('ZZZZQQ')).rejects.toMatchObject({ isUnknownSymbol: true });
    });

    it('does not mark a server error as an unknown symbol', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      });

      await expect(fetchYahooQuote('AAPL')).rejects.toMatchObject({ isUnknownSymbol: false });
    });

    it('throws when the payload carries no usable price', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ regularMarketPrice: undefined }))
      );

      await expect(fetchYahooQuote('AAPL')).rejects.toThrow(YahooQuoteError);
    });

    it('throws when the payload carries no previous close to compare against', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ chartPreviousClose: undefined }))
      );

      await expect(fetchYahooQuote('AAPL')).rejects.toThrow(YahooQuoteError);
    });

    it('accepts previousClose when chartPreviousClose is absent', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ chartPreviousClose: undefined, previousClose: 311.3 }))
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.change).toBeCloseTo(-3.37, 2);
    });

    it('throws on a non-404 HTTP error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({}),
      });

      await expect(fetchYahooQuote('AAPL')).rejects.toThrow(YahooQuoteError);
    });

    it('does not send an API key', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(okResponse(chartResponse()));

      await fetchYahooQuote('AAPL');

      const [url] = global.fetch.mock.calls[0];
      expect(url).toContain('query1.finance.yahoo.com');
      expect(url).not.toContain('token');
      expect(url).not.toContain('apiKey');
    });
  });
});
