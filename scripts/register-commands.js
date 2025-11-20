// ABOUTME: Registers Discord slash commands (/stock, /help) with Discord API.
// ABOUTME: Supports both global and guild-specific command registration for testing.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

/**
 * Discord slash commands to register
 */
const commands = [
  {
    name: 'stock',
    description: 'Get stock price, 7-day trend, and AI-powered news summary',
    options: [
      {
        name: 'ticker',
        description: 'Stock ticker symbol (e.g., AAPL, NET, GOOGL)',
        type: 3, // STRING type
        required: true
      }
    ]
  },
  {
    name: 'help',
    description: 'Show bot usage instructions, rate limits, and data sources',
    options: []
  }
];

/**
 * Register commands with Discord API
 */
async function registerCommands() {
  // Get required environment variables
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APP_ID;
  const guildId = process.env.GUILD_ID; // Optional: for guild-specific registration

  // Validate required credentials
  if (!token) {
    console.error('❌ Error: DISCORD_BOT_TOKEN environment variable is required');
    console.error('   Set it with: export DISCORD_BOT_TOKEN=your_token_here');
    process.exit(1);
  }

  if (!appId) {
    console.error('❌ Error: DISCORD_APP_ID environment variable is required');
    console.error('   Set it with: export DISCORD_APP_ID=your_app_id_here');
    process.exit(1);
  }

  // Create REST client
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Starting command registration...\n');
    console.log(`   Application ID: ${appId}`);
    
    if (guildId) {
      // Guild-specific registration (instant, for testing)
      console.log(`   Guild ID: ${guildId}`);
      console.log('   Mode: Guild-specific (instant propagation)\n');
      
      const route = Routes.applicationGuildCommands(appId, guildId);
      await rest.put(route, { body: commands });
      
      console.log('✅ Successfully registered commands to guild!');
      console.log('   Commands are available immediately in your test server.');
    } else {
      // Global registration (takes ~1 hour to propagate)
      console.log('   Mode: Global (may take up to 1 hour to propagate)\n');
      
      const route = Routes.applicationCommands(appId);
      await rest.put(route, { body: commands });
      
      console.log('✅ Successfully registered global commands!');
      console.log('   ⚠️  Note: Global commands take ~1 hour to appear in Discord.');
      console.log('   💡 Tip: For instant testing, re-run with GUILD_ID set.');
    }

    // Display registered commands
    console.log('\n📋 Registered Commands:');
    commands.forEach(cmd => {
      console.log(`   • /${cmd.name} - ${cmd.description}`);
      if (cmd.options.length > 0) {
        cmd.options.forEach(opt => {
          console.log(`     └─ ${opt.name} (${opt.required ? 'required' : 'optional'}): ${opt.description}`);
        });
      }
    });

    console.log('\n🎉 Command registration complete!');
    
  } catch (error) {
    console.error('❌ Failed to register commands:');
    
    if (error.code === 'ENOTFOUND') {
      console.error('   Network error: Unable to reach Discord API');
    } else if (error.status === 401) {
      console.error('   Authentication error: Invalid bot token');
      console.error('   Check your DISCORD_BOT_TOKEN is correct');
    } else if (error.status === 403) {
      console.error('   Permission error: Bot lacks necessary permissions');
    } else if (error.status === 404) {
      console.error('   Not found: Invalid APPLICATION_ID or GUILD_ID');
    } else {
      console.error(`   ${error.message}`);
      if (error.status) {
        console.error(`   HTTP Status: ${error.status}`);
      }
    }
    
    process.exit(1);
  }
}

// Run the registration
registerCommands();

/*
 * USAGE INSTRUCTIONS
 * ==================
 * 
 * For Guild-Specific Registration (Instant - Recommended for Testing):
 * -------------------------------------------------------------------
 * 1. Get your Guild ID from Discord:
 *    - Enable Developer Mode: Settings → Advanced → Developer Mode
 *    - Right-click your test server → Copy Server ID
 * 
 * 2. Run the script:
 *    DISCORD_BOT_TOKEN=your_token DISCORD_APP_ID=your_app_id GUILD_ID=your_guild_id node scripts/register-commands.js
 * 
 * 3. Commands will be available immediately in your test server
 * 
 * 
 * For Global Registration (Takes ~1 Hour):
 * ----------------------------------------
 * DISCORD_BOT_TOKEN=your_token DISCORD_APP_ID=your_app_id node scripts/register-commands.js
 * 
 * 
 * Using .dev.vars (Local Development):
 * ------------------------------------
 * 1. Add to .dev.vars:
 *    DISCORD_BOT_TOKEN=your_token
 *    DISCORD_APP_ID=your_app_id
 *    GUILD_ID=your_guild_id  # Optional
 * 
 * 2. Run with:
 *    source .dev.vars && node scripts/register-commands.js
 * 
 * 
 * Verification:
 * -------------
 * - Open Discord and type "/" in any channel
 * - Your bot's commands should appear in the slash command menu
 * - Try /stock and /help to test
 * 
 * 
 * Troubleshooting:
 * ----------------
 * - If commands don't appear, check bot permissions
 * - Bot needs "applications.commands" scope in OAuth2 URL
 * - For global commands, wait up to 1 hour before testing
 * - For guild commands, they appear instantly
 */
