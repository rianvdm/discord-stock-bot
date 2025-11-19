// ABOUTME: ASCII sparkline chart generator for stock price trends
// ABOUTME: Converts numeric price arrays into visual sparklines using Unicode block characters

const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];

/**
 * Generates an ASCII sparkline from an array of prices
 * @param {number[]} prices - Array of numeric price values
 * @returns {string} Sparkline string using Unicode block characters
 */
export function generateSparkline(prices) {
  if (!prices || prices.length === 0) {
    return '';
  }

  if (prices.length === 1) {
    return SPARKLINE_CHARS[SPARKLINE_CHARS.length - 1];
  }

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;

  // If all values are the same, return all max bars
  if (range === 0) {
    return SPARKLINE_CHARS[SPARKLINE_CHARS.length - 1].repeat(prices.length);
  }

  return prices
    .map(price => {
      const normalized = (price - min) / range;
      // Map to 0-7 range and round for better distribution
      const index = Math.min(
        Math.round(normalized * (SPARKLINE_CHARS.length - 1)),
        SPARKLINE_CHARS.length - 1
      );
      return SPARKLINE_CHARS[index];
    })
    .join('');
}

/**
 * Formats a sparkline chart with price labels
 * @param {number[]} prices - Array of numeric price values
 * @returns {string} Multi-line string with sparkline and start→end price labels
 */
export function formatChartWithLabels(prices) {
  const sparkline = generateSparkline(prices);
  
  const startPrice = prices.length > 0 ? prices[0] : 0;
  const endPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  
  const formatPrice = (price) => {
    const absPrice = Math.abs(price);
    const formatted = absPrice.toFixed(2);
    return price < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  return `${sparkline}\n${formatPrice(startPrice)} → ${formatPrice(endPrice)}`;
}
