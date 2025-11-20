// ABOUTME: Centralized error handling for Discord bot interactions
// ABOUTME: Formats errors for users and logs details for developers

/**
 * Custom error class for bot-specific errors
 */
export class BotError extends Error {
  /**
   * @param {string} type - Error type from ErrorTypes
   * @param {string} message - Error message
   * @param {Array<string>|null} suggestions - Optional suggestions for user
   * @param {Object|null} metadata - Optional metadata for logging
   */
  constructor(type, message, suggestions = null, metadata = null) {
    super(message);
    this.name = 'BotError';
    this.type = type;
    this.suggestions = suggestions;
    this.metadata = metadata;
  }
}

/**
 * Error type constants
 */
export const ErrorTypes = {
  INVALID_INPUT: 'INVALID_INPUT',
  RATE_LIMIT: 'RATE_LIMIT',
  API_FAILURE: 'API_FAILURE',
  PARTIAL_FAILURE: 'PARTIAL_FAILURE',
  NOT_FOUND: 'NOT_FOUND',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Formats an error into a Discord interaction response
 * All error responses are ephemeral (only visible to the user)
 * 
 * @param {Error|BotError} error - The error to format
 * @returns {Object} Discord interaction response object
 */
export function formatErrorResponse(error) {
  let userMessage = '';
  
  if (error instanceof BotError) {
    switch (error.type) {
      case ErrorTypes.INVALID_INPUT:
        userMessage = `❌ **Invalid Input**\n${error.message}`;
        if (error.suggestions && error.suggestions.length > 0) {
          userMessage += `\n\n💡 **Suggestions:** ${error.suggestions.join(', ')}`;
        }
        break;
        
      case ErrorTypes.RATE_LIMIT:
        userMessage = `⏰ **Slow Down!**\n${error.message}`;
        if (error.metadata && error.metadata.timeRemaining) {
          userMessage = `⏰ **Slow Down!**\nYou're querying too quickly! Please wait ${error.metadata.timeRemaining} seconds before trying again.`;
        }
        break;
        
      case ErrorTypes.NOT_FOUND:
        userMessage = `🔍 **Not Found**\n${error.message}`;
        if (error.suggestions && error.suggestions.length > 0) {
          userMessage += `\n\n💡 **Did you mean:** ${error.suggestions.join(', ')}`;
        } else {
          userMessage += `\n\n💡 **Tip:** Use valid stock ticker symbols like:\n• **AAPL** (Apple)\n• **GOOGL** (Google)\n• **MSFT** (Microsoft)\n• **NET** (Cloudflare)\n• **TSLA** (Tesla)`;
        }
        break;
        
      case ErrorTypes.API_FAILURE:
        userMessage = `⚠️ **Service Unavailable**\nUnable to fetch stock data. Please try again later.`;
        break;
        
      case ErrorTypes.PARTIAL_FAILURE:
        userMessage = `⚠️ **Partial Data**\n${error.message}`;
        break;
        
      case ErrorTypes.UNKNOWN:
      default:
        userMessage = `❌ **Unexpected Error**\nSomething went wrong. Please try again later.`;
        break;
    }
  } else {
    // Generic Error object
    userMessage = `❌ **Unexpected Error**\nSomething went wrong. Please try again later.`;
  }
  
  return {
    type: 4, // Interaction response type: CHANNEL_MESSAGE_WITH_SOURCE
    data: {
      content: userMessage,
      flags: 64, // Ephemeral flag - only visible to user
    },
  };
}

/**
 * Logs an error with context for debugging
 * 
 * @param {Error|BotError} error - The error to log
 * @param {Object} context - Additional context (ticker, userId, etc.)
 */
export function logError(error, context = {}) {
  const timestamp = new Date().toISOString();
  
  if (error instanceof BotError) {
    const logData = {
      type: error.type,
      message: error.message,
      context,
      timestamp,
    };
    
    if (error.suggestions) {
      logData.suggestions = error.suggestions;
    }
    
    if (error.metadata) {
      logData.metadata = error.metadata;
    }
    
    console.error(`[ERROR] ${error.type}`, logData);
  } else {
    // Generic Error
    console.error(`[ERROR] ${ErrorTypes.UNKNOWN}`, {
      type: ErrorTypes.UNKNOWN,
      message: error.message,
      context,
      timestamp,
    });
  }
}
