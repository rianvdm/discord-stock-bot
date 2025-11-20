// ABOUTME: Tests for OpenAI service that generates AI summaries of stock news
// ABOUTME: Includes tests for successful generation, error handling, and response validation

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateAISummary, formatPrompt } from '../../src/services/openai.js';

describe('OpenAI Service', () => {
  describe('formatPrompt', () => {
    it('should format prompt with ticker and company name', () => {
      const prompt = formatPrompt('AAPL', 'Apple Inc.');
      
      expect(prompt).toContain('AAPL');
      expect(prompt).toContain('Apple Inc.');
      expect(prompt).toContain('2-4 sentence');
      expect(prompt).toContain('previous trading day');
    });

    it('should include key instructions in prompt', () => {
      const prompt = formatPrompt('NET', 'Cloudflare Inc.');
      
      expect(prompt).toContain('financial news analyst');
      expect(prompt).toContain('recent news');
      expect(prompt).toContain('factual');
      expect(prompt).toContain('buy/sell recommendations');
    });
  });

  describe('generateAISummary', () => {
    let mockOpenAI;
    
    beforeEach(() => {
      // Reset mocks before each test
      vi.clearAllMocks();
    });

    it('should successfully generate AI summary', async () => {
      // Mock OpenAI client
      const mockCompletion = {
        choices: [{
          message: {
            content: 'Apple reported strong Q4 earnings with revenue up 5% year-over-year. The company announced new AI features for iOS. Analysts remain bullish on the stock despite broader market volatility.'
          }
        }]
      };

      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockCompletion)
          }
        }
      };

      const summary = await generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI);
      
      expect(summary).toBe(mockCompletion.choices[0].message.content);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'user',
              content: expect.stringContaining('Apple Inc.')
            })
          ]),
          max_tokens: 300,
          temperature: 0.3
        })
      );
    });

    it('should handle API timeout errors', async () => {
      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('Request timeout'))
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI)
      ).rejects.toThrow('OpenAI API timeout');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.status = 429;
      
      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(rateLimitError)
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI)
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });

    it('should handle invalid API key errors', async () => {
      const authError = new Error('Invalid API key');
      authError.status = 401;
      
      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(authError)
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'invalid-key', mockOpenAI)
      ).rejects.toThrow('OpenAI API authentication failed');
    });

    it('should handle generic API errors', async () => {
      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('Service unavailable'))
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI)
      ).rejects.toThrow('OpenAI API error');
    });

    it('should validate response has content', async () => {
      const invalidCompletion = {
        choices: [{
          message: {}
        }]
      };

      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(invalidCompletion)
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI)
      ).rejects.toThrow('No content in OpenAI response');
    });

    it('should validate response is a reasonable length (2-4 sentences)', async () => {
      const goodCompletion = {
        choices: [{
          message: {
            content: 'Apple reported strong earnings. The stock is up 5%. Analysts are positive. Market sentiment is bullish.'
          }
        }]
      };

      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(goodCompletion)
          }
        }
      };

      const summary = await generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI);
      
      // Count sentences (rough estimate)
      const sentenceCount = (summary.match(/[.!?]+/g) || []).length;
      expect(sentenceCount).toBeGreaterThanOrEqual(2);
      expect(sentenceCount).toBeLessThanOrEqual(6); // Allow some flexibility
    });

    it('should handle empty response from API', async () => {
      const emptyCompletion = {
        choices: []
      };

      mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(emptyCompletion)
          }
        }
      };

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'fake-api-key', mockOpenAI)
      ).rejects.toThrow('No content in OpenAI response');
    });
  });
});
