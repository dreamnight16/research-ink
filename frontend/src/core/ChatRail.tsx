import React from 'react';
import { ChatWindow } from '../shared/ChatWindow';

/**
 * 右侧常驻对话栏。它是工作台的一部分，不是覆盖层，
 * 因此保持不透明表面，不使用 Acrylic。
 */
export const ChatRail: React.FC = () => (
  <aside className="ink-chat" aria-label="本地对话">
    <ChatWindow />
  </aside>
);
