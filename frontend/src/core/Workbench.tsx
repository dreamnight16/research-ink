import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ToolNav } from './ToolNav';
import { ChatRail } from './ChatRail';
import { allTools } from './pluginRegistry';
import { Settings } from '../shared/Settings';
import { useDetailLayer } from '../shared/useDetailLayer';

const HEALTH_URL = 'http://127.0.0.1:8000/api/health';

type HealthState = 'checking' | 'ok' | 'down';

const HEALTH_TEXT: Record<HealthState, { label: string; detail: string }> = {
  checking: { label: '正在检测本地后端', detail: '127.0.0.1:8000' },
  ok: { label: '本地后端已连接', detail: '127.0.0.1:8000' },
  down: { label: '本地后端未连接', detail: '各面板会显示为空或错误状态' },
};

/** 本地时钟问候语；不是实时数据，只反映本机时间 */
function greetingFor(hour: number): string {
  if (hour < 7) return '夜深了，注意休息';
  if (hour < 12) return '早上好，今天也是充实的一天';
  if (hour < 14) return '中午好，别忘记吃午饭';
  if (hour < 18) return '下午好，来杯咖啡吧';
  return '晚上好，今天辛苦了';
}

export const Workbench: React.FC = () => {
  const tools = allTools();
  const [activeTool, setActiveTool] = useState(tools[0]?.name ?? '');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [health, setHealth] = useState<HealthState>('checking');
  const [greeting] = useState(() => greetingFor(new Date().getHours()));

  const stageRef = useRef<HTMLDivElement | null>(null);
  const scrollByTool = useRef<Record<string, number>>({});
  const settingsLayer = useDetailLayer(settingsOpen, () => setSettingsOpen(false));

  const checkHealth = useCallback(async () => {
    setHealth('checking');
    try {
      const res = await fetch(HEALTH_URL);
      setHealth(res.ok ? 'ok' : 'down');
    } catch {
      setHealth('down');
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  // 切换工具时恢复该工具上次的滚动位置（空间连续性），而不是回到顶部
  useEffect(() => {
    const el = stageRef.current;
    if (el) el.scrollTop = scrollByTool.current[activeTool] ?? 0;
  }, [activeTool]);

  const rememberScroll = () => {
    const el = stageRef.current;
    if (el) scrollByTool.current[activeTool] = el.scrollTop;
  };

  const tool = tools.find((t) => t.name === activeTool);
  const ActivePanel = tool?.component;
  const healthText = HEALTH_TEXT[health];

  return (
    <div className="ink-shell" data-tool={tool?.name}>
      <header className="ink-bar">
        <div className="ink-brand">
          <span className="ink-brand__mark">研墨</span>
          <span className="ink-kicker ink-brand__en">ResearchInk · 本地研究助手</span>
        </div>
        <span className="ink-note ink-note--sm">{greeting}</span>
        <span className="ink-bar__spacer" />
        <button
          type="button"
          className="ink-health"
          data-state={health}
          onClick={checkHealth}
          title="重新检测本地后端"
        >
          <span className="ink-health__dot" aria-hidden="true" />
          <span>
            <strong>{healthText.label}</strong> · {healthText.detail}
          </span>
        </button>
        <button
          type="button"
          className="ink-btn ink-btn--ghost"
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(true)}
        >
          设置
        </button>
      </header>

      <ToolNav tools={tools} active={activeTool} onSelect={setActiveTool} />

      <main
        className="ink-stage"
        data-tool={tool?.name}
        ref={stageRef}
        onScroll={rememberScroll}
      >
        {tool && (
          <section className="ink-hero" aria-labelledby="tool-title">
            <div className="ink-hero__grid">
              <div>
                <p className="ink-kicker">{tool.kicker}</p>
                <h1 className="ink-h1 ink-hero__title" id="tool-title">
                  {tool.displayName}
                </h1>
                <p className="ink-hero__desc">{tool.tagline}</p>
              </div>
              <div className="ink-hero__side">
                <p className="ink-kicker">能力</p>
                {tool.facts.map((fact) => (
                  <p className="ink-fact" key={fact.label}>
                    <b>{fact.label}</b>
                    {fact.detail}
                  </p>
                ))}
              </div>
            </div>
          </section>
        )}
        <div className="ink-body">
          {ActivePanel ? (
            <ActivePanel />
          ) : (
            <div className="ink-empty">
              <p className="ink-empty__mark" aria-hidden="true">
                —
              </p>
              <p className="ink-h3">工具未注册</p>
              <p className="ink-note">该工具没有在 pluginRegistry 中注册，界面无法显示。</p>
            </div>
          )}
        </div>
      </main>

      <ChatRail />

      {settingsOpen && (
        <div
          className="ink-scrim"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSettingsOpen(false);
          }}
        >
          <div
            className="ink-drawer dn-acrylic"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-title"
            tabIndex={-1}
            ref={settingsLayer}
          >
            <Settings onClose={() => setSettingsOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
