import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage, Classification } from '../core/types';
import { SecurityBadge } from './SecurityBadge';

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
  const logRef = useRef<HTMLDivElement>(null);

  // 只滚动消息框自身：scrollIntoView 会在窄屏上把整页一起滚动到对话栏
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

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
    <>
      <div className="ink-chat__head">
        <div>
          <p className="ink-kicker">Local Chat</p>
          <h2 className="ink-h3">问一问</h2>
        </div>
        <SecurityBadge classification={classification} onChange={setClassification} />
      </div>

      <div className="ink-chat__log" role="log" aria-live="polite" aria-label="对话记录" ref={logRef}>
        {messages.length === 0 && (
          <div className="ink-note">
            <p>有什么想聊的？研究思路、文献问题、公式疑问都可以。</p>
            <p className="ink-note--sm">
              请求发往本机 127.0.0.1:8000 的后端，不会直接发往第三方服务。
            </p>
          </div>
        )}
        {messages.map((m, i) => {
          const isUser = m.role === 'user';
          return (
            <div key={i} className="ink-chat__msg" data-role={isUser ? 'user' : 'assistant'}>
              <span className="ink-chat__who">{isUser ? '我' : '研墨'}</span>
              {m.content}
            </div>
          );
        })}
        {loading && (
          <div className="ink-chat__msg" data-role="assistant">
            <span className="ink-chat__who">研墨</span>
            正在生成回答…
          </div>
        )}
      </div>

      <div className="ink-chat__composer">
        <label className="ink-sr" htmlFor="chat-input">输入消息</label>
        <textarea
          id="chat-input"
          className="ink-textarea"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="说点什么…（Enter 发送，Shift+Enter 换行）"
        />
        <button
          type="button"
          className="ink-btn ink-btn--primary"
          onClick={send}
          disabled={loading || !input.trim()}
        >
          {loading ? '发送中' : '发送'}
        </button>
      </div>
    </>
  );
};
