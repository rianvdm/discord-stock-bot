// ABOUTME: Tests for Discord embed builder utility
// ABOUTME: Validates rich embed formatting for stock data and help messages

import { describe, it, expect } from 'vitest';
import { getEmbedColor, buildStockEmbed, buildHelpEmbed } from '../../src/utils/embedBuilder.js';

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

  it('should include current price field with change', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const priceField = embed.fields.find(f => f.name.includes('Previous Close'));
    expect(priceField).toBeDefined();
    expect(priceField.value).toContain('$175.43');
    expect(priceField.value).toContain('2.30%'); // Formatted with 2 decimal places
  });

  it('should include 7-day trend field with chart', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const chartField = embed.fields.find(f => f.name.includes('Trend') || f.name.includes('7-Day'));
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

  it('should include footer with data source', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.footer).toBeDefined();
    expect(embed.footer.text).toContain('Massive.com');
  });

  it('should include timestamp', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    expect(embed.timestamp).toBeDefined();
    expect(typeof embed.timestamp).toBe('string');
  });

  it('should format positive change with + sign', () => {
    const embed = buildStockEmbed(mockStockData, mockChart, mockAiSummary, true);

    const priceField = embed.fields.find(f => f.name.includes('Previous Close'));
    expect(priceField.value).toMatch(/\+/);
  });

  it('should format negative change with - sign', () => {
    const negativeData = { 
      ...mockStockData, 
      changePercent: -2.3,
      changeAmount: -3.95
    };
    const embed = buildStockEmbed(negativeData, mockChart, mockAiSummary, true);

    const priceField = embed.fields.find(f => f.name.includes('Previous Close'));
    expect(priceField.value).toMatch(/-/);
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
    expect(text).toContain('Massive.com');
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
});
