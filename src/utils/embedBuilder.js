// ABOUTME: Discord embed builder for stock data and help messages
// ABOUTME: Formats rich embeds with colors, fields, and proper Discord structure

import { CONFIG } from '../config.js';

/**
 * Gets the appropriate embed color based on price change percentage
 * @param {number} changePercent - Percentage change in price
 * @returns {number} Hex color code for Discord embed
 */
export function getEmbedColor(changePercent) {
  if (changePercent > 0) {
    return CONFIG.EMBED_COLOR_POSITIVE; // Green
  } else if (changePercent < 0) {
    return CONFIG.EMBED_COLOR_NEGATIVE; // Red
  } else {
    return CONFIG.EMBED_COLOR_NEUTRAL; // Gray
  }
}

/**
 * Builds a rich embed for stock data
 * @param {Object} stockData - Stock price and company information
 * @param {string} chart - Formatted ASCII chart with labels
 * @param {string|null} aiSummary - AI-generated news summary (optional)
 * @param {boolean} marketOpen - Whether the market is currently open
 * @returns {Object} Discord embed object
 */
export function buildStockEmbed(stockData, chart, aiSummary, marketOpen) {
  const { 
    ticker, 
    companyName, 
    currentPrice, 
    changePercent, 
    changeAmount 
  } = stockData;

  const color = getEmbedColor(changePercent);
  
  // Format price change with + or - sign
  const changeSign = changePercent >= 0 ? '+' : '';
  const formattedChangeAmount = changeAmount >= 0 
    ? `+$${changeAmount.toFixed(2)}` 
    : `-$${Math.abs(changeAmount).toFixed(2)}`;
  const priceChange = `${formattedChangeAmount} (${changeSign}${changePercent.toFixed(2)}%)`;

  // Build fields array
  const fields = [
    {
      name: '💰 Previous Close',
      value: `**$${currentPrice.toFixed(2)}** ${priceChange}`,
      inline: false
    },
    {
      name: '📈 7-Day Trend',
      value: `\`\`\`\n${chart}\n\`\`\``,
      inline: false
    },
    {
      name: '🕐 Market Status',
      value: marketOpen ? '✅ Market Open' : '🔴 Market Closed (Last Close)',
      inline: false
    }
  ];

  // Add AI summary field (Discord limits field values to 1024 characters)
  if (aiSummary) {
    // Truncate summary if it exceeds Discord's limit
    const maxLength = 1020; // Leave room for ellipsis
    const truncatedSummary = aiSummary.length > maxLength 
      ? aiSummary.substring(0, maxLength) + '...'
      : aiSummary;
    
    fields.push({
      name: '📰 News & Sentiment',
      value: truncatedSummary,
      inline: false
    });
  } else {
    fields.push({
      name: '📰 News & Sentiment',
      value: '⚠️ AI summary unavailable',
      inline: false
    });
  }

  return {
    title: `📊 ${ticker} - ${companyName}`,
    color: color,
    fields: fields,
    footer: {
      text: 'Data: Massive.com • AI: OpenAI'
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Builds a help embed explaining bot usage
 * @returns {Object} Discord embed object
 */
export function buildHelpEmbed() {
  return {
    title: '📊 Stock Bot - Help',
    description: 'Get stock prices (previous close), trends, and AI-powered news summaries.',
    color: CONFIG.EMBED_COLOR_NEUTRAL,
    fields: [
      {
        name: '📌 Commands',
        value: '**`/stock <ticker>`** - Get stock information\n**`/help`** - Show this help message',
        inline: false
      },
      {
        name: '💡 Examples',
        value: '`/stock AAPL` - Apple Inc.\n`/stock NET` - Cloudflare\n`/stock GOOGL` - Google',
        inline: false
      },
      {
        name: '⏱️ Rate Limits',
        value: 'You can query **1 stock per minute** to keep the bot running smoothly.',
        inline: false
      },
      {
        name: '📊 Data Sources',
        value: '**Stock Data:** Massive.com (previous day close)\n**AI Summaries:** OpenAI with web search',
        inline: false
      },
      {
        name: '🔄 Data Freshness',
        value: 'Previous close prices cached 5 min\nCharts cached 1 hour\nNews summaries cached 8 hours',
        inline: false
      }
    ],
    footer: {
      text: 'Stock Bot • Built with Cloudflare Workers'
    },
    timestamp: new Date().toISOString()
  };
}
