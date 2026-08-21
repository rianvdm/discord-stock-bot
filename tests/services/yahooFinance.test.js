// ABOUTME: Tests for the Yahoo Finance chart client used as the primary live-quote source
// ABOUTME: Covers session-window market detection, change maths, and unknown-symbol handling

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchYahooQuote, YahooQuoteError } from '../../src/services/yahooFinance.js';

// A regular US session running 13:30-20:00 UTC on the day of `SESSION_START`.
const SESSION_START = 1787319000;
const SESSION_END = 1787342400;

const DAY = 86400;

// Daily bars are timestamped at the session open. The last one is the session
// `regularMarketPrice` belongs to, so the previous close is the one before it.
function chartResponse(overrides = {}, seriesOverrides = {}) {
  const timestamps = seriesOverrides.timestamps ?? [
    SESSION_START - 3 * DAY,
    SESSION_START - 2 * DAY,
    SESSION_START - DAY,
    SESSION_START,
  ];
  const close = seriesOverrides.close ?? [305.1, 309.4, 311.3, 307.93];

  return {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            regularMarketPrice: 307.93,
            // Deliberately wrong: chartPreviousClose is the close before the chart's
            // first bar, which depends on `range` and is not the previous session's
            // close. Nothing should read it.
            chartPreviousClose: 999.99,
            regularMarketTime: SESSION_START + 600,
            longName: 'Apple Inc.',
            shortName: 'Apple',
            currentTradingPeriod: {
              regular: { start: SESSION_START, end: SESSION_END },
            },
            ...overrides,
          },
          timestamp: timestamps,
          indicators: { quote: [{ close }] },
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

    it('throws when the daily series has too few closes to find a previous one', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({}, { timestamps: [SESSION_START], close: [307.93] }))
      );

      await expect(fetchYahooQuote('AAPL')).rejects.toThrow(YahooQuoteError);
    });

    it('ignores gaps in the daily series when picking the previous close', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(
          chartResponse(
            {},
            {
              timestamps: [SESSION_START - 3 * DAY, SESSION_START - 2 * DAY, SESSION_START - DAY, SESSION_START],
              close: [305.1, null, 311.3, 307.93],
            }
          )
        )
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.change).toBeCloseTo(-3.37, 2);
    });

    it('never derives the change from chartPreviousClose', async () => {
      vi.setSystemTime((SESSION_START + 600) * 1000);
      // Regression cover for WMT on 2026-08-21: at range=1d, chartPreviousClose was a
      // pre-market reference rather than the prior session's close, understating a
      // post-earnings gap. The daily series is the source of truth.
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ chartPreviousClose: 311.9 }))
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.change).toBeCloseTo(-3.37, 2);
      expect(result.change).not.toBeCloseTo(307.93 - 311.9, 2);
    });

    it('uses the last completed session when the market is closed and today has no bar', async () => {
      // Weekend: regularMarketTime is the last session's close, and the final bar is
      // that same session, so the previous close is the one before it.
      vi.setSystemTime((SESSION_END + 2 * DAY) * 1000);
      global.fetch = vi.fn().mockResolvedValue(
        okResponse(chartResponse({ regularMarketTime: SESSION_END }))
      );

      const result = await fetchYahooQuote('AAPL');

      expect(result.isOpen).toBe(false);
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
