// ABOUTME: OpenAI API client for generating AI-powered news summaries about stocks
// ABOUTME: Includes timeout handling, error classification, and response validation

import OpenAI from 'openai';
import { CONFIG } from '../config.js';

/**
 * Generate AI-powered news summary for a stock
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {string} apiKey - OpenAI API key
 * @param {OpenAI} [client] - Optional OpenAI client instance (for testing)
 * @returns {Promise<string>} AI-generated summary (2-4 sentences)
 * @throws {Error} If API request fails (throws PARTIAL_FAILURE to not fail entire request)
 */
export async function generateAISummary(ticker, companyName, apiKey, client = null) {
  try {
    // Create OpenAI client if not provided (for testing)
    const openai = client || new OpenAI({
      apiKey: apiKey,
      timeout: CONFIG.OPENAI_TIMEOUT,
    });

    // Format the prompt
    const prompt = formatPrompt(ticker, companyName);

    console.log('[INFO] Requesting AI summary from OpenAI', { ticker, companyName });

    // Make API request with timeout and web search enabled
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-5-search-api', // Specialized model with web search capabilities
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
        max_completion_tokens: 3000, // Limit output length for concise summaries
        web_search_options: {} // Enable web search for search-enabled models
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.OPENAI_TIMEOUT)
      )
    ]);

    // Validate response
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('No content in OpenAI response');
    }

    const content = completion.choices[0]?.message?.content;
    
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('No content in OpenAI response');
    }

    console.log('[INFO] AI summary generated successfully', { 
      ticker, 
      length: content.length 
    });

    return content.trim();

  } catch (error) {
    // Classify and handle different error types
    console.error('[ERROR] OpenAI API error', {
      ticker,
      error: error.message,
      status: error.status
    });

    // Handle specific error types
    if (error.message.includes('timeout')) {
      throw new Error('OpenAI API timeout - unable to generate summary');
    }
    
    if (error.status === 429 || error.message.includes('rate limit')) {
      throw new Error('OpenAI API rate limit exceeded - try again later');
    }
    
    if (error.status === 401 || error.message.includes('authentication') || error.message.includes('API key')) {
      throw new Error('OpenAI API authentication failed - check API key');
    }

    if (error.message.includes('No content')) {
      throw error;
    }

    // Generic error
    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Format the prompt for OpenAI to generate stock news summary
 * @param {string} ticker - Stock ticker symbol
 * @param {string} companyName - Company name
 * @returns {string} Formatted prompt
 */
export function formatPrompt(ticker, companyName) {
  return `You are a financial news analyst with web search capabilities. Search the web for the most recent news and developments about ${companyName} (${ticker}) from the past week.

Provide a concise summary (3-4 sentences, max 800 characters) focusing on:
1. Recent factual developments that may impact stock price (earnings, product launches, regulatory news, etc.)
2. Current market sentiment based on analyst opinions and market reactions

Important guidelines:
- Use web search to find the latest, most current information
- Be factual about numbers and events
- Provide cautious, balanced interpretation
- Do not make buy/sell recommendations
- CRITICAL: Keep response under 800 characters (about 70-90 words). Be extremely concise.
- CRITICAL: Provide a plain text summary without any markdown, headers, numbering, bullet points, or special formatting (no bold, italics, underscores, or other text decorations).
- CRITICAL: NO preamble or follow-ups, NO citations, URLs, or links.`;
}
