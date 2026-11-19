// ABOUTME: Verifies /stock degrades to the last close when the live quote is unavailable
// ABOUTME: Regression cover for 2026-08-18, when a Finnhub 429 surfaced as "ticker not found"

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock every collaborator of fetchStockData so we can drive the failure modes directly.
vi.mock('../../src/middleware/cache.js', () => ({
  getCached: vi.fn(async () => null),
  setCached: vi.fn(async () => undefined),
}));

vi.mock('../../src/services/massive.js', () => ({
  fetchHistoricalData: vi.fn(),
  suggestTickers: vi.fn(() => []),
  getCompanyName: vi.fn(() => 'Cloudflare Inc.'),
  getTickerFromCompanyName: vi.fn(() => null),
}));

vi.mock('../../src/services/ai-summary.js', () => ({
  generateAISummary: vi.fn(async () => 'A summary.'),
}));

// The quote router is the seam stock.js talks to. Mocking it keeps these tests
// off the network and lets each failure mode be driven directly.
vi.mock('../../src/services/quote.js', () => ({
  fetchQuote: vi.fn(),
}));

vi.mock('../../src/middleware/rateLimit.js', () => ({
  enforceRateLimit: vi.fn(async () => null),
}));

const { fetchStockData, handleStockCommand } = await import('../../src/commands/stock.js');
const { fetchHistoricalData } = await import('../../src/services/massive.js');
const { fetchQuote } = await import('../../src/services/quote.js');
const { ErrorTypes } = await import('../../src/utils/errorHandler.js');

const HISTORY = {
  closingPrices: [300, 305, 307.01],
  timestamps: [1783396800, 1783483200, 1783569600],
  status: 'ok',
};

const env = { CACHE: {}, RATE_LIMITS: {}, MASSIVE_API_KEY: 'm', FINNHUB_API_KEY: 'f' };

function rateLimitError() {
  const e = new Error('Finnhub API rate limit exceeded');
  e.isRateLimit = true;
  return e;
}

describe('/stock resilience when the live quote fails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the last close instead of claiming the ticker does not exist', async () => {
    fetchHistoricalData.mockResolvedValue(HISTORY);
    fetchQuote.mockRejectedValue(rateLimitError());

    const data = await fetchStockData('NET', env);

    // The regression: this used to throw NOT_FOUND for a perfectly valid ticker.
    expect(data.price.currentPrice).toBe(307.01);
    expect(data.price.isDelayed).toBe(true);
    expect(data.price.isOpen).toBe(false);
    // Change is derived from the two most recent closes.
    expect(data.price.changeAmount).toBeCloseTo(2.01, 5);
    expect(data.history).toEqual(HISTORY);
  });

  it('still reports a real unknown ticker as NOT_FOUND', async () => {
    fetchHistoricalData.mockRejectedValue(new Error('Stock ticker not found'));
    fetchQuote.mockRejectedValue(new Error('Finnhub has no price for FAKETICKER'));

    await expect(fetchStockData('FAKETICKER', env)).rejects.toMatchObject({
      type: ErrorTypes.NOT_FOUND,
    });
  });

  it('reports RATE_LIMIT, not NOT_FOUND, when both history and quote are throttled', async () => {
    fetchHistoricalData.mockRejectedValue(new Error('Massive.com API error: 429 Too Many Requests'));
    fetchQuote.mockRejectedValue(rateLimitError());

    await expect(fetchStockData('NET', env)).rejects.toMatchObject({
      type: ErrorTypes.RATE_LIMIT,
    });
  });

  it('uses the live quote when it is available', async () => {
    fetchHistoricalData.mockResolvedValue(HISTORY);
    fetchQuote.mockResolvedValue({
      isOpen: true, timestamp: 1787074949, currentPrice: 300.05, change: -6.96, changePercent: -2.267,
    });

    const data = await fetchStockData('NET', env);

    expect(data.price.currentPrice).toBe(300.05);
    expect(data.price.isDelayed).toBe(false);
    expect(data.price.isOpen).toBe(true);
  });

  it('reports NOT_FOUND when the quote source knows the symbol is unknown, even while throttled', async () => {
    fetchHistoricalData.mockRejectedValue(new Error('Stock ticker not found'));
    const error = rateLimitError();
    error.isUnknownSymbol = true;
    fetchQuote.mockRejectedValue(error);

    // Two independent sources found nothing, so "rate limited" would be misleading.
    await expect(fetchStockData('ZZZZQQ', env)).rejects.toMatchObject({
      type: ErrorTypes.NOT_FOUND,
    });
  });

  it('takes the company name from the quote when the source supplies one', async () => {
    fetchHistoricalData.mockResolvedValue(HISTORY);
    fetchQuote.mockResolvedValue({
      isOpen: true, timestamp: 1787074949, currentPrice: 300.05, change: -6.96, changePercent: -2.267,
      companyName: 'Cloudflare, Inc.', source: 'yahoo',
    });

    const data = await fetchStockData('NET', env);

    expect(data.price.companyName).toBe('Cloudflare, Inc.');
  });
});

describe('/stock on a new listing with no daily history yet', () => {
  // ANT on its first trading day, 2026-11-19: Massive had zero daily bars,
  // Yahoo had no previous close, and Finnhub quoted it against the IPO price.
  const FIRST_DAY_QUOTE = {
    isOpen: true, timestamp: 1795115001, currentPrice: 95.33, change: 12.33, changePercent: 14.8554,
    source: 'finnhub',
  };

  const interaction = {
    id: '1',
    type: 2,
    data: { name: 'stock', options: [{ name: 'ticker', value: 'ANT' }] },
    user: { id: 'user1', username: 'tester' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    fetchHistoricalData.mockRejectedValue(new Error('No historical data available for this ticker'));
    fetchQuote.mockResolvedValue(FIRST_DAY_QUOTE);
  });

  it('serves the live quote instead of claiming the ticker does not exist', async () => {
    const data = await fetchStockData('ANT', env);

    expect(data.price.currentPrice).toBe(95.33);
    expect(data.price.changePercent).toBeCloseTo(14.8554, 4);
    expect(data.price.isDelayed).toBe(false);
    expect(data.history).toBeNull();
  });

  it('does not cache the missing history, so the first daily bar is picked up once it exists', async () => {
    const { setCached } = await import('../../src/middleware/cache.js');

    await fetchStockData('ANT', env);

    const cachedTypes = setCached.mock.calls.map(call => call[1]);
    expect(cachedTypes).not.toContain('history');
  });

  it('replies with a price and a new-listing note in place of the trend chart', async () => {
    const response = await handleStockCommand(interaction, env);
    const embed = response.data.embeds[0];

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField.value).toContain('$95.33');

    const trendField = embed.fields.find(f => f.name.includes('Trend'));
    expect(trendField.value).toMatch(/new listing/i);
  });
});
