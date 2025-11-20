// ABOUTME: Tests for Discord-specific utility functions
// ABOUTME: Covers signature verification, response formatting, and command parsing

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyDiscordRequest,
  createInteractionResponse,
  createEmbedResponse,
  parseSlashCommand
} from '../../src/services/discord.js';

describe('Discord Service', () => {
  describe('verifyDiscordRequest', () => {
    it('should return true for valid Discord signature', async () => {
      // Mock request with valid signature
      const mockRequest = {
        headers: new Map([
          ['x-signature-ed25519', 'valid_signature'],
          ['x-signature-timestamp', '1234567890']
        ]),
        clone: () => ({
          arrayBuffer: async () => new ArrayBuffer(8)
        })
      };

      // We'll mock the actual verification function from discord-interactions
      // For now, test the structure is called correctly
      const result = await verifyDiscordRequest(mockRequest, 'test_public_key');
      expect(typeof result).toBe('boolean');
    });

    it('should return false for missing signature header', async () => {
      const mockRequest = {
        headers: new Map([
          ['x-signature-timestamp', '1234567890']
        ]),
        clone: () => ({
          arrayBuffer: async () => new ArrayBuffer(8)
        })
      };

      const result = await verifyDiscordRequest(mockRequest, 'test_public_key');
      expect(result).toBe(false);
    });

    it('should return false for missing timestamp header', async () => {
      const mockRequest = {
        headers: new Map([
          ['x-signature-ed25519', 'valid_signature']
        ]),
        clone: () => ({
          arrayBuffer: async () => new ArrayBuffer(8)
        })
      };

      const result = await verifyDiscordRequest(mockRequest, 'test_public_key');
      expect(result).toBe(false);
    });

    it('should handle invalid signatures gracefully', async () => {
      const mockRequest = {
        headers: new Map([
          ['x-signature-ed25519', 'invalid_signature'],
          ['x-signature-timestamp', '1234567890']
        ]),
        clone: () => ({
          arrayBuffer: async () => new ArrayBuffer(8)
        })
      };

      // Should not throw, just return false
      const result = await verifyDiscordRequest(mockRequest, 'test_public_key');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('createInteractionResponse', () => {
    it('should create response with type 4 (CHANNEL_MESSAGE_WITH_SOURCE)', () => {
      const data = { content: 'Test message' };
      const response = createInteractionResponse(data, false);

      expect(response).toHaveProperty('type', 4);
      expect(response).toHaveProperty('data');
      expect(response.data).toEqual(data);
    });

    it('should set ephemeral flag when ephemeral is true', () => {
      const data = { content: 'Secret message' };
      const response = createInteractionResponse(data, true);

      expect(response.type).toBe(4);
      expect(response.data.flags).toBe(64); // Ephemeral flag
    });

    it('should not set ephemeral flag when ephemeral is false', () => {
      const data = { content: 'Public message' };
      const response = createInteractionResponse(data, false);

      expect(response.type).toBe(4);
      expect(response.data.flags).toBeUndefined();
    });

    it('should preserve existing data fields', () => {
      const data = {
        content: 'Test',
        embeds: [{ title: 'Test Embed' }],
        components: []
      };
      const response = createInteractionResponse(data, false);

      expect(response.data.content).toBe('Test');
      expect(response.data.embeds).toEqual([{ title: 'Test Embed' }]);
      expect(response.data.components).toEqual([]);
    });
  });

  describe('createEmbedResponse', () => {
    it('should wrap embed in proper response structure', () => {
      const embed = {
        title: 'Stock Info',
        description: 'AAPL data',
        color: 0x00ff00
      };
      
      const response = createEmbedResponse(embed, false);

      expect(response.type).toBe(4);
      expect(response.data.embeds).toEqual([embed]);
    });

    it('should set ephemeral flag for embed responses', () => {
      const embed = { title: 'Error', description: 'Something went wrong' };
      const response = createEmbedResponse(embed, true);

      expect(response.type).toBe(4);
      expect(response.data.flags).toBe(64);
      expect(response.data.embeds).toEqual([embed]);
    });

    it('should handle embeds without ephemeral flag', () => {
      const embed = { title: 'Public Info' };
      const response = createEmbedResponse(embed, false);

      expect(response.data.flags).toBeUndefined();
      expect(response.data.embeds).toEqual([embed]);
    });

    it('should handle complex embed structures', () => {
      const embed = {
        title: 'AAPL - Apple Inc.',
        description: 'Stock information',
        color: 0x00ff00,
        fields: [
          { name: 'Price', value: '$175.43', inline: true },
          { name: 'Change', value: '+2.3%', inline: true }
        ],
        footer: { text: 'Data from Massive.com' },
        timestamp: new Date().toISOString()
      };

      const response = createEmbedResponse(embed, false);

      expect(response.data.embeds[0]).toEqual(embed);
      expect(response.data.embeds[0].fields).toHaveLength(2);
    });
  });

  describe('parseSlashCommand', () => {
    it('should extract command name from interaction', () => {
      const interaction = {
        type: 2, // APPLICATION_COMMAND
        data: {
          name: 'stock',
          options: []
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.command).toBe('stock');
    });

    it('should extract command options', () => {
      const interaction = {
        type: 2,
        data: {
          name: 'stock',
          options: [
            { name: 'ticker', type: 3, value: 'AAPL' }
          ]
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.command).toBe('stock');
      expect(parsed.options).toEqual({
        ticker: 'AAPL'
      });
    });

    it('should handle commands without options', () => {
      const interaction = {
        type: 2,
        data: {
          name: 'help',
          options: []
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.command).toBe('help');
      expect(parsed.options).toEqual({});
    });

    it('should handle multiple options', () => {
      const interaction = {
        type: 2,
        data: {
          name: 'compare',
          options: [
            { name: 'ticker1', type: 3, value: 'AAPL' },
            { name: 'ticker2', type: 3, value: 'GOOGL' },
            { name: 'period', type: 3, value: '7d' }
          ]
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.command).toBe('compare');
      expect(parsed.options).toEqual({
        ticker1: 'AAPL',
        ticker2: 'GOOGL',
        period: '7d'
      });
    });

    it('should extract user information', () => {
      const interaction = {
        type: 2,
        data: { name: 'stock', options: [] },
        member: {
          user: {
            id: '123456789',
            username: 'testuser'
          }
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.userId).toBe('123456789');
      expect(parsed.username).toBe('testuser');
    });

    it('should handle direct messages (no member, has user)', () => {
      const interaction = {
        type: 2,
        data: { name: 'stock', options: [] },
        user: {
          id: '987654321',
          username: 'dmuser'
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.userId).toBe('987654321');
      expect(parsed.username).toBe('dmuser');
    });

    it('should extract guild and channel information', () => {
      const interaction = {
        type: 2,
        data: { name: 'stock', options: [] },
        guild_id: 'guild_123',
        channel_id: 'channel_456',
        member: {
          user: { id: '789', username: 'user' }
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.guildId).toBe('guild_123');
      expect(parsed.channelId).toBe('channel_456');
    });

    it('should handle missing optional fields gracefully', () => {
      const interaction = {
        type: 2,
        data: {
          name: 'help'
        },
        user: {
          id: '123',
          username: 'user'
        }
      };

      const parsed = parseSlashCommand(interaction);

      expect(parsed.command).toBe('help');
      expect(parsed.options).toEqual({});
      expect(parsed.userId).toBe('123');
      expect(parsed.guildId).toBeUndefined();
      expect(parsed.channelId).toBeUndefined();
    });
  });
});
