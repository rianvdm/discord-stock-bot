// ABOUTME: Ticker validation utility for stock symbols
// ABOUTME: Ensures tickers are 1-10 letters only, uppercase, and properly formatted

/**
 * Validates a stock ticker symbol
 * @param {any} ticker - The ticker symbol to validate
 * @returns {{ valid: boolean, ticker: string, error: string|null }} Validation result
 */
export function validateTicker(ticker) {
  // Handle null, undefined, and non-string types
  if (ticker === null || ticker === undefined) {
    return {
      valid: false,
      ticker: '',
      error: 'Ticker cannot be empty'
    };
  }

  // Convert to string and handle non-string types
  if (typeof ticker !== 'string') {
    return {
      valid: false,
      ticker: '',
      error: 'Ticker must be a string'
    };
  }

  // Trim whitespace and convert to uppercase
  const cleanedTicker = ticker.trim().toUpperCase();

  // Check if empty after trimming
  if (cleanedTicker.length === 0) {
    return {
      valid: false,
      ticker: '',
      error: 'Ticker cannot be empty'
    };
  }

  // Check length (1-10 characters)
  if (cleanedTicker.length > 10) {
    return {
      valid: false,
      ticker: cleanedTicker,
      error: 'Ticker must be 1-10 letters only'
    };
  }

  // Check if contains only letters (A-Z)
  const lettersOnlyRegex = /^[A-Z]+$/;
  if (!lettersOnlyRegex.test(cleanedTicker)) {
    return {
      valid: false,
      ticker: cleanedTicker,
      error: 'Ticker must contain letters only (no numbers or special characters)'
    };
  }

  // All validation passed
  return {
    valid: true,
    ticker: cleanedTicker,
    error: null
  };
}
