// ABOUTME: Tests for centralized error handling utility
// ABOUTME: Validates error classification, user messaging, and logging behavior

import { describe, it, expect, vi } from 'vitest';
import {
  BotError,
  ErrorTypes,
  formatErrorResponse,
  logError
} from '../../src/utils/errorHandler.js';

describe('BotError', () => {
  it('should create error with type and message', () => {
    const error = new BotError(ErrorTypes.INVALID_INPUT, 'Invalid ticker');
    
    expect(error).toBeInstanceOf(Error);
    expect(error.type).toBe(ErrorTypes.INVALID_INPUT);
    expect(error.message).toBe('Invalid ticker');
  });

  it('should create error with suggestions', () => {
    const error = new BotError(
      ErrorTypes.INVALID_INPUT,
      'Invalid ticker',
      ['AAPL', 'GOOGL']
    );
    
    expect(error.suggestions).toEqual(['AAPL', 'GOOGL']);
  });

  it('should create error with metadata', () => {
    const error = new BotError(
      ErrorTypes.API_FAILURE,
      'API timeout',
      null,
      { service: 'Finnhub', timeout: 10000 }
    );
    
    expect(error.metadata).toEqual({ service: 'Finnhub', timeout: 10000 });
  });
});

describe('ErrorTypes', () => {
  it('should have all required error types', () => {
    expect(ErrorTypes.INVALID_INPUT).toBeDefined();
    expect(ErrorTypes.RATE_LIMIT).toBeDefined();
    expect(ErrorTypes.API_FAILURE).toBeDefined();
    expect(ErrorTypes.PARTIAL_FAILURE).toBeDefined();
    expect(ErrorTypes.NOT_FOUND).toBeDefined();
    expect(ErrorTypes.UNKNOWN).toBeDefined();
  });
});

describe('formatErrorResponse', () => {
  it('should format INVALID_INPUT error with ephemeral flag', () => {
    const error = new BotError(ErrorTypes.INVALID_INPUT, 'Ticker must be 1-10 letters');
    const response = formatErrorResponse(error);
    
    expect(response.type).toBe(4);
    expect(response.data.flags).toBe(64); // Ephemeral flag
    expect(response.data.content).toContain('Ticker must be 1-10 letters');
  });

  it('should format RATE_LIMIT error with time remaining', () => {
    const error = new BotError(
      ErrorTypes.RATE_LIMIT,
      'Please wait 45 seconds',
      null,
      { timeRemaining: 45 }
    );
    const response = formatErrorResponse(error);
    
    expect(response.data.flags).toBe(64);
    expect(response.data.content).toContain('⏰');
    expect(response.data.content).toContain('45 seconds');
  });

  it('should format NOT_FOUND error with suggestions', () => {
    const error = new BotError(
      ErrorTypes.NOT_FOUND,
      'Ticker not found',
      ['AAPL', 'GOOGL']
    );
    const response = formatErrorResponse(error);
    
    expect(response.data.flags).toBe(64);
    expect(response.data.content).toContain('not found');
    expect(response.data.content).toContain('AAPL');
    expect(response.data.content).toContain('GOOGL');
  });

  it('should format API_FAILURE error without exposing internal details', () => {
    const error = new BotError(
      ErrorTypes.API_FAILURE,
      'Service temporarily unavailable',
      null,
      { stack: 'internal error stack', apiKey: 'secret' }
    );
    const response = formatErrorResponse(error);
    
    expect(response.data.flags).toBe(64);
    expect(response.data.content).not.toContain('stack');
    expect(response.data.content).not.toContain('secret');
    expect(response.data.content).toContain('Unable to fetch stock data');
  });

  it('should format PARTIAL_FAILURE error as warning', () => {
    const error = new BotError(
      ErrorTypes.PARTIAL_FAILURE,
      'AI summary unavailable',
      null,
      { service: 'OpenAI' }
    );
    const response = formatErrorResponse(error);
    
    expect(response.data.flags).toBe(64);
    expect(response.data.content).toContain('⚠️');
    expect(response.data.content).toContain('AI summary unavailable');
  });

  it('should format generic Error with UNKNOWN type', () => {
    const error = new Error('Internal database connection failed at line 42');
    const response = formatErrorResponse(error);
    
    expect(response.data.flags).toBe(64);
    expect(response.data.content).toContain('Unexpected Error');
    expect(response.data.content).not.toContain('database connection'); // Don't expose internal message
    expect(response.data.content).not.toContain('line 42'); // Don't expose internal details
  });

  it('should always return ephemeral responses', () => {
    const errorTypes = [
      new BotError(ErrorTypes.INVALID_INPUT, 'test'),
      new BotError(ErrorTypes.RATE_LIMIT, 'test'),
      new BotError(ErrorTypes.API_FAILURE, 'test'),
      new BotError(ErrorTypes.NOT_FOUND, 'test'),
      new BotError(ErrorTypes.PARTIAL_FAILURE, 'test'),
      new BotError(ErrorTypes.UNKNOWN, 'test'),
    ];
    
    errorTypes.forEach(error => {
      const response = formatErrorResponse(error);
      expect(response.data.flags).toBe(64); // All must be ephemeral
    });
  });

  it('should not include stack traces in user messages', () => {
    const error = new BotError(ErrorTypes.API_FAILURE, 'API error');
    error.stack = 'Error: API error\n    at Object.<anonymous>...';
    
    const response = formatErrorResponse(error);
    
    expect(response.data.content).not.toContain('Error:');
    expect(response.data.content).not.toContain('at Object');
    expect(response.data.content).not.toContain('stack');
  });
});

describe('logError', () => {
  it('should log error with type and context', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new BotError(ErrorTypes.API_FAILURE, 'Finnhub timeout');
    const context = { ticker: 'AAPL', userId: '123456' };
    
    logError(error, context);
    
    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[0]).toContain('[ERROR]');
    expect(logCall[0]).toContain(ErrorTypes.API_FAILURE);
    
    consoleSpy.mockRestore();
  });

  it('should log error message and context details', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new BotError(ErrorTypes.INVALID_INPUT, 'Invalid ticker format');
    const context = { ticker: '123!!', userId: '789' };
    
    logError(error, context);
    
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[1]).toEqual(expect.objectContaining({
      type: ErrorTypes.INVALID_INPUT,
      message: 'Invalid ticker format',
      context: context
    }));
    
    consoleSpy.mockRestore();
  });

  it('should log generic Error objects', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new Error('Unexpected error');
    const context = { operation: 'fetchData' };
    
    logError(error, context);
    
    expect(consoleSpy).toHaveBeenCalled();
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[0]).toContain('[ERROR]');
    expect(logCall[0]).toContain('UNKNOWN');
    
    consoleSpy.mockRestore();
  });

  it('should include timestamp in logs', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new BotError(ErrorTypes.RATE_LIMIT, 'Rate limited');
    logError(error, {});
    
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[1]).toHaveProperty('timestamp');
    expect(typeof logCall[1].timestamp).toBe('string');
    
    consoleSpy.mockRestore();
  });

  it('should include error metadata in logs if present', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new BotError(
      ErrorTypes.API_FAILURE,
      'Timeout',
      null,
      { service: 'Finnhub', duration: 10000 }
    );
    logError(error, { ticker: 'AAPL' });
    
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[1]).toHaveProperty('metadata');
    expect(logCall[1].metadata).toEqual({ service: 'Finnhub', duration: 10000 });
    
    consoleSpy.mockRestore();
  });

  it('should include suggestions in logs if present', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    const error = new BotError(
      ErrorTypes.NOT_FOUND,
      'Ticker not found',
      ['AAPL', 'GOOGL']
    );
    logError(error, { ticker: 'APPL' });
    
    const logCall = consoleSpy.mock.calls[0];
    expect(logCall[1]).toHaveProperty('suggestions');
    expect(logCall[1].suggestions).toEqual(['AAPL', 'GOOGL']);
    
    consoleSpy.mockRestore();
  });
});
