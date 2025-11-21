// ABOUTME: Deletes guild-specific slash commands to avoid duplicates with global commands.
// ABOUTME: Run this to clean up duplicate commands in your test server.

import { REST } from '@discordjs/rest';
import { Routes } from 'discord-api-types/v10';

/**
 * Delete all guild-specific commands
 */
async function deleteGuildCommands() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const appId = process.env.DISCORD_APP_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !appId || !guildId) {
    console.error('❌ Error: DISCORD_BOT_TOKEN, DISCORD_APP_ID, and GUILD_ID are required');
    console.error('   Set GUILD_ID to your server ID to delete guild commands');
    process.exit(1);
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('🔄 Fetching guild commands...\n');
    console.log(`   Guild ID: ${guildId}`);
    
    // Get all guild commands
    const commands = await rest.get(
      Routes.applicationGuildCommands(appId, guildId)
    );

    if (commands.length === 0) {
      console.log('✅ No guild-specific commands found. Nothing to delete.');
      return;
    }

    console.log(`\n📋 Found ${commands.length} guild command(s):`);
    commands.forEach(cmd => {
      console.log(`   • ${cmd.name} - ${cmd.description}`);
    });

    // Delete all guild commands
    console.log('\n🗑️  Deleting guild commands...');
    await rest.put(
      Routes.applicationGuildCommands(appId, guildId),
      { body: [] }
    );

    console.log('✅ Successfully deleted all guild-specific commands!');
    console.log('   Your server will now only use global commands.');
    console.log('   Note: It may take a few minutes for Discord to update.');
    
  } catch (error) {
    console.error('❌ Failed to delete commands:');
    console.error(`   ${error.message}`);
    process.exit(1);
  }
}

deleteGuildCommands();
