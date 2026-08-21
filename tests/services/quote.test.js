// ABOUTME: Tests for the quote router that prefers Yahoo Finance and falls back to Finnhub
// ABOUTME: Covers source selection, fallback on Yahoo failure, and rate-limit signalling

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/services/yahooFinance.js', async () => {
  const actual = await vi.importActual('../../src/services/yahooFinance.js');
  return { ...actual, fetchYahooQuote: vi.fn() };
});

vi.mock('../../src/services/finnhub.js', async () => {
  const actual = await vi.importActual('../../src/services/finnhub.js');
  return { ...actual, fetchMarketStatus: vi.fn() };
});

const { fetchQuote } = await import('../../src/services/quote.js');
const { fetchYahooQuote, YahooQuoteError } = await import('../../src/services/yahooFinance.js');
const { fetchMarketStatus, FinnhubRateLimitError } = await import('../../src/services/finnhub.js');

const YAHOO_QUOTE = {
  isOpen: true,
  timestamp: 1787319600,
  currentPrice: 307.93,
  change: -3.37,
  changePercent: -1.0826,
  quoteAge: 0,
  companyName: 'Apple Inc.',
  source: 'yahoo',
};

const FINNHUB_QUOTE = {
  isOpen: true,
  timestamp: 1787319600,
  currentPrice: 307.62,
  change: -3.68,
  changePercent: -1.1821,
  quoteAge: 12,
};

describe('Quote router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses Yahoo when it succeeds and never calls Finnhub', async () => {
    fetchYahooQuote.mockResolvedValue(YAHOO_QUOTE);

    const result = await fetchQuote('AAPL', 'finnhub-key');

    expect(result.source).toBe('yahoo');
    expect(result.currentPrice).toBe(307.93);
    expect(result.companyName).toBe('Apple Inc.');
    expect(fetchMarketStatus).not.toHaveBeenCalled();
  });

  it('falls back to Finnhub when Yahoo fails', async () => {
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));
    fetchMarketStatus.mockResolvedValue(FINNHUB_QUOTE);

    const result = await fetchQuote('AAPL', 'finnhub-key');

    expect(result.source).toBe('finnhub');
    expect(result.currentPrice).toBe(307.62);
    expect(fetchMarketStatus).toHaveBeenCalledWith('AAPL', 'finnhub-key');
  });

  it('leaves companyName unset when falling back, so the caller keeps its cached name', async () => {
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));
    fetchMarketStatus.mockResolvedValue(FINNHUB_QUOTE);

    const result = await fetchQuote('AAPL', 'finnhub-key');

    expect(result.companyName).toBeUndefined();
  });

  it('propagates the Finnhub rate-limit signal when both sources fail', async () => {
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));
    fetchMarketStatus.mockRejectedValue(new FinnhubRateLimitError());

    await expect(fetchQuote('AAPL', 'finnhub-key')).rejects.toMatchObject({ isRateLimit: true });
  });

  it("carries Yahoo's unknown-symbol verdict onto the Finnhub error", async () => {
    fetchYahooQuote.mockRejectedValue(
      new YahooQuoteError('No data found', { isUnknownSymbol: true })
    );
    fetchMarketStatus.mockRejectedValue(new FinnhubRateLimitError());

    await expect(fetchQuote('ZZZZQQ', 'finnhub-key')).rejects.toMatchObject({
      isRateLimit: true,
      isUnknownSymbol: true,
    });
  });

  it('leaves the Finnhub error unmarked when Yahoo failed for another reason', async () => {
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));
    fetchMarketStatus.mockRejectedValue(new FinnhubRateLimitError());

    await expect(fetchQuote('AAPL', 'finnhub-key')).rejects.not.toMatchObject({
      isUnknownSymbol: true,
    });
  });

  it('propagates a non-rate-limit Finnhub failure', async () => {
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));
    fetchMarketStatus.mockRejectedValue(new Error('Invalid Finnhub API key'));

    await expect(fetchQuote('AAPL', 'finnhub-key')).rejects.toThrow('Invalid Finnhub API key');
  });

  it('still tries Finnhub when no Yahoo result and no Finnhub key would be pointless', async () => {
    // Without a Finnhub key there is no second source, so the Yahoo error is what surfaces.
    fetchYahooQuote.mockRejectedValue(new YahooQuoteError('Yahoo down'));

    await expect(fetchQuote('AAPL', undefined)).rejects.toThrow('Yahoo down');
    expect(fetchMarketStatus).not.toHaveBeenCalled();
  });
});
