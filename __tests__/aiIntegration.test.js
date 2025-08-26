/**
 * AI Integration Test
 * 
 * Test file to validate Claude Sonnet 4 integration
 */

// Mock expo-constants
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: null,
    manifest: null,
  }
}));

const { AI_CONFIG, getModelConfig } = require('../src/config/aiConfig.cjs');

describe('Claude Sonnet 4 Integration', () => {
  test('AI config should have Claude Sonnet 4 model', () => {
    expect(AI_CONFIG.claude.model).toBe('claude-3-5-sonnet-20241022');
    expect(AI_CONFIG.default.provider).toBe('claude');
  });

  test('getModelConfig should return correct configuration', () => {
    const config = getModelConfig('claude');
    expect(config.model).toBe('claude-3-5-sonnet-20241022');
    expect(config.provider).toBe('claude');
    expect(config.maxTokens).toBe(4096);
  });

  test('Model configuration is properly set up', () => {
    const claudeConfig = AI_CONFIG.claude;
    expect(claudeConfig.apiUrl).toBe('https://api.anthropic.com/v1/messages');
    expect(claudeConfig.apiVersion).toBe('2023-06-01');
    expect(claudeConfig.temperature).toBe(0.7);
  });
});

describe('AI Features Configuration', () => {
  test('Features should be properly configured', () => {
    expect(AI_CONFIG.features.textGeneration).toBe(true);
    expect(AI_CONFIG.features.dataAnalysis).toBe(true);
    expect(AI_CONFIG.features.chatAssistant).toBe(true);
    expect(AI_CONFIG.features.numberPrediction).toBe(false); // Disabled by default
  });

  test('getModelConfig should throw error for unknown provider', () => {
    expect(() => getModelConfig('unknown')).toThrow('Unknown AI provider: unknown');
  });
});