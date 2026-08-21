// ABOUTME: Yahoo Finance chart client providing the live quote, previous close, and company name
// ABOUTME: Primary quote source because Finnhub throttles Cloudflare's shared egress IPs

import { CONFIG } from '../config.js';

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

// Yahoo serves this endpoint to browsers and rejects requests that do not look
// like one, so the User-Agent is required rather than cosmetic.
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * Error thrown for any Yahoo failure: an unknown symbol, an HTTP error, or a
 * payload without a usable price. All of them send the caller to the next quote
 * source, but `isUnknownSymbol` marks the one case Yahoo answers authoritatively
 * — it looked the symbol up and there is no such thing — which lets the caller
 * report a typo as a typo instead of blaming a downstream rate limit.
 */
export class YahooQuoteError extends Error {
  constructor(message, { isUnknownSymbol = false } = {}) {
    super(message);
    this.name = 'YahooQuoteError';
    this.isUnknownSymbol = isUnknownSymbol;
  }
}

/**
 * Fetch a live quote from Yahoo Finance.
 *
 * One call carries the current price, the previous close, the company name, and
 * the exchange's session window, which together replace both Finnhub calls the
 * stock command used to make.
 *
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @returns {Promise<Object>} Quote with isOpen, timestamp, currentPrice, change, changePercent, quoteAge, companyName, source
 * @throws {YahooQuoteError} If the symbol is unknown, the request fails, or the payload has no price
 */
export async function fetchYahooQuote(ticker) {
  // A 5-day window of daily bars. The range has to cover more than one session
  // because the previous close is read from the bar series, not from the meta
  // block — see readPreviousClose.
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(ticker)}?interval=1d&range=5d`;
  const startTime = Date.now();

  let response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.YAHOO_TIMEOUT);

    response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': BROWSER_USER_AGENT },
    });

    clearTimeout(timeoutId);
  } catch (error) {
    const duration = Date.now() - startTime;

    if (error.name === 'AbortError') {
      console.error('[ERROR] Yahoo quote timeout', {
        ticker,
        duration: `${duration}ms`,
        timeout: CONFIG.YAHOO_TIMEOUT,
      });
      throw new YahooQuoteError(`Yahoo Finance request timeout after ${CONFIG.YAHOO_TIMEOUT}ms`);
    }

    console.error('[ERROR] Yahoo quote request failed', {
      ticker,
      duration: `${duration}ms`,
      error: error.message,
    });
    throw new YahooQuoteError(`Yahoo Finance request failed: ${error.message}`);
  }

  // Yahoo returns 404 with a populated chart.error for an unknown or delisted
  // symbol. Read the body either way so the reason reaches the log.
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const description = payload?.chart?.error?.description || `HTTP ${response.status}`;
    const isUnknownSymbol = response.status === 404 && !!payload?.chart?.error;
    console.warn('[WARN] Yahoo quote unavailable', {
      ticker,
      status: response.status,
      description,
      isUnknownSymbol,
    });
    throw new YahooQuoteError(`Yahoo Finance error for ${ticker}: ${description}`, { isUnknownSymbol });
  }

  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;

  if (!meta || typeof meta.regularMarketPrice !== 'number') {
    throw new YahooQuoteError(`Yahoo Finance returned no price for ${ticker}`);
  }

  const previousClose = readPreviousClose(result);

  if (previousClose === null) {
    throw new YahooQuoteError(`Yahoo Finance returned no previous close for ${ticker}`);
  }

  const currentPrice = meta.regularMarketPrice;
  const change = currentPrice - previousClose;
  const timestamp = typeof meta.regularMarketTime === 'number'
    ? meta.regularMarketTime
    : Math.floor(Date.now() / 1000);
  const now = Math.floor(Date.now() / 1000);

  console.log('[INFO] Yahoo quote fetched', {
    ticker,
    duration: `${Date.now() - startTime}ms`,
    timestamp,
  });

  return {
    isOpen: isWithinRegularSession(meta.currentTradingPeriod, now),
    timestamp,
    currentPrice,
    change,
    changePercent: (change / previousClose) * 100,
    quoteAge: Math.max(0, now - timestamp),
    companyName: meta.longName || meta.shortName || ticker,
    source: 'yahoo',
  };
}

/**
 * Read the previous session's closing price from the daily bar series.
 *
 * `meta.chartPreviousClose` looks like the right field and is not: it is the close
 * of the bar immediately *before the chart's first bar*, so its value depends on the
 * requested range, and at `range=1d` it returns a pre-market reference rather than
 * the prior session's close. On 2026-08-21 that reported WMT down $1.06 when it was
 * down $1.31, because the stock had gapped 10 points on earnings the day before.
 *
 * The bars themselves are unambiguous. The last one is the session that
 * `regularMarketPrice` belongs to — during a session it is today's in-progress bar,
 * and outside one it is the most recent close — so the previous close is the last
 * valid close before it.
 *
 * @param {Object} result - Yahoo's chart.result[0]
 * @returns {number|null} Previous session close, or null if the series cannot supply one
 */
function readPreviousClose(result) {
  const closes = result?.indicators?.quote?.[0]?.close;

  if (!Array.isArray(closes)) {
    return null;
  }

  // Yahoo emits null for sessions it has no data for; they are not closes.
  const valid = closes.filter(close => typeof close === 'number' && close > 0);

  return valid.length >= 2 ? valid[valid.length - 2] : null;
}

/**
 * Decide whether the exchange is inside its regular session.
 *
 * The exchange publishes the session's own start and end, so this replaces the
 * older guess that a quote less than five minutes old meant an open market —
 * which misread thinly traded stocks and every non-US exchange.
 *
 * @param {Object|undefined} tradingPeriod - Yahoo's currentTradingPeriod block
 * @param {number} now - Current time in unix seconds
 * @returns {boolean} True when `now` falls inside the regular session
 */
function isWithinRegularSession(tradingPeriod, now) {
  const regular = tradingPeriod?.regular;

  if (typeof regular?.start !== 'number' || typeof regular?.end !== 'number') {
    return false;
  }

  return now >= regular.start && now < regular.end;
}
