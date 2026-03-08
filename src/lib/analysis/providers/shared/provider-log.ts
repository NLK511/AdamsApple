const isLoggingEnabled = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export const providerLog = (...args: unknown[]) => {
  if (isLoggingEnabled) {
    console.log('[providers]', ...args);
  }
};
