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
}));

vi.mock('../../src/services/ai-summary.js', () => ({
  generateAISummary: vi.fn(async () => 'A summary.'),
}));

vi.mock('../../src/services/finnhub.js', () => ({
  fetchMarketStatus: vi.fn(),
  fetchCompanyProfile: vi.fn(async () => ({ name: 'Cloudflare Inc.' })),
}));

const { fetchStockData } = await import('../../src/commands/stock.js');
const { fetchHistoricalData } = await import('../../src/services/massive.js');
const { fetchMarketStatus } = await import('../../src/services/finnhub.js');
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
    fetchMarketStatus.mockRejectedValue(rateLimitError());

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
    fetchMarketStatus.mockResolvedValue({
      isOpen: true, timestamp: 1787074949, currentPrice: 300.05, change: -6.96, changePercent: -2.267,
    });

    await expect(fetchStockData('FAKETICKER', env)).rejects.toMatchObject({
      type: ErrorTypes.NOT_FOUND,
    });
  });

  it('reports RATE_LIMIT, not NOT_FOUND, when both history and quote are throttled', async () => {
    fetchHistoricalData.mockRejectedValue(new Error('Massive.com API error: 429 Too Many Requests'));
    fetchMarketStatus.mockRejectedValue(rateLimitError());

    await expect(fetchStockData('NET', env)).rejects.toMatchObject({
      type: ErrorTypes.RATE_LIMIT,
    });
  });

  it('uses the live quote when it is available', async () => {
    fetchHistoricalData.mockResolvedValue(HISTORY);
    fetchMarketStatus.mockResolvedValue({
      isOpen: true, timestamp: 1787074949, currentPrice: 300.05, change: -6.96, changePercent: -2.267,
    });

    const data = await fetchStockData('NET', env);

    expect(data.price.currentPrice).toBe(300.05);
    expect(data.price.isDelayed).toBe(false);
    expect(data.price.isOpen).toBe(true);
  });
});
