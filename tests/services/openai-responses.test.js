// ABOUTME: Tests for OpenAI Responses API service that generates AI summaries of stock news
// ABOUTME: Mocks globalThis.fetch to test raw HTTP calls to /v1/responses

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAISummary, formatPrompt } from '../../src/services/openai-responses.js';

describe('OpenAI Responses Service', () => {
  describe('formatPrompt', () => {
    it('should include ticker and company name', () => {
      const prompt = formatPrompt('AAPL', 'Apple Inc.');
      expect(prompt).toContain('AAPL');
      expect(prompt).toContain('Apple Inc.');
    });

    it('should include today\'s date', () => {
      const today = new Date().toISOString().split('T')[0];
      const prompt = formatPrompt('AAPL', 'Apple Inc.');
      expect(prompt).toContain(today);
    });

    it('should instruct model to search and return plain text', () => {
      const prompt = formatPrompt('NET', 'Cloudflare Inc.');
      expect(prompt).toContain('72 hours');
      expect(prompt).toContain('800 characters');
      expect(prompt).toContain('NO citations');
    });
  });

  describe('generateAISummary', () => {
    let fetchSpy;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should call the Responses API with correct shape', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: 'Apple reported strong earnings. Stock is up 5%.',
        }),
      });

      await generateAISummary('AAPL', 'Apple Inc.', 'test-api-key');

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/responses');
      expect(options.method).toBe('POST');
      expect(options.headers['Authorization']).toBe('Bearer test-api-key');
      expect(options.headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(options.body);
      expect(body.model).toBe('gpt-5.4');
      expect(body.tools).toEqual([{ type: 'web_search' }]);
      expect(body.store).toBe(false);
      expect(body.max_output_tokens).toBe(800);
      expect(body.instructions).toContain('financial news analyst');
      expect(body.input).toContain('Apple Inc.');
    });

    it('should return content from output_text', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: 'Apple reported strong earnings. Stock is up 5%.',
        }),
      });

      const result = await generateAISummary('AAPL', 'Apple Inc.', 'test-api-key');
      expect(result).toBe('Apple reported strong earnings. Stock is up 5%.');
    });

    it('should fall back to output[].content[].text when output_text is absent', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output: [
            { type: 'web_search_call' },
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Cloudflare launched a new product. Revenue is up.' },
              ],
            },
          ],
        }),
      });

      const result = await generateAISummary('NET', 'Cloudflare Inc.', 'test-api-key');
      expect(result).toBe('Cloudflare launched a new product. Revenue is up.');
    });

    it('should throw on empty content', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({
          model: 'gpt-5.4',
          output_text: '',
        }),
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('No content in OpenAI response');
    });

    it('should throw a timeout error on timeout', async () => {
      fetchSpy.mockRejectedValue(new Error('Request timeout'));

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API timeout');
    });

    it('should throw a rate limit error on 429', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: async () => 'rate limit exceeded',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API rate limit exceeded');
    });

    it('should throw an auth error on 401', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: async () => 'invalid api key',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'invalid-key')
      ).rejects.toThrow('OpenAI API authentication failed');
    });

    it('should throw a generic error on other HTTP failures', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: async () => 'server error',
      });

      await expect(
        generateAISummary('AAPL', 'Apple Inc.', 'test-api-key')
      ).rejects.toThrow('OpenAI API error');
    });
  });
});
