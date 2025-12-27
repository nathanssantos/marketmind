import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/conversationSummarization', () => ({
  summarizeConversation: vi.fn(() => ({
    summary: 'Test summary',
    recentMessages: [],
    totalMessagesSummarized: 10,
  })),
}));

describe('conversation.worker', () => {
  const mockPostMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { self: { postMessage: typeof mockPostMessage; onmessage: null } }).self = {
      postMessage: mockPostMessage,
      onmessage: null,
    };
  });

  it('should return unsummarized messages when count is below threshold', async () => {
    await import('./conversation.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    const messages = Array(10).fill({ role: 'user', content: 'test' });
    handler({ data: { type: 'summarize', messages } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'summaryResult',
      summary: '',
      recentMessages: messages,
      totalMessagesSummarized: 0,
    });
  });

  it('should summarize when message count exceeds threshold', async () => {
    vi.resetModules();
    await import('./conversation.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    const messages = Array(20).fill({ role: 'user', content: 'test' });
    handler({ data: { type: 'summarize', messages } } as MessageEvent);
    expect(mockPostMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'summaryResult' }));
  });

  it('should ignore messages with wrong type', async () => {
    vi.resetModules();
    await import('./conversation.worker');
    const handler = (globalThis as unknown as { self: { onmessage: (e: MessageEvent) => void } }).self.onmessage;
    handler({ data: { type: 'wrongType', messages: [] } } as MessageEvent);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });
});
