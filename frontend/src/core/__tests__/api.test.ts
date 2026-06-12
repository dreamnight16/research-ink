import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResolve(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

describe('api', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('health returns status', async () => {
    mockFetch.mockReturnValueOnce(mockResolve({ status: 'healthy', checks: {} }));
    const result = await api.health();
    expect(result.status).toBe('healthy');
  });

  it('plugins calls correct endpoint', async () => {
    mockFetch.mockReturnValueOnce(mockResolve([{ name: 'lit', display_name: 'Literature' }]));
    const result = await api.plugins();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/plugins',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('classify sends POST with correct body', async () => {
    mockFetch.mockReturnValueOnce(mockResolve({ status: 'ok' }));
    await api.classify('doc-1', 'secret');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/security/classify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ doc_id: 'doc-1', level: 'secret' }),
      }),
    );
  });

  it('allowCloud calls correct endpoint', async () => {
    mockFetch.mockReturnValueOnce(mockResolve({ allowed: true }));
    const result = await api.allowCloud('doc-1');
    expect(result.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/security/allow-cloud/doc-1',
      expect.any(Object),
    );
  });

  it('chat sends messages with classification', async () => {
    mockFetch.mockReturnValueOnce(mockResolve({ content: 'Hello!' }));
    const result = await api.chat(
      [{ role: 'user', content: 'Hi' }],
      'public',
      'chat-1',
    );
    expect(result.content).toBe('Hello!');
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.classification).toBe('public');
    expect(body.doc_id).toBe('chat-1');
  });

  it('searchKnowledge sends collection and query', async () => {
    mockFetch.mockReturnValueOnce(mockResolve({ results: [['id1']] }));
    await api.searchKnowledge('papers', 'deep learning', 3);
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.collection).toBe('papers');
    expect(body.query).toBe('deep learning');
    expect(body.n).toBe(3);
  });
});
