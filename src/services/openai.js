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

    // Make API request with timeout
    const completion = await Promise.race([
      openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using gpt-4o-mini as a cost-effective option
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 300, // Sufficient for 2-4 sentences
        temperature: 0.3, // More deterministic
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
  return `You are a financial news analyst. Search the web for recent news about ${companyName} (${ticker}) and provide a concise 2-4 sentence summary focusing on:
1. Recent factual developments that may impact stock price
2. Current market sentiment (cautious interpretation, not bold predictions)

Note: Price data shown is from the previous trading day's close, not real-time.
Be factual about numbers and events. Provide cautious, balanced interpretation. 
Do not make buy/sell recommendations.`;
}
