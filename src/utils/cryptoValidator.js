// ABOUTME: Cryptocurrency symbol validation utility
// ABOUTME: Maps common crypto names to exchange pairs (e.g., BTC -> X:BTCUSD) and validates format

/**
 * Mapping of common crypto symbols to their Polygon.io format (X:CRYPTOUSD)
 */
const CRYPTO_MAPPINGS = {
  // Major cryptocurrencies
  'BTC': 'X:BTCUSD',
  'BITCOIN': 'X:BTCUSD',
  'ETH': 'X:ETHUSD',
  'ETHEREUM': 'X:ETHUSD',
  'USDT': 'X:USDTUSD',
  'TETHER': 'X:USDTUSD',
  'BNB': 'X:BNBUSD',
  'BINANCE': 'X:BNBUSD',
  'SOL': 'X:SOLUSD',
  'SOLANA': 'X:SOLUSD',
  'XRP': 'X:XRPUSD',
  'RIPPLE': 'X:XRPUSD',
  'USDC': 'X:USDCUSD',
  'ADA': 'X:ADAUSD',
  'CARDANO': 'X:ADAUSD',
  'AVAX': 'X:AVAXUSD',
  'AVALANCHE': 'X:AVAXUSD',
  'DOGE': 'X:DOGEUSD',
  'DOGECOIN': 'X:DOGEUSD',
  'DOT': 'X:DOTUSD',
  'POLKADOT': 'X:DOTUSD',
  'TRX': 'X:TRXUSD',
  'TRON': 'X:TRXUSD',
  'MATIC': 'X:MATICUSD',
  'POLYGON': 'X:MATICUSD',
  'LTC': 'X:LTCUSD',
  'LITECOIN': 'X:LTCUSD',
  'SHIB': 'X:SHIBUSD',
  'SHIBA': 'X:SHIBUSD',
  'UNI': 'X:UNIUSD',
  'UNISWAP': 'X:UNIUSD',
  'LINK': 'X:LINKUSD',
  'CHAINLINK': 'X:LINKUSD',
  'ATOM': 'X:ATOMUSD',
  'COSMOS': 'X:ATOMUSD',
  'XLM': 'X:XLMUSD',
  'STELLAR': 'X:XLMUSD',
  'BCH': 'X:BCHUSD',
  'BITCOINCASH': 'X:BCHUSD',
  'ETC': 'X:ETCUSD',
  'ETHEREUMCLASSIC': 'X:ETCUSD',
};

/**
 * List of popular crypto symbols for suggestions
 */
const POPULAR_CRYPTOS = [
  'BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'XRP', 'ADA', 
  'DOGE', 'MATIC', 'LTC', 'DOT', 'UNI', 'LINK'
];

/**
 * Validates a cryptocurrency symbol and converts it to Polygon.io format
 * @param {any} symbol - The crypto symbol to validate (e.g., 'BTC', 'BITCOIN')
 * @returns {{ valid: boolean, symbol: string, polygonTicker: string, error: string|null }} Validation result
 */
export function validateCrypto(symbol) {
  // Handle null, undefined, and non-string types
  if (symbol === null || symbol === undefined) {
    return {
      valid: false,
      symbol: '',
      polygonTicker: '',
      error: 'Crypto symbol cannot be empty'
    };
  }

  // Convert to string and handle non-string types
  if (typeof symbol !== 'string') {
    return {
      valid: false,
      symbol: '',
      polygonTicker: '',
      error: 'Crypto symbol must be a string'
    };
  }

  // Trim whitespace and convert to uppercase
  let cleanedSymbol = symbol.trim().toUpperCase();

  // Check if empty after trimming
  if (cleanedSymbol.length === 0) {
    return {
      valid: false,
      symbol: '',
      polygonTicker: '',
      error: 'Crypto symbol cannot be empty'
    };
  }

  // Check if it's already in X:SYMBOL format
  if (cleanedSymbol.startsWith('X:')) {
    // Validate the format X:CRYPTOUSD
    const cryptoPattern = /^X:[A-Z]+USD$/;
    if (cryptoPattern.test(cleanedSymbol)) {
      return {
        valid: true,
        symbol: cleanedSymbol.substring(2).replace('USD', ''), // Extract just the crypto symbol
        polygonTicker: cleanedSymbol,
        error: null
      };
    } else {
      return {
        valid: false,
        symbol: cleanedSymbol,
        polygonTicker: '',
        error: 'Invalid crypto pair format. Use format like X:BTCUSD or just BTC'
      };
    }
  }

  // Look up in mappings
  const polygonTicker = CRYPTO_MAPPINGS[cleanedSymbol];
  if (polygonTicker) {
    return {
      valid: true,
      symbol: cleanedSymbol,
      polygonTicker: polygonTicker,
      error: null
    };
  }

  // If symbol ends with USD, try to construct the pair
  if (cleanedSymbol.endsWith('USD')) {
    const cryptoSymbol = cleanedSymbol.replace('USD', '');
    if (cryptoSymbol.length >= 2 && cryptoSymbol.length <= 10) {
      return {
        valid: true,
        symbol: cryptoSymbol,
        polygonTicker: `X:${cryptoSymbol}USD`,
        error: null
      };
    }
  }

  // Check length (2-10 characters for crypto symbols)
  if (cleanedSymbol.length < 2 || cleanedSymbol.length > 10) {
    return {
      valid: false,
      symbol: cleanedSymbol,
      polygonTicker: '',
      error: 'Crypto symbol must be 2-10 characters'
    };
  }

  // Check if contains only letters (A-Z)
  const lettersOnlyRegex = /^[A-Z]+$/;
  if (!lettersOnlyRegex.test(cleanedSymbol)) {
    return {
      valid: false,
      symbol: cleanedSymbol,
      polygonTicker: '',
      error: 'Crypto symbol must contain letters only'
    };
  }

  // Assume it's a valid crypto symbol and construct the pair
  return {
    valid: true,
    symbol: cleanedSymbol,
    polygonTicker: `X:${cleanedSymbol}USD`,
    error: null
  };
}

/**
 * Suggest alternative crypto symbols for potential typos
 * @param {string} symbol - User-entered crypto symbol
 * @returns {string[]} Array of suggested crypto symbols
 */
export function suggestCryptos(symbol) {
  if (!symbol || symbol.length === 0) {
    return POPULAR_CRYPTOS.slice(0, 5);
  }

  const upperSymbol = symbol.toUpperCase().replace('X:', '').replace('USD', '');
  const suggestions = new Set();

  // Check for exact match in mappings
  if (CRYPTO_MAPPINGS[upperSymbol]) {
    suggestions.add(upperSymbol);
  }

  // Check for partial matches in popular cryptos
  if (upperSymbol.length >= 2) {
    for (const crypto of POPULAR_CRYPTOS) {
      // Starts with the input
      if (crypto.startsWith(upperSymbol)) {
        suggestions.add(crypto);
      }
      // Input starts with the crypto (e.g., "BITCOIN" -> "BTC")
      else if (upperSymbol.startsWith(crypto)) {
        suggestions.add(crypto);
      }
    }
  }

  // Check full names
  for (const [name, ticker] of Object.entries(CRYPTO_MAPPINGS)) {
    if (name.includes(upperSymbol) || upperSymbol.includes(name)) {
      const cryptoSymbol = ticker.replace('X:', '').replace('USD', '');
      suggestions.add(cryptoSymbol);
    }
  }

  // Limit to 5 suggestions
  return Array.from(suggestions).slice(0, 5);
}

/**
 * Get the display name for a crypto symbol
 * @param {string} symbol - Crypto symbol (e.g., 'BTC')
 * @returns {string} Display name (e.g., 'Bitcoin')
 */
export function getCryptoDisplayName(symbol) {
  const upperSymbol = symbol.toUpperCase().replace('X:', '').replace('USD', '');
  
  const nameMap = {
    'BTC': 'Bitcoin',
    'ETH': 'Ethereum',
    'USDT': 'Tether',
    'BNB': 'Binance Coin',
    'SOL': 'Solana',
    'XRP': 'Ripple',
    'USDC': 'USD Coin',
    'ADA': 'Cardano',
    'AVAX': 'Avalanche',
    'DOGE': 'Dogecoin',
    'DOT': 'Polkadot',
    'TRX': 'Tron',
    'MATIC': 'Polygon',
    'LTC': 'Litecoin',
    'SHIB': 'Shiba Inu',
    'UNI': 'Uniswap',
    'LINK': 'Chainlink',
    'ATOM': 'Cosmos',
    'XLM': 'Stellar',
    'BCH': 'Bitcoin Cash',
    'ETC': 'Ethereum Classic',
  };

  return nameMap[upperSymbol] || upperSymbol;
}
