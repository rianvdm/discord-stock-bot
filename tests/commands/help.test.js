// ABOUTME: Test suite for /help command handler
// ABOUTME: Verifies help command returns correct embed structure

import { describe, it, expect } from 'vitest';
import { handleHelpCommand } from '../../src/commands/help.js';
import { InteractionResponseType } from '../../src/services/discord.js';

describe('Help Command', () => {
  const mockInteraction = {
    id: '123456789',
    type: 2,
    data: { name: 'help', options: [] },
    user: { id: 'user123', username: 'testuser' }
  };
  const mockEnv = {};

  it('should return correct response type', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);

    expect(response.type).toBe(InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE);
  });

  it('should contain a properly structured embed', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const embed = response.data.embeds[0];

    expect(embed.title).toBeDefined();
    expect(embed.description).toBeDefined();
    expect(embed.color).toBeDefined();
    expect(embed.fields).toBeDefined();
    expect(embed.footer).toBeDefined();
    expect(embed.timestamp).toBeDefined();
  });

  it('should include required sections', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const fieldNames = response.data.embeds[0].fields.map(f => f.name.toLowerCase());

    // Should have sections for commands, examples, rate limits, and data sources
    expect(fieldNames.some(name => name.includes('command'))).toBe(true);
    expect(fieldNames.some(name => name.includes('example'))).toBe(true);
    expect(fieldNames.some(name => name.includes('rate'))).toBe(true);
    expect(fieldNames.some(name => name.includes('data') || name.includes('source'))).toBe(true);
  });

  it('should mention available commands', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);
    const allText = response.data.embeds[0].fields.map(f => f.value).join(' ');

    expect(allText).toContain('/stock');
    expect(allText).toContain('/crypto');
    expect(allText).toContain('/help');
  });

  it('should NOT be ephemeral', async () => {
    const response = await handleHelpCommand(mockInteraction, mockEnv);

    expect(response.data.flags).toBeUndefined();
  });
});
