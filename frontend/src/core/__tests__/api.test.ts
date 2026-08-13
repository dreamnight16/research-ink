import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockResolve(data: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(data) });
}

describe('api', () => {
  let nextResponse: unknown;

  beforeEach(() => {
    mockFetch.mockReset();
    nextResponse = undefined;
    // The token endpoint is fetched first (and cached); everything else returns
    // the per-test `nextResponse`.
    mockFetch.mockImplementation((url: unknown) => {
      if (String(url).endsWith('/auth/token')) {
        return mockResolve({ token: 'test-token' });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(nextResponse) });
    });
  });

  it('health returns status and attaches Authorization header', async () => {
    nextResponse = { status: 'healthy', checks: {} };
    const result = await api.health();
    expect(result.status).toBe('healthy');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('plugins calls correct endpoint', async () => {
    nextResponse = [{ name: 'lit', display_name: 'Literature' }];
    const result = await api.plugins();
    expect(result).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/plugins',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('classify sends POST with correct body and Authorization', async () => {
    nextResponse = { status: 'ok' };
    await api.classify('doc-1', 'secret');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/security/classify',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ doc_id: 'doc-1', level: 'secret' }),
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );
  });

  it('allowCloud calls correct endpoint', async () => {
    nextResponse = { allowed: true };
    const result = await api.allowCloud('doc-1');
    expect(result.allowed).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8000/api/security/allow-cloud/doc-1',
      expect.any(Object),
    );
  });

  it('chat sends messages with classification', async () => {
    nextResponse = { content: 'Hello!' };
    const result = await api.chat(
      [{ role: 'user', content: 'Hi' }],
      'public',
      'chat-1',
    );
    expect(result.content).toBe('Hello!');
    const callArgs = mockFetch.mock.calls.find(
      ([url]) => String(url).endsWith('/chat'),
    );
    const body = JSON.parse(callArgs[1].body);
    expect(body.classification).toBe('public');
    expect(body.doc_id).toBe('chat-1');
  });

  it('searchKnowledge sends collection and query', async () => {
    nextResponse = { results: [['id1']] };
    await api.searchKnowledge('papers', 'deep learning', 3);
    const callArgs = mockFetch.mock.calls.find(
      ([url]) => String(url).endsWith('/knowledge/search'),
    );
    const body = JSON.parse(callArgs[1].body);
    expect(body.collection).toBe('papers');
    expect(body.query).toBe('deep learning');
    expect(body.n).toBe(3);
  });
});
