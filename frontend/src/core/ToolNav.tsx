import React from 'react';
import type { ToolDefinition } from './pluginRegistry';

interface ToolNavProps {
  tools: ToolDefinition[];
  active: string;
  onSelect: (name: string) => void;
}

/**
 * 工具导航：左侧一列品牌实色块。
 * 当前工具整块填充该工具的品牌色，并同时给出「当前」文字标记，
 * 位置状态不只靠颜色表达。
 */
export const ToolNav: React.FC<ToolNavProps> = ({ tools, active, onSelect }) => (
  <nav className="ink-nav" aria-label="研究工具">
    <p className="ink-kicker ink-nav__head">工作台</p>
    {tools.map((tool, index) => {
      const isActive = tool.name === active;
      return (
        <button
          key={tool.name}
          type="button"
          data-tool={tool.name}
          className="ink-tile dn-interactive dn-rise"
          style={{ ['--dn-enter-index' as string]: String(index) }}
          aria-current={isActive ? 'page' : undefined}
          onClick={() => onSelect(tool.name)}
        >
          <span className="ink-kicker">
            {String(index + 1).padStart(2, '0')} · {tool.kicker}
          </span>
          <span className="ink-tile__label">{tool.displayName}</span>
          <span className="ink-tile__here">当前工具</span>
        </button>
      );
    })}
  </nav>
);
