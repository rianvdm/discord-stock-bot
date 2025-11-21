// ABOUTME: Test suite for crypto validator utility
// ABOUTME: Verifies crypto symbol validation and Polygon.io ticker conversion

import { describe, it, expect } from 'vitest';
import { validateCrypto, suggestCryptos, getCryptoDisplayName } from '../../src/utils/cryptoValidator.js';

describe('validateCrypto', () => {
  describe('Valid crypto symbols', () => {
    it('should accept common crypto symbols', () => {
      const result1 = validateCrypto('BTC');
      expect(result1.valid).toBe(true);
      expect(result1.symbol).toBe('BTC');
      expect(result1.polygonTicker).toBe('X:BTCUSD');
      expect(result1.error).toBeNull();

      const result2 = validateCrypto('ETH');
      expect(result2.valid).toBe(true);
      expect(result2.symbol).toBe('ETH');
      expect(result2.polygonTicker).toBe('X:ETHUSD');
      expect(result2.error).toBeNull();

      const result3 = validateCrypto('DOGE');
      expect(result3.valid).toBe(true);
      expect(result3.symbol).toBe('DOGE');
      expect(result3.polygonTicker).toBe('X:DOGEUSD');
      expect(result3.error).toBeNull();
    });

    it('should accept full crypto names', () => {
      const result1 = validateCrypto('BITCOIN');
      expect(result1.valid).toBe(true);
      expect(result1.symbol).toBe('BITCOIN');
      expect(result1.polygonTicker).toBe('X:BTCUSD');
      expect(result1.error).toBeNull();

      const result2 = validateCrypto('ETHEREUM');
      expect(result2.valid).toBe(true);
      expect(result2.symbol).toBe('ETHEREUM');
      expect(result2.polygonTicker).toBe('X:ETHUSD');
      expect(result2.error).toBeNull();
    });

    it('should accept X:CRYPTOUSD format', () => {
      const result = validateCrypto('X:BTCUSD');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });

    it('should accept CRYPTOUSD format', () => {
      const result = validateCrypto('BTCUSD');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });

    it('should accept unknown crypto symbols', () => {
      const result = validateCrypto('XYZ');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('XYZ');
      expect(result.polygonTicker).toBe('X:XYZUSD');
      expect(result.error).toBeNull();
    });
  });

  describe('Lowercase conversion', () => {
    it('should convert lowercase to uppercase', () => {
      const result = validateCrypto('btc');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });

    it('should convert mixed case to uppercase', () => {
      const result = validateCrypto('EtH');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('ETH');
      expect(result.polygonTicker).toBe('X:ETHUSD');
      expect(result.error).toBeNull();
    });
  });

  describe('Whitespace trimming', () => {
    it('should trim leading whitespace', () => {
      const result = validateCrypto('  BTC');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });

    it('should trim trailing whitespace', () => {
      const result = validateCrypto('BTC  ');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });

    it('should trim leading and trailing whitespace', () => {
      const result = validateCrypto('  BTC  ');
      expect(result.valid).toBe(true);
      expect(result.symbol).toBe('BTC');
      expect(result.polygonTicker).toBe('X:BTCUSD');
      expect(result.error).toBeNull();
    });
  });

  describe('Invalid crypto symbols - empty/null', () => {
    it('should reject empty string', () => {
      const result = validateCrypto('');
      expect(result.valid).toBe(false);
      expect(result.symbol).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject whitespace only', () => {
      const result = validateCrypto('   ');
      expect(result.valid).toBe(false);
      expect(result.symbol).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject null', () => {
      const result = validateCrypto(null);
      expect(result.valid).toBe(false);
      expect(result.symbol).toBe('');
      expect(result.error).toContain('empty');
    });

    it('should reject undefined', () => {
      const result = validateCrypto(undefined);
      expect(result.valid).toBe(false);
      expect(result.symbol).toBe('');
      expect(result.error).toContain('empty');
    });
  });

  describe('Invalid crypto symbols - non-string types', () => {
    it('should reject numbers', () => {
      const result = validateCrypto(123);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject objects', () => {
      const result = validateCrypto({ crypto: 'BTC' });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });

    it('should reject arrays', () => {
      const result = validateCrypto(['BTC']);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('string');
    });
  });

  describe('Invalid crypto symbols - too short', () => {
    it('should reject single character symbols', () => {
      const result = validateCrypto('B');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-10 characters');
    });
  });

  describe('Invalid crypto symbols - too long', () => {
    it('should reject symbols longer than 10 characters', () => {
      const result = validateCrypto('ABCDEFGHIJK');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('2-10 characters');
    });
  });

  describe('Invalid crypto symbols - special characters', () => {
    it('should reject symbols with numbers (except in X: format)', () => {
      const result = validateCrypto('BTC123');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject symbols with special characters', () => {
      const result = validateCrypto('BTC-ETH');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });

    it('should reject symbols with spaces', () => {
      const result = validateCrypto('BTC ETH');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('letters only');
    });
  });

  describe('Invalid X: format', () => {
    it('should reject malformed X: format', () => {
      const result = validateCrypto('X:BTC');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid crypto pair format');
    });

    it('should reject X: with non-USD pair', () => {
      const result = validateCrypto('X:BTCEUR');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid crypto pair format');
    });
  });
});

describe('suggestCryptos', () => {
  it('should return popular cryptos for empty input', () => {
    const suggestions = suggestCryptos('');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(5);
    expect(suggestions).toContain('BTC');
  });

  it('should suggest cryptos starting with input', () => {
    const suggestions = suggestCryptos('BT');
    expect(suggestions).toContain('BTC');
  });

  it('should limit suggestions to 5', () => {
    const suggestions = suggestCryptos('A');
    expect(suggestions.length).toBeLessThanOrEqual(5);
  });

  it('should handle uppercase input', () => {
    const suggestions = suggestCryptos('ETH');
    expect(suggestions).toContain('ETH');
  });

  it('should handle lowercase input', () => {
    const suggestions = suggestCryptos('eth');
    expect(suggestions).toContain('ETH');
  });
});

describe('getCryptoDisplayName', () => {
  it('should return display name for known cryptos', () => {
    expect(getCryptoDisplayName('BTC')).toBe('Bitcoin');
    expect(getCryptoDisplayName('ETH')).toBe('Ethereum');
    expect(getCryptoDisplayName('DOGE')).toBe('Dogecoin');
  });

  it('should handle lowercase input', () => {
    expect(getCryptoDisplayName('btc')).toBe('Bitcoin');
  });

  it('should handle X: prefix', () => {
    expect(getCryptoDisplayName('X:BTCUSD')).toBe('Bitcoin');
  });

  it('should handle USD suffix', () => {
    expect(getCryptoDisplayName('BTCUSD')).toBe('Bitcoin');
  });

  it('should return symbol for unknown cryptos', () => {
    expect(getCryptoDisplayName('XYZ')).toBe('XYZ');
  });
});
