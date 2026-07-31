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

  // Generic HTTP helpers
  get: <T>(path: string) => request<T>(path),

  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  del: (path: string) =>
    request<{ success: boolean }>(path, { method: 'DELETE' }),

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

    createExperiment: (projectId: string, data: Record<string, unknown>) =>
      request<{ success: boolean; data: unknown }>(
        `/project-lab/projects/${projectId}/experiments`,
        { method: 'POST', body: JSON.stringify(data) },
      ),

    updateExperiment: (
      projectId: string,
      experimentId: string,
      data: Record<string, unknown>,
    ) =>
      request<{ success: boolean; data: unknown }>(
        `/project-lab/projects/${projectId}/experiments/${experimentId}`,
        { method: 'PUT', body: JSON.stringify(data) },
      ),

    deleteExperiment: (projectId: string, experimentId: string) =>
      request<{ success: boolean }>(
        `/project-lab/projects/${projectId}/experiments/${experimentId}`,
        { method: 'DELETE' },
      ),

    listVersions: (entityType: string, entityId: string) =>
      request<{ success: boolean; data: unknown[] }>(
        `/project-lab/versions?entity_type=${encodeURIComponent(
          entityType,
        )}&entity_id=${encodeURIComponent(entityId)}`,
      ),

    createCheckpoint: (data: {
      entity_type: string;
      entity_id: string;
      label: string;
    }) =>
      request<{ success: boolean; data: unknown }>('/project-lab/versions', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    rollbackVersion: (versionId: string) =>
      request<{ success: boolean; data: unknown }>(
        `/project-lab/versions/${versionId}/rollback`,
        { method: 'POST' },
      ),
  },
};
