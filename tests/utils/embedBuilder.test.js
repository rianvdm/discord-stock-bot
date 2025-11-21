// ABOUTME: Tests for Discord embed builder utility
// ABOUTME: Validates rich embed formatting for stock data, crypto data, and help messages

import { describe, it, expect } from 'vitest';
import { getEmbedColor, buildStockEmbed, buildCryptoEmbed, buildHelpEmbed } from '../../src/utils/embedBuilder.js';

describe('getEmbedColor', () => {
  it('should return green for positive price change', () => {
    const color = getEmbedColor(2.5);
    expect(color).toBe(0x00ff00); // Green
  });

  it('should return red for negative price change', () => {
    const color = getEmbedColor(-1.8);
    expect(color).toBe(0xff0000); // Red
  });

  it('should return gray for zero change', () => {
    const color = getEmbedColor(0);
    expect(color).toBe(0x808080); // Gray
  });

  it('should return gray for very small positive change', () => {
    const color = getEmbedColor(0.001);
    expect(color).toBe(0x00ff00); // Still positive, so green
  });

  it('should return red for very small negative change', () => {
    const color = getEmbedColor(-0.001);
    expect(color).toBe(0xff0000); // Still negative, so red
  });

  it('should return green for large positive change', () => {
    const color = getEmbedColor(15.7);
    expect(color).toBe(0x00ff00);
  });

  it('should return red for large negative change', () => {
    const color = getEmbedColor(-12.3);
    expect(color).toBe(0xff0000);
  });
});

describe('buildStockEmbed', () => {
  const mockStockData = {
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    currentPrice: 175.43,
    changePercent: 2.3,
    changeAmount: 3.95,
    high: 176.12,
    low: 174.21,
    previousClose: 171.48
  };

  const mockChart = '▁▃▅▆█\n$171.20 → $175.43';
  const mockAiSummary = 'Apple reported strong Q4 earnings exceeding expectations. The stock is showing positive momentum.';

  it('should create embed with all required fields', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed).toHaveProperty('title');
    expect(embed).toHaveProperty('color');
    expect(embed).toHaveProperty('fields');
    expect(embed).toHaveProperty('footer');
    expect(embed).toHaveProperty('timestamp');
  });

  it('should format title with ticker and company name', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.title).toContain('AAPL');
    expect(embed.title).toContain('Apple Inc.');
  });

  it('should set green color for positive change', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.color).toBe(0x00ff00);
  });

  it('should set red color for negative change', () => {
    const negativeData = { ...mockStockData, changePercent: -2.3 };
    const embed = buildStockEmbed(negativeData, mockChart, mockAiSummary, true);

    expect(embed.color).toBe(0xff0000);
  });

  it('should include price field with change', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, false);

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField).toBeDefined();
    expect(priceField.value).toContain('$175.43');
    expect(priceField.value).toContain('2.30%'); // Formatted with 2 decimal places
  });

  it('should include 30-day trend field with chart', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const chartField = embed.fields.find(f => f.name.includes('Trend') || f.name.includes('30-Day'));
    expect(chartField).toBeDefined();
    expect(chartField.value).toContain(mockChart);
  });

  it('should include AI summary field when provided', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const summaryField = embed.fields.find(f => f.name.includes('News') || f.name.includes('Summary'));
    expect(summaryField).toBeDefined();
    expect(summaryField.value).toContain(mockAiSummary);
  });

  it('should handle missing AI summary gracefully', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, null, true);

    const summaryField = embed.fields.find(f => f.name.includes('News') || f.name.includes('Summary'));
    expect(summaryField).toBeDefined();
    expect(summaryField.value).toContain('⚠️');
    expect(summaryField.value).toContain('unavailable');
  });

  it('should show market status when market is open', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const statusField = embed.fields.find(f => f.name.includes('Market'));
    expect(statusField).toBeDefined();
    expect(statusField.value).toMatch(/Market Open|Open/i);
  });

  it('should show last close when market is closed', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, false);

    const statusField = embed.fields.find(f => f.name.includes('Market'));
    expect(statusField).toBeDefined();
    expect(statusField.value).toMatch(/Last Close|Closed/i);
  });

  it('should include footer with data sources', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.footer).toBeDefined();
    expect(embed.footer.text).toContain('Finnhub');
    expect(embed.footer.text).toContain('Massive.com');
  });

  it('should include timestamp', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.timestamp).toBeDefined();
    expect(typeof embed.timestamp).toBe('string');
  });

  it('should format positive change with + sign', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, false);

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField.value).toMatch(/\+/);
  });

  it('should format negative change with - sign', () => {
    const negativeData = { 
      ...mockStockData, 
      changePercent: -2.3,
      changeAmount: -3.95
    };
    const embed = buildStockEmbed(negativeData, mockChart, mockAiSummary, false);

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField.value).toMatch(/-/);
  });

  it('should show "Previous Close" label when market is closed', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, false);

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField).toBeDefined();
    expect(priceField.name).toContain('Previous Close');
  });

  it('should show "Current Price" label when market is open', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const priceField = embed.fields.find(f => f.name.includes('💰'));
    expect(priceField).toBeDefined();
    expect(priceField.name).toContain('Current Price');
  });

  it('should always use provided price data (from Finnhub)', () => {
    // Price data is always from Finnhub regardless of market status
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const priceField = embed.fields.find(f => f.name.includes('Current Price'));
    expect(priceField).toBeDefined();
    expect(priceField.value).toContain('$175.43'); // Uses provided price data
    expect(priceField.value).toContain('2.30%'); // Uses provided change percent
  });
});

describe('buildHelpEmbed', () => {
  it('should create embed with title', () => {
    const embed = buildHelpEmbed();

    expect(embed).toHaveProperty('title');
    expect(embed.title).toMatch(/Stock Bot|Help/i);
  });

  it('should have description with usage info', () => {
    const embed = buildHelpEmbed();

    expect(embed).toHaveProperty('description');
    expect(embed.description).toBeTruthy();
  });

  it('should include commands information', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toContain('/stock');
    expect(text).toContain('/help');
  });

  it('should include rate limit information', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toMatch(/rate limit|1.*minute|60.*second/i);
  });

  it('should include data source attribution', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toContain('Finnhub');
    expect(text).toContain('Massive.com');
    expect(text).toContain('OpenAI');
  });

  it('should have neutral color', () => {
    const embed = buildHelpEmbed();

    expect(embed.color).toBe(0x808080); // Gray/neutral
  });

  it('should include example usage', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toMatch(/AAPL|NET|example/i);
  });

  it('should have fields or description', () => {
    const embed = buildHelpEmbed();

    expect(embed.fields || embed.description).toBeTruthy();
  });

  it('should include crypto command information', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toContain('/crypto');
  });

  it('should include crypto examples', () => {
    const embed = buildHelpEmbed();

    const text = JSON.stringify(embed);
    expect(text).toMatch(/BTC|ETH|Bitcoin/i);
  });
});

describe('buildCryptoEmbed', () => {
  const mockCryptoData = {
    symbol: 'BTC',
    name: 'Bitcoin',
    currentPrice: 42500.50,
    changePercent: 2.9,
    changeAmount: 1200.30,
    exchange: 'BINANCE'
  };

  const mockChart = '▁▃▅▆█\n$41,300 → $42,500';
  const mockAiSummary = 'Bitcoin surged past $42,000 amid institutional adoption news. Market sentiment remains bullish.';

  it('should create embed with all required fields', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    expect(embed).toHaveProperty('title');
    expect(embed).toHaveProperty('color');
    expect(embed).toHaveProperty('fields');
    expect(embed).toHaveProperty('footer');
    expect(embed).toHaveProperty('timestamp');
  });

  it('should format title with symbol and name', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    expect(embed.title).toContain('BTC');
    expect(embed.title).toContain('Bitcoin');
  });

  it('should set green color for positive change', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    expect(embed.color).toBe(0x00ff00);
  });

  it('should set red color for negative change', () => {
    const negativeData = { ...mockCryptoData, changePercent: -2.5, changeAmount: -1000.00 };
    const embed = buildCryptoEmbed(negativeData, mockChart, mockAiSummary);

    expect(embed.color).toBe(0xff0000);
  });

  it('should include price with change', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const priceField = embed.fields.find(f => f.name.includes('Price'));
    expect(priceField).toBeDefined();
    expect(priceField.value).toContain('42500.50');
    expect(priceField.value).toContain('2.9');
  });

  it('should include chart', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const chartField = embed.fields.find(f => f.name.includes('Trend'));
    expect(chartField).toBeDefined();
    expect(chartField.value).toContain(mockChart);
  });

  it('should indicate 24/7 trading', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const statusField = embed.fields.find(f => f.name.includes('Market Status'));
    expect(statusField).toBeDefined();
    expect(statusField.value).toContain('24/7');
  });

  it('should include exchange information', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const statusField = embed.fields.find(f => f.name.includes('Market Status'));
    expect(statusField.value).toContain('BINANCE');
  });

  it('should include AI summary when provided', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const summaryField = embed.fields.find(f => f.name.includes('News'));
    expect(summaryField).toBeDefined();
    expect(summaryField.value).toBe(mockAiSummary);
  });

  it('should handle missing AI summary', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, null);

    const summaryField = embed.fields.find(f => f.name.includes('News'));
    expect(summaryField).toBeDefined();
    expect(summaryField.value).toContain('unavailable');
  });

  it('should truncate long AI summaries', () => {
    const longSummary = 'A'.repeat(1100);
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, longSummary);

    const summaryField = embed.fields.find(f => f.name.includes('News'));
    expect(summaryField.value.length).toBeLessThanOrEqual(1024); // Discord limit
  });

  it('should format positive price change correctly', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    const priceField = embed.fields.find(f => f.name.includes('Price'));
    expect(priceField.value).toContain('+$1200.30');
    expect(priceField.value).toContain('+2.9');
  });

  it('should format negative price change correctly', () => {
    const negativeData = { ...mockCryptoData, changePercent: -3.2, changeAmount: -1400.50 };
    const embed = buildCryptoEmbed(negativeData, mockChart, mockAiSummary);

    const priceField = embed.fields.find(f => f.name.includes('Price'));
    expect(priceField.value).toContain('-$1400.50');
    expect(priceField.value).toContain('-3.2');
  });

  it('should include footer with data sources', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    expect(embed.footer).toBeDefined();
    expect(embed.footer.text).toContain('Finnhub');
    expect(embed.footer.text).toContain('Massive.com');
    expect(embed.footer.text).toContain('OpenAI');
  });

  it('should have valid timestamp', () => {
    const embed = buildCryptoEmbed(mockCryptoData, mockChart, mockAiSummary);

    expect(embed.timestamp).toBeDefined();
    expect(new Date(embed.timestamp).getTime()).not.toBeNaN();
  });
});
