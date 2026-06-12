import React, { useState } from 'react';
import { TabBar } from './TabBar';
import { SidePanel } from './SidePanel';
import { allPlugins } from './pluginRegistry';
import { ChatWindow } from '../shared/ChatWindow';
import { Settings } from '../shared/Settings';

const TABS = [
  { key: 'term-advisor', label: '读懂导师' },
  { key: 'literature', label: '追新论文' },
  { key: 'evaluator', label: '审项目' },
  { key: 'formula', label: '验公式' },
  { key: 'paper-writer', label: '写论文' },
];

const EMOJIS = ['☕', '', '', '', '', ''];

export const Workbench: React.FC = () => {
  const [activeTab, setActiveTab] = useState('term-advisor');
  const [showSettings, setShowSettings] = useState(false);
  const [greeting] = useState(() => {
    const hour = new Date().getHours();
    if (hour < 7) return '夜深了，注意休息';
    if (hour < 12) return '早上好，今天也是充实的一天';
    if (hour < 14) return '中午好，别忘记吃午饭';
    if (hour < 18) return '下午好，来杯咖啡吧';
    return '晚上好，今天辛苦了';
  });

  const plugins = allPlugins();
  const activePlugin = plugins.find((p) => p.name === activeTab);
  const ActiveComponent = activePlugin?.component
    ?? (() => <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>插件未安装</div>);

  const tabEmoji = EMOJIS[TABS.findIndex((t) => t.key === activeTab)] || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{
        padding: '14px 24px',
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        flexShrink: 0,
      }}>
        <span style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-serif)',
          letterSpacing: '0.03em',
        }}>
          研墨
        </span>
        <span style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-sans)',
        }}>
          {greeting}
        </span>
        <div style={{ flex: 1 }} />
        <button
          onClick={() => setShowSettings(!showSettings)}
          title="设置"
          style={{
            background: showSettings ? 'var(--accent-soft)' : 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-sm)',
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--text-secondary)',
            transition: 'all var(--transition)',
          }}
        >
          设置
        </button>
      </header>

      {/* Tab bar */}
      <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {showSettings ? (
          <main style={{
            flex: 1, overflow: 'auto', padding: 28,
            background: 'var(--bg-base)',
          }}>
            <Settings />
          </main>
        ) : (
          <>
            <main style={{
              flex: 1, overflow: 'auto', padding: 28,
              background: 'var(--bg-base)',
            }}>
              <div style={{
                fontSize: 13, color: 'var(--text-muted)',
                marginBottom: 20, display: 'flex',
                alignItems: 'center', gap: 6,
              }}>
                <span>{tabEmoji}</span>
                <span>{TABS.find((t) => t.key === activeTab)?.label}</span>
              </div>
              <ActiveComponent />
            </main>
            <SidePanel>
              <ChatWindow />
            </SidePanel>
          </>
        )}
      </div>
    </div>
  );
};
