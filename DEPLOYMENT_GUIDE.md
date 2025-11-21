M# Discord Stock Bot - Deployment Guide

This guide will get your bot deployed and working in Discord within 15-30 minutes.

## ✅ Pre-Deployment Checklist

Before starting, make sure you have:
- [x] Cloudflare account (logged in via `wrangler whoami`)
- [x] KV namespaces created (already in wrangler.toml)
- [x] Discord bot created with credentials (BOT_TOKEN, PUBLIC_KEY, APP_ID)
- [ ] Massive.com API key
- [ ] Perplexity API key

---

## Step 1: Get Massive.com API Key

Massive.com (formerly Polygon.io) provides stock market data.

1. **Sign up**: Go to https://massive.com/
2. **Create account**: Use your email
3. **Free tier**: You'll get 5 API calls per minute (sufficient for testing)
4. **Get API key**: 
   - Go to Dashboard → API Keys
   - Copy your API key (starts with something like "pk_...")
   - Save it somewhere secure

**Cost**: Free tier is sufficient for small servers

---

## Step 2: Get Perplexity API Key

Perplexity provides the AI-powered news summaries with web search.

1. **Sign up**: Go to https://www.perplexity.ai/
2. **Create account** or log in
3. **Set up billing**: 
   - Go to Settings → Billing
   - Add a payment method
   - Set a spending limit (recommend $5-10/month for testing)
4. **Create API key**:
   - Go to Settings → API
   - Create new API key
   - Name it "Discord Stock Bot"
   - Copy the key (starts with "pplx-...")
   - **IMPORTANT**: Save it immediately - you can't view it again!

**Cost**: Estimated $0.005-0.01 per request with SONAR model
- Small server (< 100 users): ~$3-10/month
- Cache reduces costs significantly

---

## Step 3: Set Cloudflare Worker Secrets

Now we'll securely store all API keys in Cloudflare.

**You need 4 secrets:**
1. `DISCORD_BOT_TOKEN` - From Discord Developer Portal (Phase 0)
2. `DISCORD_PUBLIC_KEY` - From Discord Developer Portal (Phase 0)
3. `MASSIVE_API_KEY` - From Massive.com (Step 1 above)
4. `PERPLEXITY_API_KEY` - From Perplexity (Step 2 above)

**Run these commands one at a time:**

```bash
# Navigate to project directory
cd /Users/rian/Documents/GitHub/discord-stock-bot

# Set Discord Bot Token
wrangler secret put DISCORD_BOT_TOKEN
# When prompted, paste your Discord bot token and press Enter

# Set Discord Public Key
wrangler secret put DISCORD_PUBLIC_KEY
# When prompted, paste your Discord public key and press Enter

# Set Massive.com API Key
wrangler secret put MASSIVE_API_KEY
# When prompted, paste your Massive.com API key and press Enter

# Set Perplexity API Key
wrangler secret put PERPLEXITY_API_KEY
# When prompted, paste your Perplexity API key and press Enter
```

**Expected output for each:**
```
🌀 Creating the secret for the Worker "discord-stock-bot"
✨ Success! Uploaded secret DISCORD_BOT_TOKEN
```

⚠️ **Security Note**: These secrets are encrypted and never visible in logs or code.

---

## Step 4: Deploy to Cloudflare

Now deploy your Worker:

```bash
wrangler deploy
```

**Expected output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded discord-stock-bot (X.XX sec)
Published discord-stock-bot (X.XX sec)
  https://discord-stock-bot.<your-subdomain>.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

**✅ Copy your Worker URL!** You'll need it in the next step.

Example: `https://discord-stock-bot.your-subdomain.workers.dev`

---

## Step 5: Configure Discord Interactions Endpoint

Tell Discord where to send slash command requests:

1. Go to https://discord.com/developers/applications
2. Select your bot application
3. Click **"General Information"** in left sidebar
4. Find **"INTERACTIONS ENDPOINT URL"**
5. Paste your Worker URL from Step 4
6. Click **"Save Changes"**

**What happens next:**
- Discord will send a **PING** request to verify your endpoint
- Your Worker will respond with **PONG**
- If successful, you'll see a green checkmark ✅

**If verification fails:**
- Check your Worker URL is correct (no typos)
- Run `wrangler tail` to see error logs
- Make sure `DISCORD_PUBLIC_KEY` secret is correct
- Common issue: Wrong public key causes signature verification to fail

---

## Step 6: Register Slash Commands

Register the `/stock` and `/help` commands with Discord:

### Get Your Guild ID

1. Open Discord
2. Settings → Advanced → Enable **Developer Mode**
3. Right-click your test server → **Copy Server ID**
4. Save this Guild ID

### Run Registration Script

For **instant testing** (guild-specific):

```bash
DISCORD_BOT_TOKEN=your_bot_token \
DISCORD_APP_ID=your_app_id \
GUILD_ID=your_guild_id \
node scripts/register-commands.js
```

Replace:
- `your_bot_token` - Your Discord bot token
- `your_app_id` - Your Discord application ID  
- `your_guild_id` - Your test server ID (from above)

**Expected output:**
```
✅ Successfully registered commands to guild!
   Commands are available immediately in your test server.
```

---

## Step 7: Test Your Bot! 🎉

Your bot is now live! Let's test it:

### Test 1: /help Command

1. Open Discord
2. Go to your test server
3. Type `/help`
4. Press Enter

**Expected**: Help embed with bot information appears

### Test 2: /stock Command

1. Type `/stock AAPL`
2. Press Enter
3. Wait 1-3 seconds

**Expected**: 
- Rich embed with stock price
- ASCII sparkline chart
- AI-generated news summary
- Green/red/gray color based on price change

### Test 3: Rate Limiting

1. Type `/stock NET`
2. Immediately type `/stock GOOGL` (within 30 seconds)

**Expected**:
- First command succeeds
- Second command shows rate limit error
- ⏰ emoji appears
- Message says "wait XX seconds"

### Test 4: Error Handling

1. Type `/stock INVALIDTICKER`

**Expected**:
- Error message appears (only you see it)
- Suggests valid tickers or format

---

## Step 8: Monitor Your Deployment

### Watch Logs in Real-Time

```bash
wrangler tail
```

Then test commands in Discord and watch the logs flow:
- `[INFO]` - Normal operations
- `[WARN]` - Non-critical issues (cache miss, AI summary failed)
- `[ERROR]` - Problems that need attention

### Check Cloudflare Dashboard

1. Go to https://dash.cloudflare.com/
2. Navigate to Workers & Pages
3. Click on "discord-stock-bot"
4. View metrics:
   - Request count
   - Error rate
   - Response times
   - Invocation duration

### Check KV Storage

1. In Cloudflare dashboard
2. Go to Workers & Pages → KV
3. Check your namespaces:
   - **RATE_LIMITS**: Should have entries like `ratelimit:user123`
   - **CACHE**: Should have entries like `stock:price:AAPL`

---

## Troubleshooting

### "Application did not respond"

**Cause**: Worker isn't receiving requests or timing out
**Fix**:
- Check Interactions Endpoint URL is correct
- Run `wrangler tail` to see errors
- Verify all 4 secrets are set: `wrangler secret list`

### "Invalid signature"

**Cause**: Wrong `DISCORD_PUBLIC_KEY`
**Fix**:
- Verify public key in Discord Developer Portal
- Re-run: `wrangler secret put DISCORD_PUBLIC_KEY`
- Redeploy: `wrangler deploy`

### "Failed to fetch stock data"

**Cause**: Invalid Massive.com API key or rate limit
**Fix**:
- Check API key at https://massive.com/dashboard
- Verify key is set: `wrangler secret list`
- Check if you hit free tier limit (5 calls/min)

### "AI summary unavailable"

**Cause**: Perplexity API issue or rate limit
**Fix**:
- Check Perplexity billing is set up
- Verify API key at https://www.perplexity.ai/settings/api
- Check you haven't exceeded spending limit
- Note: Bot still works, just without AI summary

### Commands don't appear in Discord

**Cause**: Commands not registered or wrong scope
**Fix**:
- Re-run registration script
- Check bot has "applications.commands" scope
- Try removing and re-adding bot to server with correct OAuth URL

---

## Post-Deployment Checklist

- [ ] `/help` command works
- [ ] `/stock AAPL` returns data with chart
- [ ] ASCII sparkline displays correctly
- [ ] AI summary appears (2-4 sentences)
- [ ] Colors match price direction (green up, red down)
- [ ] Rate limiting works (1 query/min/user)
- [ ] Invalid tickers show helpful errors
- [ ] Errors are ephemeral (only visible to you)
- [ ] Worker logs show no unexpected errors
- [ ] KV namespaces have data
- [ ] Response times acceptable (<3s uncached, <1s cached)

---

## Cost Monitoring

### Set Up Billing Alerts

**Cloudflare:**
- Workers free tier: 100,000 requests/day
- KV free tier: 100,000 reads/day, 1,000 writes/day
- You're very unlikely to exceed this

**Perplexity:**
1. Go to https://www.perplexity.ai/settings/billing
2. Set usage limits (e.g., $10/month)
3. Monitor usage regularly

**Massive.com:**
- Free tier: 5 calls/minute
- Bot caching should keep you well within limits
- Upgrade to paid tier only if needed

### Monitor Daily (First Week)

- Check Perplexity usage: https://www.perplexity.ai/settings/api
- Check Cloudflare metrics in dashboard
- Review costs daily for first week
- Adjust caching if needed

**Expected costs:**
- Very small server: $0-5/month
- Small server (<100 users): $3-15/month
- Mostly from Perplexity, Cloudflare likely stays free

---

## Success! 🎉

Your Discord Stock Bot is now live and running!

**What's working:**
- ✅ Bot responds to `/stock` with real-time data
- ✅ 30-day trend charts (ASCII sparklines)
- ✅ AI-powered news summaries
- ✅ Rate limiting prevents abuse
- ✅ Smart caching reduces API costs
- ✅ Error handling provides helpful messages

**Next steps:**
- Monitor usage and costs
- Gather user feedback
- Consider adding features from spec.md
- Update README.md with your production URLs
- Share with friends or make public!

---

## Rollback Plan

If something goes wrong:

```bash
# Disable bot temporarily
# Option 1: Remove Interactions Endpoint URL in Discord Portal

# Option 2: Rollback to previous version
wrangler rollback

# Option 3: Delete the worker
wrangler delete discord-stock-bot
```

---

## Support & Resources

- **Cloudflare Workers Docs**: https://developers.cloudflare.com/workers/
- **Discord Developer Docs**: https://discord.com/developers/docs
- **Massive.com API Docs**: https://massive.com/docs
- **Perplexity API Docs**: https://docs.perplexity.ai/

**Your bot files:**
- Logs: `wrangler tail`
- Config: `wrangler.toml`
- Secrets: Managed via `wrangler secret`
- Dashboard: https://dash.cloudflare.com/

Good luck! 🚀
