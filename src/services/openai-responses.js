// ABOUTME: OpenAI Responses API client for generating AI-powered news summaries about stocks
// ABOUTME: Uses raw fetch to POST /v1/responses with gpt-5.4 and web_search tool
// ABOUTME: Includes timeout handling, error classification, and response validation

import { CONFIG } from '../config.js';

const RESPONSES_URL = 'https://api.openai.com/v1/responses';

/**
 * Generate AI-powered news summary for a stock using OpenAI Responses API
 * @param {string} ticker - Stock ticker symbol (e.g., 'AAPL')
 * @param {string} companyName - Company name (e.g., 'Apple Inc.')
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<string>} AI-generated summary (2-4 sentences)
 * @throws {Error} If API request fails
 */
export async function generateAISummary(ticker, companyName, apiKey) {
  const startTime = Date.now();

  try {
    console.log('[INFO] Requesting AI summary from OpenAI Responses API', { ticker, companyName });

    const prompt = formatPrompt(ticker, companyName);
    console.log('[DEBUG] OpenAI prompt', { ticker, prompt });

    const apiCallStart = Date.now();

    const response = await Promise.race([
      fetch(RESPONSES_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-5.4',
          instructions: 'You are a financial news analyst. Use succinct, plain language focused on accuracy and professionalism.',
          input: prompt,
          tools: [{ type: 'web_search' }],
          store: false,
          max_output_tokens: 800,
        }),
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.OPENAI_TIMEOUT)
      ),
    ]);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[ERROR] OpenAI Responses API HTTP error', {
        ticker,
        status: response.status,
        body: errorBody,
      });

      if (response.status === 429) {
        throw new Error('OpenAI API rate limit exceeded - try again later');
      }
      if (response.status === 401) {
        throw new Error('OpenAI API authentication failed - check API key');
      }
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const { content, webSearchUsed } = extractContent(data);

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      throw new Error('No content in OpenAI response');
    }

    const apiCallDuration = Date.now() - apiCallStart;
    const totalDuration = Date.now() - startTime;
    console.log('[PERF] OpenAI Responses API response time', {
      apiDuration: `${apiCallDuration}ms`,
      totalDuration: `${totalDuration}ms`,
      summaryLength: content.length,
      webSearchUsed,
      cached: false,
    });

    console.log('[INFO] AI summary generated successfully', { ticker, length: content.length });

    return content.trim();

  } catch (error) {
    // Re-throw already-classified errors without wrapping them again
    if (
      error.message.includes('rate limit') ||
      error.message.includes('authentication') ||
      error.message.includes('No content') ||
      error.message.startsWith('OpenAI API error')
    ) {
      throw error;
    }

    console.error('[ERROR] OpenAI Responses API error', {
      ticker,
      error: error.message,
    });

    if (error.message.includes('timeout')) {
      throw new Error('OpenAI API timeout - unable to generate summary');
    }

    throw new Error(`OpenAI API error: ${error.message}`);
  }
}

/**
 * Extract text content from an OpenAI Responses API response.
 * Tries output_text first, then walks output[].content[].text.
 * @param {Object} data - Parsed JSON response from /v1/responses
 * @returns {string|null}
 */
function extractContent(data) {
  let content = data.output_text || null;
  let webSearchUsed = false;

  if (Array.isArray(data.output)) {
    for (const item of data.output) {
      if (item.type === 'web_search_call') {
        webSearchUsed = true;
      }
      if (!content && item.type === 'message' && Array.isArray(item.content)) {
        for (const block of item.content) {
          if (block.type === 'output_text' && block.text) {
            content = block.text;
          }
        }
      }
    }
  }

  return { content, webSearchUsed };
}

/**
 * Format the prompt for OpenAI to generate stock news summary
 * @param {string} ticker - Stock ticker symbol
 * @param {string} companyName - Company name
 * @returns {string} Formatted prompt
 */
export function formatPrompt(ticker, companyName) {
  const today = new Date().toISOString().split('T')[0];

  return `Today's date is ${today}. You are a financial news analyst with web search capabilities. Search the web for the most recent news and developments about ${companyName} (${ticker}) from the last 7 days. Prioritize any significant events from the last 24 hours.

IMPORTANT: Only include news dated ${today} or within the past 7 days. Ignore any older information. If you cannot find news from this timeframe, state that no recent news is available, and only in those cases, provide a more general summary of the company's recent performance and market sentiment.

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
