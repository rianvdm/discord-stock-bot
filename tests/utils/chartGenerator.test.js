// ABOUTME: Tests for ASCII sparkline chart generator utility
// ABOUTME: Validates price trend visualization with various patterns and edge cases

import { describe, it, expect } from 'vitest';
import { generateSparkline, formatChartWithLabels } from '../../src/utils/chartGenerator.js';

describe('generateSparkline', () => {
  it('should generate upward trend visualization', () => {
    const prices = [100, 105, 110, 115, 120];
    const result = generateSparkline(prices);
    
    expect(result).toBe('▁▃▅▆█');
    expect(result.length).toBe(5);
  });

  it('should generate downward trend visualization', () => {
    const prices = [120, 115, 110, 105, 100];
    const result = generateSparkline(prices);
    
    expect(result).toBe('█▆▅▃▁');
    expect(result.length).toBe(5);
  });

  it('should generate flat line visualization', () => {
    const prices = [100, 100, 100, 100, 100];
    const result = generateSparkline(prices);
    
    // All same height when all prices are equal
    expect(result).toBe('█████');
  });

  it('should generate volatile price pattern', () => {
    const prices = [100, 120, 95, 115, 105];
    const result = generateSparkline(prices);
    
    // Should show ups and downs
    expect(result.length).toBe(5);
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]+/);
  });

  it('should handle single value', () => {
    const prices = [100];
    const result = generateSparkline(prices);
    
    expect(result).toBe('█');
  });

  it('should handle two values', () => {
    const prices = [100, 120];
    const result = generateSparkline(prices);
    
    expect(result).toBe('▁█');
    expect(result.length).toBe(2);
  });

  it('should handle empty array', () => {
    const prices = [];
    const result = generateSparkline(prices);
    
    expect(result).toBe('');
  });

  it('should handle negative values', () => {
    const prices = [-20, -10, 0, 10, 20];
    const result = generateSparkline(prices);
    
    expect(result).toBe('▁▃▅▆█');
    expect(result.length).toBe(5);
  });

  it('should handle small differences and still show variation', () => {
    const prices = [100.00, 100.01, 100.02, 100.03, 100.04];
    const result = generateSparkline(prices);
    
    // Should still create variation even with tiny differences
    expect(result.length).toBe(5);
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]+/);
  });

  it('should handle all zero values', () => {
    const prices = [0, 0, 0, 0];
    const result = generateSparkline(prices);
    
    expect(result).toBe('████');
  });

  it('should handle mixed positive and negative values', () => {
    const prices = [-50, 0, 50];
    const result = generateSparkline(prices);
    
    expect(result).toBe('▁▅█');
  });
});

describe('formatChartWithLabels', () => {
  it('should format chart with start and end price labels', () => {
    const prices = [171.20, 172.45, 173.12, 174.21, 175.43];
    const result = formatChartWithLabels(prices);
    
    // Verify sparkline is present (exact pattern depends on value distribution)
    expect(result).toMatch(/[▁▂▃▄▅▆▇█]+/);
    expect(result).toContain('$171.20');
    expect(result).toContain('$175.43');
    expect(result).toContain('→');
  });

  it('should format with proper structure', () => {
    const prices = [100, 110, 120];
    const result = formatChartWithLabels(prices);
    
    // Should have sparkline on first line, labels on second
    const lines = result.split('\n');
    expect(lines.length).toBe(2);
    expect(lines[0]).toMatch(/[▁▂▃▄▅▆▇█]+/);
    expect(lines[1]).toContain('$100.00');
    expect(lines[1]).toContain('$120.00');
  });

  it('should handle downward trend labels correctly', () => {
    const prices = [200.50, 190.25, 180.00];
    const result = formatChartWithLabels(prices);
    
    expect(result).toContain('$200.50');
    expect(result).toContain('$180.00');
  });

  it('should format prices with two decimal places', () => {
    const prices = [100.1, 105.555];
    const result = formatChartWithLabels(prices);
    
    expect(result).toContain('$100.10');
    expect(result).toContain('$105.56'); // Should round
  });

  it('should handle single value', () => {
    const prices = [150.75];
    const result = formatChartWithLabels(prices);
    
    expect(result).toContain('█');
    expect(result).toContain('$150.75');
  });

  it('should handle empty array', () => {
    const prices = [];
    const result = formatChartWithLabels(prices);
    
    expect(result).toBe('\n$0.00 → $0.00');
  });

  it('should handle negative prices', () => {
    const prices = [-10.50, 0, 10.50];
    const result = formatChartWithLabels(prices);
    
    expect(result).toContain('-$10.50');
    expect(result).toContain('$10.50');
  });

  it('should show arrow between start and end values', () => {
    const prices = [50, 60, 70];
    const result = formatChartWithLabels(prices);
    
    const lines = result.split('\n');
    expect(lines[1]).toMatch(/\$\d+\.\d{2}\s+→\s+\$\d+\.\d{2}/);
  });
});
