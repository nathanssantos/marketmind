import type { HttpAdapter, HttpOptions } from '../types';

export const createWebHttpAdapter = (): HttpAdapter => ({
  fetch: async (url: string, options?: HttpOptions) => {
    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      throw error instanceof Error ? error : new Error('HTTP request failed');
    }
  },
});
