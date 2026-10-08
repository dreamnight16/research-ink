import React from 'react';
import type { Classification } from '../core/types';

interface Props {
  classification: Classification;
  onChange?: (c: Classification) => void;
  readonly?: boolean;
}

/**
 * 数据级别标记。级别用「级 3 / 级 2 / 级 1」文字 + 色条左侧标记同时表达，
 * 不依赖颜色单独传达状态。
 */
const LEVELS: Record<Classification, { tier: string; label: string; tone: string }> = {
  secret: { tier: '级 3', label: '机密', tone: 'error' },
  cautious: { tier: '级 2', label: '审慎', tone: 'warn' },
  public: { tier: '级 1', label: '公开', tone: 'ok' },
};

export const SecurityBadge: React.FC<Props> = ({ classification, onChange, readonly }) => {
  const level = LEVELS[classification];

  if (readonly) {
    return (
      <span className="ink-flag" data-tone={level.tone}>
        <span className="ink-sr">数据级别</span>
        <span aria-hidden="true">{level.tier}</span>
        <span>{level.label}</span>
      </span>
    );
  }

  return (
    <select
      className="ink-select ink-select--flag"
      data-tone={level.tone}
      aria-label="数据级别"
      value={classification}
      onChange={(e) => onChange?.(e.target.value as Classification)}
    >
      <option value="secret">级 3 · 机密</option>
      <option value="cautious">级 2 · 审慎</option>
      <option value="public">级 1 · 公开</option>
    </select>
  );
};
