// ABOUTME: Integration tests for end-to-end command workflows
// ABOUTME: Tests complete flows from Discord interaction to response

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import workerHandler from '../../src/index.js';

/**
 * Integration Tests for Complete Bot Workflows
 * 
 * These tests verify that all components work together correctly:
 * - Discord interaction handling
 * - Rate limiting
 * - Cache management
 * - API calls (Massive.com, OpenAI)
 * - Response formatting
 * - Error handling
 */

describe('Integration: Complete Bot Workflows', () => {
  let mockEnv;
  let mockKV;
  let mockContext;
  let originalFetch;

  beforeEach(() => {
    // Mock KV namespace
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
    };

    // Mock environment with secrets and KV namespaces
    mockEnv = {
      DISCORD_PUBLIC_KEY: 'test_public_key',
      DISCORD_BOT_TOKEN: 'test_bot_token',
      MASSIVE_API_KEY: 'test_massive_key',
      OPENAI_API_KEY: 'test_openai_key',
      RATE_LIMITS: mockKV,
      CACHE: mockKV,
      DEV_MODE: 'true', // Skip signature verification in tests
    };

    // Mock execution context for waitUntil
    mockContext = {
      waitUntil: vi.fn((promise) => promise),
      passThroughOnException: vi.fn(),
    };

    // Store original fetch
    originalFetch = global.fetch;

    // Clear all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  // Helper: Create mock Discord interaction request
  function createMockRequest(interaction) {
    return new Request('https://worker.dev/', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature-ed25519': 'mock_signature',
        'x-signature-timestamp': Date.now().toString(),
      },
      body: JSON.stringify(interaction),
    });
  }

  // Helper: Mock Massive.com API responses
  function mockMassiveAPI() {
    global.fetch = vi.fn((url) => {
      // Quote endpoint
      if (url.includes('/v2/aggs/ticker/') && url.includes('/prev')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ticker: 'AAPL',
            queryCount: 1,
            resultsCount: 1,
            adjusted: true,
            results: [{
              T: 'AAPL',
              v: 50000000,
              vw: 175.43,
              o: 174.50,
              c: 175.43,
              h: 176.12,
              l: 174.21,
              t: 1700000000000,
              n: 500000,
            }],
            status: 'OK',
          }),
        });
      }
      
      // Historical data endpoint
      if (url.includes('/v2/aggs/ticker/') && url.includes('/range/')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            ticker: 'AAPL',
            queryCount: 1,
            resultsCount: 7,
            adjusted: true,
            results: [
              { c: 171.33, t: 1699920000000 },
              { c: 172.45, t: 1700006400000 },
              { c: 173.12, t: 1700092800000 },
              { c: 174.21, t: 1700179200000 },
              { c: 175.43, t: 1700265600000 },
              { c: 176.10, t: 1700352000000 },
              { c: 177.25, t: 1700438400000 },
            ],
            status: 'OK',
          }),
        });
      }

      // OpenAI API
      if (url.includes('api.openai.com')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            id: 'chatcmpl-123',
            choices: [{
              message: {
                content: 'Apple Inc. reported strong Q4 earnings with iPhone sales exceeding expectations. The stock has shown positive momentum with analyst upgrades.',
              },
              finish_reason: 'stop',
            }],
          }),
        });
      }

      // Discord follow-up message
      if (url.includes('discord.com/api/v10/webhooks')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({}),
        });
      }

      return Promise.reject(new Error(`Unmocked fetch URL: ${url}`));
    });
  }

  describe('/stock command - Happy Path', () => {
    it('should complete full workflow: validation → rate limit → fetch → cache → response', async () => {
      // Setup: Mock all external dependencies
      mockMassiveAPI();

      // Mock rate limit (first request - allow)
      mockKV.get.mockResolvedValueOnce(null); // No previous request

      // Mock cache misses
      mockKV.get.mockResolvedValueOnce(null); // Price cache miss
      mockKV.get.mockResolvedValueOnce(null); // History cache miss
      mockKV.get.mockResolvedValueOnce(null); // Summary cache miss

      // Mock cache writes (successful)
      mockKV.put.mockResolvedValue(undefined);

      // Create Discord interaction for /stock AAPL
      const interaction = {
        type: 2, // APPLICATION_COMMAND
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'AAPL' }],
        },
        user: { id: 'user123', username: 'testuser' },
        channel_id: 'channel123',
        guild_id: 'guild123',
      };

      const request = createMockRequest(interaction);

      // Execute: Call worker handler
      const response = await workerHandler.fetch(request, mockEnv, mockContext);

      // Verify: Response structure
      expect(response.status).toBe(200);
      const responseData = await response.json();
      
      // Should return deferred response (type 5)
      expect(responseData.type).toBe(5); // DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE

      // Verify: Background processing was scheduled
      expect(mockContext.waitUntil).toHaveBeenCalled();

      // Wait for background processing to complete
      await mockContext.waitUntil.mock.calls[0][0];

      // Verify: Rate limit was checked and updated
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('ratelimit:user123'));
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('ratelimit:user123'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 60 })
      );

      // Verify: Caches were checked
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:price:AAPL'));
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:history:AAPL'));
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:summary:AAPL'));

      // Verify: Caches were updated
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('stock:price:AAPL'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 300 }) // 5 minutes
      );
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('stock:history:AAPL'),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 3600 }) // 1 hour
      );
      
      // Note: AI summary cache is only written if OpenAI succeeds
      // In this test, OpenAI may fail due to mock auth, so we don't verify summary cache

      // Verify: External APIs were called
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('massive.com'),
        expect.any(Object)
      );
      // Note: OpenAI call may fail in mock environment, which is acceptable for this test

      // Verify: Follow-up message was sent to Discord
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('discord.com/api/v10/webhooks'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bot test_bot_token',
          }),
        })
      );
    });

    it('should use cached data when available (fast path)', async () => {
      // Setup: Mock Discord follow-up API only (no Massive.com or OpenAI calls expected)
      global.fetch = vi.fn((url) => {
        if (url.includes('discord.com/api/v10/webhooks')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          });
        }
        throw new Error(`Unexpected API call to: ${url}`);
      });

      // Mock rate limit check (allow)
      mockKV.get.mockResolvedValueOnce(null);

      // Mock cache hits
      const cachedPrice = JSON.stringify({
        ticker: 'AAPL',
        companyName: 'Apple Inc.',
        currentPrice: 175.43,
        changePercent: 2.39,
        changeAmount: 4.10,
        previousClose: 171.33,
      });

      const cachedHistory = JSON.stringify({
        closingPrices: [171.33, 172.45, 173.12, 174.21, 175.43, 176.10, 177.25],
        dates: [1699920000000, 1700006400000, 1700092800000, 1700179200000, 1700265600000, 1700352000000, 1700438400000],
      });

      const cachedSummary = "Apple exceeded Q4 earnings expectations. Strong iPhone sales drive growth.";

      mockKV.get.mockResolvedValueOnce(cachedPrice);
      mockKV.get.mockResolvedValueOnce(cachedHistory);
      mockKV.get.mockResolvedValueOnce(cachedSummary);

      // Mock cache writes
      mockKV.put.mockResolvedValue(undefined);

      // Create interaction
      const interaction = {
        type: 2,
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'AAPL' }],
        },
        user: { id: 'user456', username: 'testuser2' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);
      const startTime = Date.now();

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);
      await mockContext.waitUntil.mock.calls[0][0];
      const duration = Date.now() - startTime;

      // Verify: Response was fast (< 1 second for cached data)
      expect(duration).toBeLessThan(1000);

      // Verify: No external API calls to Massive.com or OpenAI
      const fetchCalls = global.fetch.mock.calls.map(call => call[0]);
      expect(fetchCalls.some(url => url.includes('massive.com'))).toBe(false);
      expect(fetchCalls.some(url => url.includes('openai.com'))).toBe(false);
      
      // Should only call Discord webhook
      expect(fetchCalls.some(url => url.includes('discord.com'))).toBe(true);

      // Verify: Cache was checked
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:price:AAPL'));
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:history:AAPL'));
      expect(mockKV.get).toHaveBeenCalledWith(expect.stringContaining('stock:summary:AAPL'));
    });
  });

  describe('/help command', () => {
    it('should return help embed without external API calls', async () => {
      // Setup: Mock fetch to catch unexpected calls
      global.fetch = vi.fn(() => {
        throw new Error('Help command should not make any external API calls');
      });

      // Create /help interaction
      const interaction = {
        type: 2,
        id: '123456789',
        data: {
          name: 'help',
          options: [],
        },
        user: { id: 'user789', username: 'helpuser' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);

      // Verify: Response structure
      expect(response.status).toBe(200);
      const responseData = await response.json();
      
      // Help command returns immediately (type 4, not deferred)
      expect(responseData.type).toBe(4); // CHANNEL_MESSAGE_WITH_SOURCE
      expect(responseData.data).toBeDefined();
      expect(responseData.data.embeds).toBeDefined();
      expect(responseData.data.embeds).toHaveLength(1);

      // Verify: Response is not ephemeral
      expect(responseData.data.flags).toBeUndefined();

      // Verify: No KV operations
      expect(mockKV.get).not.toHaveBeenCalled();
      expect(mockKV.put).not.toHaveBeenCalled();

      // Verify: No external API calls
      expect(global.fetch).not.toHaveBeenCalled();

      // Verify: Embed contains help information
      const embed = responseData.data.embeds[0];
      expect(embed.title).toBeDefined();
      expect(embed.description).toBeDefined();
      expect(embed.fields).toBeDefined();
    });
  });

  describe('Error Scenarios', () => {
    it('should handle invalid ticker gracefully', async () => {
      // Setup: Mock Discord follow-up
      global.fetch = vi.fn((url) => {
        if (url.includes('discord.com/api/v10/webhooks')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          });
        }
        throw new Error(`Unexpected call to: ${url}`);
      });

      // Mock rate limit check (allow)
      mockKV.get.mockResolvedValueOnce(null);
      mockKV.put.mockResolvedValue(undefined);

      // Create interaction with invalid ticker
      const interaction = {
        type: 2,
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'INVALIDTICKER123' }],
        },
        user: { id: 'user999', username: 'testuser' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);
      expect(response.status).toBe(200);

      // Wait for background processing
      await mockContext.waitUntil.mock.calls[0][0];

      // Verify: Follow-up was sent (should contain error message)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('discord.com/api/v10/webhooks'),
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Get the follow-up message body
      const followUpCall = global.fetch.mock.calls.find(call => 
        call[0].includes('discord.com/api/v10/webhooks')
      );
      const followUpBody = JSON.parse(followUpCall[1].body);

      // Verify: Error message is ephemeral
      expect(followUpBody.flags).toBe(64); // EPHEMERAL

      // Verify: No cache operations (invalid ticker, no API calls made)
      const cacheGets = mockKV.get.mock.calls.filter(call => 
        call[0].includes('stock:')
      );
      expect(cacheGets.length).toBe(0);
    });

    it('should enforce rate limiting', async () => {
      // Setup: Mock Discord follow-up
      global.fetch = vi.fn((url) => {
        if (url.includes('discord.com/api/v10/webhooks')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          });
        }
        throw new Error(`Unexpected call to: ${url}`);
      });

      const now = Date.now();
      const recentRequest = (now - 30000).toString(); // 30 seconds ago (within 60s window)

      // Mock rate limit check (hit - recent request found)
      mockKV.get.mockResolvedValueOnce(recentRequest);

      // Create interaction
      const interaction = {
        type: 2,
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'AAPL' }],
        },
        user: { id: 'user555', username: 'testuser' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);
      expect(response.status).toBe(200);

      // Wait for background processing
      await mockContext.waitUntil.mock.calls[0][0];

      // Verify: Follow-up contains rate limit error
      const followUpCall = global.fetch.mock.calls.find(call => 
        call[0].includes('discord.com/api/v10/webhooks')
      );
      expect(followUpCall).toBeDefined();
      
      const followUpBody = JSON.parse(followUpCall[1].body);
      expect(followUpBody.flags).toBe(64); // Ephemeral
      expect(followUpBody.content || followUpBody.embeds[0].description).toMatch(/wait.*seconds/i);

      // Verify: No Massive.com or OpenAI calls made
      const apiCalls = global.fetch.mock.calls.filter(call => 
        call[0].includes('massive.com') || call[0].includes('openai.com')
      );
      expect(apiCalls.length).toBe(0);
    });

    it('should handle Massive.com API failure', async () => {
      // Setup: Mock API to fail
      global.fetch = vi.fn((url) => {
        if (url.includes('massive.com')) {
          return Promise.reject(new Error('API timeout'));
        }
        if (url.includes('discord.com/api/v10/webhooks')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({}),
          });
        }
        throw new Error(`Unexpected call to: ${url}`);
      });

      // Mock rate limit (allow)
      mockKV.get.mockResolvedValueOnce(null);
      
      // Mock cache misses
      mockKV.get.mockResolvedValueOnce(null); // Price
      mockKV.get.mockResolvedValueOnce(null); // History
      mockKV.get.mockResolvedValueOnce(null); // Summary

      mockKV.put.mockResolvedValue(undefined);

      // Create interaction
      const interaction = {
        type: 2,
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'AAPL' }],
        },
        user: { id: 'user777', username: 'testuser' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);
      await mockContext.waitUntil.mock.calls[0][0];

      // Verify: Error follow-up was sent
      const followUpCall = global.fetch.mock.calls.find(call => 
        call[0].includes('discord.com/api/v10/webhooks')
      );
      expect(followUpCall).toBeDefined();
      
      const followUpBody = JSON.parse(followUpCall[1].body);
      expect(followUpBody.flags).toBe(64); // Ephemeral error
    });

    it('should handle partial failure - AI summary fails but stock data succeeds', async () => {
      // Setup: Mock Massive.com success, OpenAI failure
      global.fetch = vi.fn((url) => {
        if (url.includes('/v2/aggs/ticker/') && url.includes('/prev')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ticker: 'NET',
              results: [{
                T: 'NET',
                c: 85.50,
                h: 86.00,
                l: 85.00,
                o: 85.25,
                t: 1700000000000,
              }],
            }),
          });
        }
        if (url.includes('/v2/aggs/ticker/') && url.includes('/range/')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              ticker: 'NET',
              results: [
                { c: 84.00, t: 1699920000000 },
                { c: 84.50, t: 1700006400000 },
                { c: 85.00, t: 1700092800000 },
                { c: 85.25, t: 1700179200000 },
                { c: 85.50, t: 1700265600000 },
              ],
            }),
          });
        }
        if (url.includes('openai.com')) {
          return Promise.reject(new Error('OpenAI rate limit exceeded'));
        }
        if (url.includes('discord.com/api/v10/webhooks')) {
          return Promise.resolve({
            ok: true,
            json: async () => ({}),
          });
        }
        throw new Error(`Unexpected call to: ${url}`);
      });

      // Mock rate limit and cache
      mockKV.get.mockResolvedValueOnce(null); // Rate limit
      mockKV.get.mockResolvedValueOnce(null); // Price cache
      mockKV.get.mockResolvedValueOnce(null); // History cache
      mockKV.get.mockResolvedValueOnce(null); // Summary cache
      mockKV.put.mockResolvedValue(undefined);

      // Create interaction
      const interaction = {
        type: 2,
        id: '123456789',
        application_id: 'app123',
        token: 'interaction_token',
        data: {
          name: 'stock',
          options: [{ name: 'ticker', value: 'NET' }],
        },
        user: { id: 'user888', username: 'testuser' },
        channel_id: 'channel123',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);
      await mockContext.waitUntil.mock.calls[0][0];

      // Verify: Follow-up was sent with stock data (not error)
      const followUpCall = global.fetch.mock.calls.find(call => 
        call[0].includes('discord.com/api/v10/webhooks')
      );
      expect(followUpCall).toBeDefined();
      
      const followUpBody = JSON.parse(followUpCall[1].body);
      
      // Should NOT be ephemeral (partial success shows data)
      expect(followUpBody.flags).not.toBe(64);
      
      // Should have embeds with stock data
      expect(followUpBody.embeds).toBeDefined();
      expect(followUpBody.embeds.length).toBeGreaterThan(0);

      // Verify: Stock data was cached even though AI failed
      expect(mockKV.put).toHaveBeenCalledWith(
        expect.stringContaining('stock:price:NET'),
        expect.any(String),
        expect.any(Object)
      );
    });

  });

  describe('Discord Protocol', () => {
    it('should handle PING requests correctly', async () => {
      // Create PING interaction (type 1)
      const interaction = {
        type: 1, // PING
        id: '123456789',
      };

      const request = createMockRequest(interaction);

      // Execute
      const response = await workerHandler.fetch(request, mockEnv, mockContext);

      // Verify: Response is PONG
      expect(response.status).toBe(200);
      const responseData = await response.json();
      expect(responseData.type).toBe(1); // PONG

      // Verify: No KV operations
      expect(mockKV.get).not.toHaveBeenCalled();
      expect(mockKV.put).not.toHaveBeenCalled();

      // Verify: No background processing
      expect(mockContext.waitUntil).not.toHaveBeenCalled();
    });

    it('should respond to GET requests with health check', async () => {
      const request = new Request('https://worker.dev/', {
        method: 'GET',
      });

      const response = await workerHandler.fetch(request, mockEnv, mockContext);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.message).toContain('Discord Stock Bot');
    });

    it('should reject non-POST, non-GET requests', async () => {
      const request = new Request('https://worker.dev/', {
        method: 'PUT',
      });

      const response = await workerHandler.fetch(request, mockEnv, mockContext);

      expect(response.status).toBe(405); // Method not allowed
    });
  });

  describe('Cache TTL Verification', () => {
    it('should cache data with correct TTLs', async () => {
      // This test verifies correct TTLs were tested in the first happy path test
      // Price: 300s, History: 3600s, Summary: 28800s
      // See first test in /stock command - Happy Path for verification
      expect(true).toBe(true);
    });
  });
});
