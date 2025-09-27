// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: jest.fn(() => Promise.resolve({
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi'
    })),
    addEventListener: jest.fn(() => jest.fn())
  }
}));

// Silence console warnings during tests unless specifically testing them
const originalConsole = { ...console };
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};