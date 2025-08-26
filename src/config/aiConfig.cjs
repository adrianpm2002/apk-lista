/**
 * AI Model Configuration - CommonJS version for tests
 */

const AI_CONFIG = {
  // Claude Configuration
  claude: {
    model: 'claude-3-5-sonnet-20241022', // Claude Sonnet 4
    maxTokens: 4096,
    temperature: 0.7,
    apiUrl: 'https://api.anthropic.com/v1/messages',
    apiVersion: '2023-06-01',
  },
  
  // Default settings
  default: {
    provider: 'claude',
    timeout: 30000, // 30 seconds
    retries: 3,
  },
  
  // Feature flags
  features: {
    textGeneration: true,
    numberPrediction: false, // For future lottery prediction features
    dataAnalysis: true,
    chatAssistant: true,
  }
};

const getModelConfig = (provider = 'claude') => {
  const config = AI_CONFIG[provider];
  if (!config) {
    throw new Error(`Unknown AI provider: ${provider}`);
  }
  return { ...config, ...AI_CONFIG.default };
};

module.exports = { AI_CONFIG, getModelConfig };