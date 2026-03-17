// ABOUTME: AI summary router — delegates to the configured provider (Perplexity or OpenAI)
// ABOUTME: Switch providers by changing CONFIG.AI_SUMMARY_PROVIDER in config.js

import { generateAISummary as perplexityGenerateAISummary } from './perplexity.js';
import { generateAISummary as openaiGenerateAISummary } from './openai-responses.js';
import { CONFIG } from '../config.js';

/**
 * Generate AI-powered news summary using the configured provider.
 * Switch providers by changing CONFIG.AI_SUMMARY_PROVIDER in src/config.js.
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {Object} env - Cloudflare Workers environment bindings
 * @returns {Promise<string>} AI-generated summary
 * @throws {Error} If provider is unknown or the provider call fails
 */
export async function generateAISummary(ticker, companyName, env) {
  if (CONFIG.AI_SUMMARY_PROVIDER === 'perplexity') {
    return perplexityGenerateAISummary(ticker, companyName, env.PERPLEXITY_API_KEY);
  }

  if (CONFIG.AI_SUMMARY_PROVIDER === 'openai') {
    return openaiGenerateAISummary(ticker, companyName, env.OPENAI_API_KEY);
  }

  throw new Error(`Unknown AI_SUMMARY_PROVIDER: ${CONFIG.AI_SUMMARY_PROVIDER}`);
}
