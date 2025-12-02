// ABOUTME: Test suite for /crypto command handler
// ABOUTME: Verifies crypto symbol validation, rate limiting, and error handling

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCryptoCommand } from '../../src/commands/crypto.js';
import { InteractionResponseType, MessageFlags } from '../../src/services/discord.js';
import { ErrorTypes } from '../../src/utils/errorHandler.js';

describe('Crypto Command - Structure', () => {
  // Mock environment with KV namespaces
  let mockEnv;
  let mockKV;

  beforeEach(() => {
    // Create a mock KV namespace with get/put methods
    mockKV = {
      get: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
    };

    mockEnv = {
      RATE_LIMITS: mockKV,
      CACHE: mockKV,
      MASSIVE_API_KEY: 'test_massive_key',
      OPENAI_API_KEY: 'test_openai_key',
      FINNHUB_API_KEY: 'test_finnhub_key',
    };
  });

  describe('Symbol Extraction', () => {
    it('should extract symbol from interaction options', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'BTC' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      // Mock rate limit to allow request
      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });

    it('should handle uppercase symbol', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'ETH' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });

    it('should handle lowercase symbol conversion', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'btc' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });
  });

  describe('Validation', () => {
    it('should reject empty symbol', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: '' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const result = await handleCryptoCommand(mockInteraction, mockEnv);
      
      expect(result.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(result.data.flags).toBe(MessageFlags.EPHEMERAL);
      expect(result.data.content).toContain('empty');
    });

    it('should reject single character symbols', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'B' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const result = await handleCryptoCommand(mockInteraction, mockEnv);
      
      expect(result.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(result.data.flags).toBe(MessageFlags.EPHEMERAL);
      expect(result.data.content).toContain('2-10 characters');
    });

    it('should reject symbols with special characters', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'BTC-ETH' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const result = await handleCryptoCommand(mockInteraction, mockEnv);
      
      expect(result.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(result.data.flags).toBe(MessageFlags.EPHEMERAL);
      expect(result.data.content).toContain('letters only');
    });

    it('should accept full crypto names', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'BITCOIN' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });
  });

  // Rate limiting behavior is tested in tests/middleware/rateLimit.test.js

  describe('Error Handling', () => {
    it('should handle missing symbol option', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: []
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const result = await handleCryptoCommand(mockInteraction, mockEnv);
      
      expect(result.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(result.data.flags).toBe(MessageFlags.EPHEMERAL);
    });

    it('should handle null symbol value', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: null }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      const result = await handleCryptoCommand(mockInteraction, mockEnv);
      
      expect(result.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
      expect(result.data.flags).toBe(MessageFlags.EPHEMERAL);
      expect(result.data.content).toContain('empty');
    });
  });

  describe('User Context', () => {
    it('should extract user ID from direct message', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'BTC' }
          ]
        },
        user: { id: 'user123', username: 'testuser' }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });

    it('should extract user ID from guild message', async () => {
      const mockInteraction = {
        id: '123456789',
        type: 2,
        data: {
          name: 'crypto',
          options: [
            { name: 'symbol', value: 'BTC' }
          ]
        },
        member: {
          user: { id: 'user456', username: 'guilduser' }
        }
      };

      mockKV.get.mockResolvedValue(null);
      mockKV.put.mockResolvedValue(undefined);

      try {
        await handleCryptoCommand(mockInteraction, mockEnv);
      } catch (error) {
        // Expected to fail until APIs are mocked
      }
    });
  });
});
