# Manual Testing Guide

This guide walks you through testing the Discord Stock Bot manually before deployment.

## Prerequisites

Before you can test, you need:
- [x] Discord bot created (from Phase 0)
- [x] Bot added to a test server
- [x] Discord credentials saved (BOT_TOKEN, PUBLIC_KEY, APP_ID)

## Step 1: Register Commands with Discord

First, you need to register the `/stock` and `/help` slash commands with Discord.

### Get Your Guild ID (Test Server ID)

1. Open Discord
2. Go to **Settings → Advanced**
3. Enable **Developer Mode**
4. Right-click on your test server name
5. Click **Copy Server ID**
6. Save this - you'll need it shortly

### Run the Registration Script

**Option A: Guild-Specific Registration (Recommended - Commands appear instantly)**

```bash
DISCORD_BOT_TOKEN=your_bot_token_here \
DISCORD_APP_ID=your_app_id_here \
GUILD_ID=your_guild_id_here \
node scripts/register-commands.js
```

✅ **Advantage**: Commands appear **immediately** in your test server  
⚠️ **Note**: Commands only work in that specific server

**Option B: Global Registration (Commands appear in all servers, takes ~1 hour)**

```bash
DISCORD_BOT_TOKEN=your_bot_token_here \
DISCORD_APP_ID=your_app_id_here \
node scripts/register-commands.js
```

⚠️ **Warning**: Takes up to 1 hour for commands to propagate

### Expected Output

```
🔄 Starting command registration...

   Application ID: 1234567890
   Guild ID: 9876543210
   Mode: Guild-specific (instant propagation)

✅ Successfully registered commands to guild!
   Commands are available immediately in your test server.

📋 Registered Commands:
   • /stock - Get stock price, 30-day trend, and AI-powered news summary
     └─ ticker (required): Stock ticker symbol (e.g., AAPL, NET, GOOGL)
   • /help - Show bot usage instructions, rate limits, and data sources

🎉 Command registration complete!
```

## Step 2: Verify Commands Appear in Discord

1. Open Discord and go to your test server
2. Click in any text channel
3. Type `/` (forward slash)
4. You should see your bot's commands in the menu:
   - 📊 **/stock** - Get stock price, 30-day trend, and AI-powered news summary
   - ℹ️ **/help** - Show bot usage instructions, rate limits, and data sources

**If commands don't appear:**
- Wait a few minutes and refresh Discord (Ctrl+R or Cmd+R)
- For global commands, wait up to 1 hour
- Check that bot has "applications.commands" scope in OAuth2 URL
- Re-run the registration script to verify it succeeded

## Step 3: Deploy Worker (Before Commands Work)

⚠️ **IMPORTANT**: The commands are now registered with Discord, but they won't work yet because your Cloudflare Worker isn't deployed.

You have two options for testing:

### Option A: Local Development (Advanced)

You can test locally using `wrangler dev` with a tool like `ngrok` to expose your local server:

1. Start wrangler: `wrangler dev`
2. In another terminal, start ngrok: `ngrok http 8787`
3. Copy the ngrok HTTPS URL
4. Go to Discord Developer Portal → General Information
5. Set **Interactions Endpoint URL** to your ngrok URL
6. Test commands in Discord

**Limitations:**
- Requires ngrok or similar tunneling tool
- KV storage won't work without creating local namespaces
- API keys need to be in `.dev.vars`

### Option B: Deploy to Production (Recommended)

Follow the deployment steps in Phase 8 of your todo.md:

1. Get API keys (Massive.com, Perplexity)
2. Create KV namespaces
3. Deploy worker: `wrangler deploy`
4. Set Discord Interactions Endpoint URL to your worker URL
5. Test commands!

## Step 4: Test /help Command

Once deployed:

1. In Discord, type `/help`
2. Press Enter

**Expected Result:**
- Bot responds with a rich embed
- Shows available commands
- Shows rate limit information (1 query per minute)
- Shows data sources (Massive.com)
- Response is visible to everyone (not ephemeral)

## Step 5: Test /stock Command - Happy Path

1. Type `/stock AAPL`
2. Press Enter
3. Wait 1-3 seconds

**Expected Result:**
- Bot responds with a rich embed containing:
  - **Company Name**: Apple Inc.
  - **Current Price**: $XXX.XX (+X.X%)
  - **Color**: Green (positive), Red (negative), or Gray (neutral)
  - **30-Day Trend**: ASCII sparkline chart (▁▂▃▅▆▇█)
  - **Start/End Values**: $XXX.XX → $XXX.XX
  - **AI Summary**: 2-4 sentence news summary
  - **Footer**: Data sources and timestamp

**Try different tickers:**
- `/stock NET` - Cloudflare
- `/stock GOOGL` - Google
- `/stock MSFT` - Microsoft
- `/stock TSLA` - Tesla

## Step 6: Test /stock Command - Error Handling

### Invalid Ticker

1. Type `/stock INVALIDTICKER`
2. Press Enter

**Expected Result:**
- Error message appears (only you can see it - ephemeral)
- Message says "Ticker 'INVALIDTICKER' not found"
- May include suggestions for similar valid tickers

### Special Characters

Try: `/stock $AAPL`, `/stock AAPL!`, `/stock AAP L` (with space)

**Expected Result:**
- Validation error
- "Invalid ticker format" message
- Ephemeral (only you see it)

### Too Long

Try: `/stock VERYLONGTICKER123`

**Expected Result:**
- Validation error
- "Ticker must be 1-10 characters"

## Step 7: Test Rate Limiting

1. Type `/stock AAPL`
2. **Immediately** type `/stock NET` (within 60 seconds)
3. Watch for rate limit response

**Expected Result:**
- First command succeeds normally
- Second command gets:
  - ⏰ emoji reaction on your command
  - Ephemeral message: "You're querying too quickly! Please wait XX seconds."
  - Shows exact seconds remaining

4. Wait 60+ seconds
5. Try `/stock GOOGL` again

**Expected Result:**
- Command succeeds (rate limit reset)

## Step 8: Test Caching

1. Type `/stock MSFT` (first query)
2. Note the response time (~1-3 seconds)
3. Wait 10 seconds
4. Type `/stock MSFT` again (second query)

**Expected Result:**
- Second query is **much faster** (<1 second)
- Same data is returned
- Check Worker logs (`wrangler tail`) - should show "CACHE HIT"

## Step 9: Test Edge Cases

### Weekend Testing
- Query on Saturday or Sunday
- Should show last Friday's closing price
- Timestamp should indicate data age

### Market Hours vs After Hours
- Test during market hours (9:30 AM - 4:00 PM ET, Mon-Fri)
- Test after market close
- Bot always shows "Previous Close" price (not real-time intraday)

### Obscure Tickers
- Try less common stocks
- Some may not have recent news (AI summary might say "Limited news available")

### Concurrent Users (if possible)
- Have a friend query `/stock AAPL` at the same time as you
- Both should succeed
- Rate limits shouldn't interfere between users

## Step 10: Monitor Logs

While testing, keep logs open to see what's happening:

```bash
wrangler tail
```

**Look for:**
- `[INFO] Stock command received` - Command received
- `[INFO] Ticker validated` - Validation passed
- `[INFO] Rate limit passed` - Not rate limited
- `[CACHE HIT]` or `[CACHE MISS]` - Cache status
- `[INFO] Stock command completed successfully` - Success
- `[ERROR]` - Any errors (investigate these)

## Troubleshooting

### Commands don't appear in Discord
- Check bot has "applications.commands" scope
- Re-run registration script
- Wait up to 1 hour for global commands
- Use guild-specific registration for instant testing

### "Application did not respond" error
- Worker isn't deployed yet
- Interactions Endpoint URL not set in Discord
- Worker URL is incorrect
- Check worker logs for errors

### Worker crashes or times out
- Check API keys are correct
- Check KV namespaces are created
- Check wrangler.toml has correct namespace IDs
- Review worker logs for stack traces

### Partial data (no AI summary)
- Perplexity API key might be invalid
- Perplexity rate limits hit
- Network timeout (AI summary is non-critical)
- This is graceful degradation - stock data should still appear

### Rate limit not working
- Check RATE_LIMITS KV namespace exists
- Check namespace ID in wrangler.toml is correct
- KV operations might be failing (check logs)

### Cache not working
- Check CACHE KV namespace exists  
- Check namespace ID in wrangler.toml is correct
- First query will always be slow (cache miss)
- Subsequent queries within TTL should be fast

## Testing Checklist

Before considering the bot production-ready, verify:

- [ ] `/help` command returns correct information
- [ ] `/stock` command works for multiple tickers
- [ ] Rich embeds display with correct colors
- [ ] ASCII sparkline charts render properly
- [ ] AI summaries are 2-4 sentences
- [ ] Invalid tickers show helpful errors
- [ ] Errors are ephemeral (only visible to you)
- [ ] Rate limiting triggers after 1 query/min
- [ ] Rate limit messages show time remaining
- [ ] Cached queries are faster (<1 second)
- [ ] Worker logs show [INFO], [WARN], [ERROR] correctly
- [ ] No unexpected crashes or errors
- [ ] Bot works on weekends (shows Friday data)
- [ ] Bot handles multiple users simultaneously

## Next Steps

Once manual testing passes:

1. **Document any issues** you found in `todo.md`
2. **Update README.md** with production URLs and usage
3. **Monitor costs** for first week (Perplexity, Cloudflare)
4. **Gather user feedback** if sharing with others
5. **Plan improvements** from spec.md Future Enhancements

---

**Happy Testing! 🎉**

If you encounter any issues during testing, check the logs first, then review the specific component's test file to understand expected behavior.
