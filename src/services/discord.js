// ABOUTME: Discord-specific utility functions for handling interactions
// ABOUTME: Includes signature verification, response formatting, and command parsing

import { verifyKey } from 'discord-interactions';

/**
 * Discord interaction response types
 */
export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
};

/**
 * Discord message flags
 */
export const MessageFlags = {
  EPHEMERAL: 64, // Only the user who triggered the interaction can see the message
};

/**
 * Verify that a request came from Discord
 * @param {Request} request - The incoming request object
 * @param {string} publicKey - Discord application public key
 * @returns {Promise<boolean>} True if signature is valid, false otherwise
 */
export async function verifyDiscordRequest(request, publicKey) {
  try {
    // Get headers - handle both Headers object and Map
    const getHeader = (name) => {
      if (request.headers instanceof Map) {
        return request.headers.get(name);
      }
      return request.headers.get ? request.headers.get(name) : request.headers[name];
    };

    const signature = getHeader('x-signature-ed25519');
    const timestamp = getHeader('x-signature-timestamp');

    // Check for required headers
    if (!signature || !timestamp) {
      console.warn('[WARN] Missing Discord signature headers');
      return false;
    }

    // Clone the request to read the body without consuming the original
    const body = await request.clone().arrayBuffer();
    
    // Convert ArrayBuffer to string for verification
    const bodyString = new TextDecoder().decode(body);

    // Verify the signature using discord-interactions library
    const isValid = verifyKey(bodyString, signature, timestamp, publicKey);
    
    if (!isValid) {
      console.warn('[WARN] Invalid Discord signature');
    }
    
    return isValid;

  } catch (error) {
    console.error('[ERROR] Discord signature verification failed', {
      error: error.message
    });
    return false;
  }
}

/**
 * Create a Discord interaction response
 * @param {Object} data - Response data (content, embeds, etc.)
 * @param {boolean} ephemeral - Whether the response should be ephemeral (only visible to user)
 * @returns {Object} Formatted interaction response
 */
export function createInteractionResponse(data, ephemeral = false) {
  const response = {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { ...data }
  };

  // Add ephemeral flag if requested
  if (ephemeral) {
    response.data.flags = MessageFlags.EPHEMERAL;
  }

  return response;
}

/**
 * Create a Discord interaction response with an embed
 * @param {Object} embed - Discord embed object
 * @param {boolean} ephemeral - Whether the response should be ephemeral
 * @returns {Object} Formatted interaction response with embed
 */
export function createEmbedResponse(embed, ephemeral = false) {
  return createInteractionResponse(
    {
      embeds: [embed]
    },
    ephemeral
  );
}

/**
 * Parse a Discord slash command interaction
 * @param {Object} interaction - Discord interaction object
 * @returns {Object} Parsed command data with command name, options, and user info
 */
export function parseSlashCommand(interaction) {
  const result = {
    command: interaction.data?.name || '',
    options: {},
    userId: null,
    username: null,
    guildId: interaction.guild_id,
    channelId: interaction.channel_id
  };

  // Extract options into a key-value object
  if (interaction.data?.options && Array.isArray(interaction.data.options)) {
    for (const option of interaction.data.options) {
      result.options[option.name] = option.value;
    }
  }

  // Extract user information (from member in guild, or user in DM)
  const user = interaction.member?.user || interaction.user;
  if (user) {
    result.userId = user.id;
    result.username = user.username;
  }

  return result;
}

/**
 * Create a PONG response for Discord's PING interaction
 * @returns {Object} PONG response
 */
export function createPongResponse() {
  return {
    type: InteractionResponseType.PONG
  };
}
