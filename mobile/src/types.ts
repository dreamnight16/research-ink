// 与 frontend/src/core/types.ts 保持同步
export type Classification = 'secret' | 'cautious' | 'public';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}
