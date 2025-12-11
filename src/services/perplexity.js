// ABOUTME: Perplexity API client for generating AI-powered news summaries about stocks
// ABOUTME: Includes timeout handling, error classification, and response validation
// ABOUTME: Uses Perplexity's SONAR model with web search capabilities

import OpenAI from 'openai';
import { CONFIG } from '../config.js';

/**
 * Generate AI-powered news summary for a stock using Perplexity
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {string} apiKey - Perplexity API key
 * @param {OpenAI} [client] - Optional OpenAI client instance (for testing)
 * @returns {Promise<string>} AI-generated summary (2-4 sentences)
 * @throws {Error} If API request fails (throws PARTIAL_FAILURE to not fail entire request)
 */
export async function generateAISummary(ticker, companyName, apiKey, client = null) {
  const startTime = Date.now();
  
  try {
    // Create Perplexity client (uses OpenAI-compatible API)
    const perplexity = client || new OpenAI({
      apiKey: apiKey,
      baseURL: 'https://api.perplexity.ai',
      timeout: CONFIG.PERPLEXITY_TIMEOUT,
    });

    // Format the prompt
    const prompt = formatPrompt(ticker, companyName);

    console.log('[INFO] Requesting AI summary from Perplexity', { ticker, companyName });
    console.log('[DEBUG] Perplexity prompt', { ticker, prompt });

    // Make API request with timeout and web search enabled
    const apiCallStart = Date.now();
    const completion = await Promise.race([
      perplexity.chat.completions.create({
        model: 'sonar', // Perplexity's SONAR model with web search capabilities
        messages: [
          {
            role: 'system',
            content: 'You are a financial news analyst. Use succinct, plain language focused on accuracy and professionalism.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 800, // Limit output length for concise summaries
        search_recency_filter: 'week', // Limit search results to the past 7 days
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.PERPLEXITY_TIMEOUT)
      )
    ]);

    // Validate response
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('No content in Perplexity response');
    }

    const content = completion.choices[0]?.message?.content;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('No content in Perplexity response');
    }

    // Performance: Log API response time
    const apiCallDuration = Date.now() - apiCallStart;
    const totalDuration = Date.now() - startTime;
    console.log('[PERF] Perplexity API response time', {
      apiDuration: `${apiCallDuration}ms`,
      totalDuration: `${totalDuration}ms`,
      summaryLength: content.length,
      cached: false,
    });

    console.log('[INFO] AI summary generated successfully', { 
      ticker, 
      length: content.length 
    });

    return content.trim();

  } catch (error) {
    // Classify and handle different error types
    console.error('[ERROR] Perplexity API error', {
      ticker,
      error: error.message,
      status: error.status
    });

    // Handle specific error types
    if (error.message.includes('timeout')) {
      throw new Error('Perplexity API timeout - unable to generate summary');
    }
    
    if (error.status === 429 || error.message.includes('rate limit')) {
      throw new Error('Perplexity API rate limit exceeded - try again later');
    }
    
    if (error.status === 401 || error.message.includes('authentication') || error.message.includes('API key')) {
      throw new Error('Perplexity API authentication failed - check API key');
    }

    if (error.message.includes('No content')) {
      throw error;
    }

    // Generic error
    throw new Error(`Perplexity API error: ${error.message}`);
  }
}

/**
 * Format the prompt for Perplexity to generate stock news summary
 * @param {string} ticker - Stock ticker symbol
 * @param {string} companyName - Company name
 * @returns {string} Formatted prompt
 */
export function formatPrompt(ticker, companyName) {
  // Include current date so the model knows what "recent" means
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  return `Today's date is ${today}. You are a financial news analyst with web search capabilities. Search the web for the most recent news and developments about ${companyName} (${ticker}) from the last 72 hours ONLY. Prioritize any significant events from the last 24 hours.

IMPORTANT: Only include news dated ${today} or within the past 3 days. Ignore any older information. If you cannot find news from this timeframe, state that no recent news is available, and only in those cases, provide a more general summary of the company's recent performance and market sentiment.

Provide a concise summary (3-4 sentences, max 800 characters) focusing on:
1. Recent factual developments that may impact stock price (earnings, product launches, regulatory news, etc.)
2. Current market sentiment based on analyst opinions and market reactions

Important guidelines:
- Use web search to find the latest, most current information
- Be factual about numbers and events
- Provide cautious, balanced interpretation
- Do not make buy/sell recommendations
- Do not reference a recent specific price, we are getting that data elsewhere
- CRITICAL: Keep response under 800 characters (about 70-90 words). Be extremely concise.
- CRITICAL: Provide a plain text summary without any markdown, headers, numbering, bullet points, or special formatting (no bold, italics, underscores, or other text decorations).
- CRITICAL: NO preamble or follow-ups, NO citations, NO URLs, NO links.`;
}
