// ABOUTME: Guards the timeout budget that keeps commands inside ctx.waitUntil()'s limit
import { describe, it, expect } from 'vitest';
import { CONFIG } from '../src/config.js';

// Room for the error follow-up to Discord after the command timeout fires.
const FOLLOW_UP_MARGIN_MS = 3000;

describe('timeout budget', () => {
  it('ends the command early enough to send an error before waitUntil is cancelled', () => {
    expect(CONFIG.COMMAND_TIMEOUT + FOLLOW_UP_MARGIN_MS).toBeLessThanOrEqual(CONFIG.WAIT_UNTIL_LIMIT);
  });

  it('gives up on the optional AI summary before the command timeout', () => {
    expect(CONFIG.OPENAI_TIMEOUT).toBeLessThan(CONFIG.COMMAND_TIMEOUT);
    expect(CONFIG.PERPLEXITY_TIMEOUT).toBeLessThan(CONFIG.COMMAND_TIMEOUT);
  });

  it('gives up on the quote and history calls before the command timeout', () => {
    expect(CONFIG.MASSIVE_TIMEOUT).toBeLessThan(CONFIG.COMMAND_TIMEOUT);
    expect(CONFIG.YAHOO_TIMEOUT + CONFIG.FINNHUB_TIMEOUT).toBeLessThan(CONFIG.COMMAND_TIMEOUT);
  });
});
