// ABOUTME: Test suite for /help command handler
// ABOUTME: Verifies help command returns correct embed structure and content

import { describe, it, expect } from 'vitest';
import { handleHelpCommand } from '../../src/commands/help.js';
import { InteractionResponseType } from '../../src/services/discord.js';

describe('Help Command', () => {
  // Mock interaction object
  const mockInteraction = {
    id: '123456789',
    type: 2, // APPLICATION_COMMAND
    data: {
      name: 'help',
      options: []
    },
    user: {
      id: 'user123',
      username: 'testuser'
    }
  };

  // Mock environment (not needed for help, but keeping consistent)
  const mockEnv = {};

  it('should return a response object', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    
    expect(response).toBeDefined();
    expect(response).toBeTypeOf('object');
  });

  it('should have correct response type (CHANNEL_MESSAGE_WITH_SOURCE)', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    
    expect(response.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
  });

  it('should contain an embed in the response data', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    
    expect(response.data).toBeDefined();
    expect(response.data.embeds).toBeDefined();
    expect(Array.isArray(response.data.embeds)).toBe(true);
    expect(response.data.embeds.length).toBe(1);
  });

  it('should have properly structured help embed', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    expect(embed).toBeDefined();
    expect(embed.title).toBeDefined();
    expect(embed.description).toBeDefined();
    expect(embed.color).toBeDefined();
    expect(embed.fields).toBeDefined();
    expect(Array.isArray(embed.fields)).toBe(true);
  });

  it('should include all required information in embed fields', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    // Extract field names
    const fieldNames = embed.fields.map(f => f.name);
    
    // Should include sections for commands, examples, rate limits, and data sources
    expect(fieldNames.some(name => name.toLowerCase().includes('command'))).toBe(true);
    expect(fieldNames.some(name => name.toLowerCase().includes('example'))).toBe(true);
    expect(fieldNames.some(name => name.toLowerCase().includes('rate'))).toBe(true);
    expect(fieldNames.some(name => name.toLowerCase().includes('data') || name.toLowerCase().includes('source'))).toBe(true);
  });

  it('should mention both /stock and /help commands', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    // Convert all field values to a single string for easier searching
    const allText = embed.fields.map(f => f.value).join(' ');
    
    expect(allText).toContain('/stock');
    expect(allText).toContain('/help');
  });

  it('should include rate limit information (1 every 30 seconds)', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    const allText = embed.fields.map(f => f.value).join(' ').toLowerCase();
    
    // Should mention "1" and "30 seconds" in relation to rate limiting
    expect(allText).toContain('1');
    expect(allText).toContain('30 seconds');
  });

  it('should mention data sources (Finnhub, Massive.com and OpenAI)', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    const allText = embed.fields.map(f => f.value).join(' ');
    
    expect(allText).toContain('Finnhub');
    expect(allText).toContain('Massive.com');
    expect(allText).toContain('OpenAI');
  });

  it('should NOT be ephemeral (visible to all users)', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    
    // Ephemeral responses have flags: 64
    expect(response.data.flags).toBeUndefined();
  });

  it('should include a footer', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    expect(embed.footer).toBeDefined();
    expect(embed.footer.text).toBeDefined();
    expect(embed.footer.text.length).toBeGreaterThan(0);
  });

  it('should include a timestamp', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];
    
    expect(embed.timestamp).toBeDefined();
    expect(typeof embed.timestamp).toBe('string');
    
    // Should be valid ISO 8601 format
    const date = new Date(embed.timestamp);
    expect(date.toString()).not.toBe('Invalid Date');
  });
});
