import type { ChatMessage, Classification } from './types';

const BACKEND = 'http://127.0.0.1:8000';
const BASE = `${BACKEND}/api`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`${res.status}: ${err}`);
  }
  return res.json();
}

export const api = {
  health: () => request<{ status: string }>('/health'),

  plugins: () => request<{ name: string; display_name: string }[]>('/plugins'),

  classify: (docId: string, level: Classification) =>
    request('/security/classify', {
      method: 'POST',
      body: JSON.stringify({ doc_id: docId, level }),
    }),

  allowCloud: (docId: string) =>
    request<{ allowed: boolean }>(`/security/allow-cloud/${docId}`),

  chat: (messages: ChatMessage[], classification: Classification, docId: string) =>
    request<{ content: string }>('/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, classification, doc_id: docId }),
    }),

  searchKnowledge: (collection: string, query: string, n = 5) =>
    request<{ results: string[][] }>('/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({ collection, query, n }),
    }),

  // Project Lab
  projectLab: {
    listProjects: () =>
      request<{ success: boolean; data: unknown[] }>('/project-lab/projects'),

    createProject: (data: { title: string }) =>
      request<{ success: boolean; data: unknown }>('/project-lab/projects', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getProject: (id: string) =>
      request<{ success: boolean; data: unknown }>(`/project-lab/projects/${id}`),
  },
};
