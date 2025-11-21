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
 * Formats a sparkline chart with price labels including start, end, low, and high
 * @param {number[]} prices - Array of numeric price values
 * @returns {string} Multi-line string with sparkline, start→end price labels, and low/high range
 */
export function formatChartWithLabels(prices) {
  const sparkline = generateSparkline(prices);
  
  const startPrice = prices.length > 0 ? prices[0] : 0;
  const endPrice = prices.length > 0 ? prices[prices.length - 1] : 0;
  const lowPrice = prices.length > 0 ? Math.min(...prices) : 0;
  const highPrice = prices.length > 0 ? Math.max(...prices) : 0;
  
  const formatPrice = (price) => {
    const absPrice = Math.abs(price);
    const formatted = absPrice.toFixed(2);
    return price < 0 ? `-$${formatted}` : `$${formatted}`;
  };

  // Create aligned price labels matching sparkline width
  const startLabel = formatPrice(startPrice);
  const endLabel = formatPrice(endPrice);
  const sparklineLength = sparkline.length;
  
  // Left-align start price, right-align end price
  let priceLine;
  if (sparklineLength === 0) {
    // Handle empty sparkline case
    priceLine = startLabel;
  } else {
    const totalLabelLength = startLabel.length + endLabel.length;
    if (totalLabelLength >= sparklineLength) {
      // Labels are too long for sparkline, just separate with a space
      priceLine = startLabel + ' ' + endLabel;
    } else {
      // Pad to match sparkline length
      const paddingNeeded = sparklineLength - totalLabelLength;
      priceLine = startLabel + ' '.repeat(paddingNeeded) + endLabel;
    }
  }

  return `${sparkline}\n${priceLine}\nLow: ${formatPrice(lowPrice)} • High: ${formatPrice(highPrice)}`;
}
