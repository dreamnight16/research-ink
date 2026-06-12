import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Classification } from '../core/types';

const STORAGE_KEY = 'yanmo-chat-messages';

function loadMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveMessages(msgs: ChatMessage[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-100)));
  } catch { /* quota exceeded, silently drop */ }
}

export const ChatWindow: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadMessages);
  const [input, setInput] = useState('');
  const [classification, setClassification] = useState<Classification>('cautious');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateMessages = (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
    setMessages((prev) => {
      const next = updater(prev);
      saveMessages(next);
      return next;
    });
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: 'user', content: input };
    updateMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          classification,
          doc_id: `chat-${Date.now()}`,
        }),
      });
      const data = await res.json();
      updateMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
    } catch (e) {
      updateMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `唔，出了一点问题：${(e as Error).message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>—</span>
          <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>
            问一问
          </span>
        </div>
        <select
          value={classification}
          onChange={(e) => setClassification(e.target.value as Classification)}
          style={{
            fontSize: 11,
            padding: '4px 8px',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-input)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          <option value="cautious">审慎</option>
          <option value="public">公开</option>
        </select>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '32px 16px',
            color: 'var(--text-muted)',
            fontSize: 13,
            lineHeight: 1.7,
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>—</div>
            <div>有什么想聊的？</div>
            <div style={{ fontSize: 11, marginTop: 4 }}>研究思路、文献问题、公式疑问...</div>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} style={{
              display: 'flex',
              justifyContent: isUser ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%',
                padding: '10px 14px',
                borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: isUser ? 'var(--accent-light)' : 'var(--bg-card)',
                border: isUser ? 'none' : '1px solid var(--border-light)',
                color: 'var(--text-primary)',
                fontSize: 13,
                lineHeight: 1.55,
                boxShadow: isUser ? 'none' : 'var(--shadow-sm)',
              }}>
                {m.content}
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '10px 14px',
              borderRadius: '16px 16px 16px 4px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-light)',
              fontSize: 13,
              color: 'var(--text-muted)',
            }}>
              思考中...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 14px',
        borderTop: '1px solid var(--border-light)',
        display: 'flex',
        gap: 8,
      }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="说点什么..."
          style={{
            flex: 1,
            padding: '10px 14px',
            border: '1px solid var(--border)',
            borderRadius: '20px',
            fontSize: 13,
            background: 'var(--bg-input)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: loading ? 'var(--border)' : 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            cursor: loading ? 'default' : 'pointer',
            fontSize: 14,
            transition: 'all var(--transition)',
            opacity: loading || !input.trim() ? 0.5 : 1,
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
};
