// ABOUTME: Main Cloudflare Worker entry point for Discord Stock Bot
// ABOUTME: Handles Discord interactions and routes commands to appropriate handlers

import { verifyDiscordRequest } from './services/discord.js';
import { handleStockCommand } from './commands/stock.js';
import { handleHelpCommand } from './commands/help.js';
import { BotError, ErrorTypes, formatErrorResponse } from './utils/errorHandler.js';

/**
 * Main Cloudflare Worker handler
 * 
 * Processes incoming Discord interactions:
 * 1. Verifies request signature
 * 2. Handles PING/PONG
 * 3. Routes commands to handlers
 * 4. Returns formatted responses
 */
export default {
  async fetch(request, env, ctx) {
    try {
      // Health check endpoint for monitoring
      if (request.method === 'GET') {
        return new Response(JSON.stringify({ 
          status: 'ok',
          message: 'Discord Stock Bot is running',
          timestamp: new Date().toISOString(),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Only accept POST requests for Discord interactions
      if (request.method !== 'POST') {
        console.warn('[WARN] Non-POST request received', { method: request.method });
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
          status: 405,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Verify Discord request signature (skip in dev mode for local testing)
      const isDevelopment = env.DEV_MODE === 'true';
      
      if (!isDevelopment) {
        const isValid = await verifyDiscordRequest(request, env.DISCORD_PUBLIC_KEY);
        if (!isValid) {
          console.error('[ERROR] Invalid Discord signature');
          return new Response(JSON.stringify({ error: 'Invalid request signature' }), { 
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      } else {
        console.log('[DEV] Skipping signature verification in development mode');
      }

      // Parse interaction from request body
      const interaction = await request.json();
      console.log('[INFO] Interaction received', { 
        type: interaction.type,
        commandName: interaction.data?.name,
        userId: interaction.user?.id || interaction.member?.user?.id,
      });

      // Handle PING (Discord verification)
      if (interaction.type === 1) {
        console.log('[INFO] PING received, responding with PONG');
        return new Response(JSON.stringify({ type: 1 }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle APPLICATION_COMMAND (slash commands)
      if (interaction.type === 2) {
        const commandName = interaction.data?.name;

        if (!commandName) {
          throw new BotError(
            'Command name missing from interaction',
            ErrorTypes.UNKNOWN_ERROR
          );
        }

        let response;
        const startTime = Date.now();

        // Route to appropriate command handler
        switch (commandName) {
          case 'stock':
            response = await handleStockCommand(interaction, env);
            break;
          
          case 'help':
            response = await handleHelpCommand(interaction, env);
            break;
          
          default:
            console.warn('[WARN] Unknown command', { commandName });
            throw new BotError(
              `Unknown command: ${commandName}`,
              ErrorTypes.UNKNOWN_ERROR
            );
        }

        const duration = Date.now() - startTime;
        console.log('[INFO] Command completed', { 
          commandName, 
          userId: interaction.user?.id || interaction.member?.user?.id,
          duration: `${duration}ms`,
        });

        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Handle other interaction types (not supported)
      console.warn('[WARN] Unsupported interaction type', { type: interaction.type });
      throw new BotError(
        'Unsupported interaction type',
        ErrorTypes.UNKNOWN_ERROR
      );

    } catch (error) {
      console.error('[ERROR] Request handling failed', {
        error: error.message,
        stack: error.stack,
        type: error.type,
      });

      // Return user-friendly error
      const errorResponse = error instanceof BotError 
        ? formatErrorResponse(error)
        : formatErrorResponse(new BotError(
            'An unexpected error occurred. Please try again later.',
            ErrorTypes.UNKNOWN_ERROR
          ));

      return new Response(JSON.stringify(errorResponse), {
        status: 200, // Discord expects 200 even for application errors
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
