// ABOUTME: Main Cloudflare Worker entry point for Discord Stock Bot
// ABOUTME: Handles Discord interactions and routes commands to appropriate handlers

export default {
  async fetch(request, env, ctx) {
    // Basic health check response
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ 
        status: 'ok',
        message: 'Discord Stock Bot is running' 
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For now, return a placeholder for POST requests (Discord interactions)
    if (request.method === 'POST') {
      return new Response(JSON.stringify({ 
        type: 1  // PONG response for Discord verification
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Method not allowed', { status: 405 });
  },
};
