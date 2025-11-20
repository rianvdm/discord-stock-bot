// ABOUTME: Handler for /help command that displays bot usage instructions
// ABOUTME: Returns a rich embed with commands, examples, rate limits, and data sources

import { buildHelpEmbed } from '../utils/embedBuilder.js';
import { createEmbedResponse } from '../services/discord.js';

/**
 * Handle the /help command
 * @param {Object} interaction - Discord interaction object
 * @param {Object} env - Cloudflare Workers environment (not used for help, but kept for consistency)
 * @returns {Promise<Object>} Discord interaction response with help embed
 */
export async function handleHelpCommand(interaction, env) {
  try {
    // Build help embed using the utility function
    const helpEmbed = buildHelpEmbed();
    
    // Return embed response (not ephemeral - visible to all users)
    return createEmbedResponse(helpEmbed, false);
    
  } catch (error) {
    console.error('[ERROR] Failed to handle help command', {
      error: error.message,
      userId: interaction.user?.id || interaction.member?.user?.id
    });
    
    // Fallback to simple text response if embed building fails
    return {
      type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
      data: {
        content: '❌ Sorry, there was an error displaying the help information. Please try again later.'
      }
    };
  }
}
