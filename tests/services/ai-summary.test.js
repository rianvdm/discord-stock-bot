// ABOUTME: Tests for AI summary router that delegates to Perplexity or OpenAI based on config
// ABOUTME: Mocks both provider modules to test routing logic in isolation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CONFIG } from '../../src/config.js';

// Mock both provider modules
vi.mock('../../src/services/perplexity.js', () => ({
  generateAISummary: vi.fn(),
}));
vi.mock('../../src/services/openai-responses.js', () => ({
  generateAISummary: vi.fn(),
}));

import { generateAISummary } from '../../src/services/ai-summary.js';
import { generateAISummary as perplexitySummary } from '../../src/services/perplexity.js';
import { generateAISummary as openaiSummary } from '../../src/services/openai-responses.js';

describe('AI Summary Router', () => {
  const mockEnv = {
    PERPLEXITY_API_KEY: 'test-perplexity-key',
    OPENAI_API_KEY: 'test-openai-key',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Reset config to default after each test
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
  });

  it('should delegate to Perplexity when provider is perplexity', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    perplexitySummary.mockResolvedValue('Perplexity summary.');

    const result = await generateAISummary('AAPL', 'Apple Inc.', mockEnv);

    expect(perplexitySummary).toHaveBeenCalledWith('AAPL', 'Apple Inc.', 'test-perplexity-key');
    expect(openaiSummary).not.toHaveBeenCalled();
    expect(result).toBe('Perplexity summary.');
  });

  it('should delegate to OpenAI when provider is openai', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'openai';
    openaiSummary.mockResolvedValue('OpenAI summary.');

    const result = await generateAISummary('NET', 'Cloudflare Inc.', mockEnv);

    expect(openaiSummary).toHaveBeenCalledWith('NET', 'Cloudflare Inc.', 'test-openai-key');
    expect(perplexitySummary).not.toHaveBeenCalled();
    expect(result).toBe('OpenAI summary.');
  });

  it('should throw immediately for an unknown provider', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'unknown-provider';

    await expect(
      generateAISummary('AAPL', 'Apple Inc.', mockEnv)
    ).rejects.toThrow('Unknown AI_SUMMARY_PROVIDER: unknown-provider');
  });

  it('should pass through errors from the provider', async () => {
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    perplexitySummary.mockRejectedValue(new Error('Perplexity API timeout'));

    await expect(
      generateAISummary('AAPL', 'Apple Inc.', mockEnv)
    ).rejects.toThrow('Perplexity API timeout');
  });

  it('should pass undefined API key to provider when env key is missing', async () => {
    // The router is thin and does not guard against missing keys.
    // It passes undefined to the provider, which throws its own auth error.
    CONFIG.AI_SUMMARY_PROVIDER = 'perplexity';
    const envWithoutKey = { OPENAI_API_KEY: 'test-openai-key' };
    perplexitySummary.mockResolvedValue('summary');

    await generateAISummary('AAPL', 'Apple Inc.', envWithoutKey);

    expect(perplexitySummary).toHaveBeenCalledWith('AAPL', 'Apple Inc.', undefined);
  });
});
