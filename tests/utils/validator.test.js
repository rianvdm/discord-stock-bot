// ABOUTME: Test suite for ticker validator utility
// ABOUTME: Verifies ticker validation rules: 1-10 letters, uppercase, trimmed

import { describe, it, expect } from 'vitest';
import { validateTicker } from '../../src/utils/validator.js';

describe('validateTicker', () => {
  describe('Valid tickers', () => {
    it('should accept valid uppercase tickers', () => {
      const result1 = validateTicker('AAPL');
      expect(result1.valid).toBe(true);
      expect(result1.ticker).toBe('AAPL');
      expect(result1.error).toBeNull();

      const result2 = validateTicker('GOOGL');
      expect(result2.valid).toBe(true);
      expect(result2.ticker).toBe('GOOGL');
      expect(result2.error).toBeNull();

      const result3 = validateTicker('NET');
      expect(result3.valid).toBe(true);
      expect(result3.ticker).toBe('NET');
      expect(result3.error).toBeNull();
    });

    it('should accept single letter tickers', () => {
      const result = validateTicker('F');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('F');
      expect(result.error).toBeNull();
    });

    it('should accept 10 character tickers (max length)', () => {
      const result = validateTicker('ABCDEFGHIJ');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('ABCDEFGHIJ');
      expect(result.error).toBeNull();
    });
  });

  describe('Lowercase conversion', () => {
    it('should convert lowercase to uppercase', () => {
      const result = validateTicker('aapl');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('AAPL');
      expect(result.error).toBeNull();
    });

    it('should convert mixed case to uppercase', () => {
      const result = validateTicker('GoOgL');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('GOOGL');
      expect(result.error).toBeNull();
    });
  });

  describe('Whitespace trimming', () => {
    it('should trim leading whitespace', () => {
      const result = validateTicker('  AAPL');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('AAPL');
      expect(result.error).toBeNull();
    });

    it('should trim trailing whitespace', () => {
      const result = validateTicker('AAPL  ');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('AAPL');
      expect(result.error).toBeNull();
    });

    it('should trim leading and trailing whitespace', () => {
      const result = validateTicker('  AAPL  ');
      expect(result.valid).toBe(true);
      expect(result.ticker).toBe('AAPL');
      expect(result.error).toBeNull();
    });
  });

  describe('Invalid tickers - empty/null', () => {
    it('should reject empty string', () => {
      const result = validateTicker('');
      expect(result.valid).toBe(false);
      expect(result.ticker).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace only', () => {
      const result = validateTicker('   ');
      expect(result.valid).toBe(false);
      expect(result.ticker).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject null', () => {
      const result = validateTicker(null);
      expect(result.valid).toBe(false);
      expect(result.ticker).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject undefined', () => {
      const result = validateTicker(undefined);
      expect(result.valid).toBe(false);
      expect(result.ticker).toBe('');
      expect(result.error).toContain('empty');
    });
  });

  describe('Invalid tickers - numbers', () => {
    it('should reject pure numbers', () => {
      const result = validateTicker('12345');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers with numbers mixed in', () => {
      const result = validateTicker('AAPL1');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers starting with numbers', () => {
      const result = validateTicker('1AAPL');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });
  });

  describe('Invalid tickers - special characters', () => {
    it('should reject tickers with dashes', () => {
      const result = validateTicker('AAPL-B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers with dots', () => {
      const result = validateTicker('BRK.A');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers with underscores', () => {
      const result = validateTicker('AAPL_TEST');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers with spaces in the middle', () => {
      const result = validateTicker('AA PL');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject tickers with special symbols', () => {
      const result = validateTicker('AAPL@');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });
  });

  describe('Invalid tickers - length', () => {
    it('should reject tickers longer than 10 characters', () => {
      const result = validateTicker('ABCDEFGHIJK');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1-10 letters');
    });

    it('should reject very long tickers', () => {
      const result = validateTicker('THISISTOOLONGFORATICKER');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('1-10 letters');
    });
  });

  describe('Edge cases', () => {
    it('should handle non-string input gracefully', () => {
      const result = validateTicker(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle object input gracefully', () => {
      const result = validateTicker({ ticker: 'AAPL' });
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should handle array input gracefully', () => {
      const result = validateTicker(['AAPL']);
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('Return value structure', () => {
    it('should always return an object with valid, ticker, and error properties', () => {
      const result = validateTicker('AAPL');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('ticker');
      expect(result).toHaveProperty('error');
    });

    it('should have error as null for valid tickers', () => {
      const result = validateTicker('AAPL');
      expect(result.error).toBeNull();
    });

    it('should have error as string for invalid tickers', () => {
      const result = validateTicker('123');
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    });
  });
});
