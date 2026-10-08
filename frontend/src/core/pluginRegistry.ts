import type { ComponentType } from 'react';

/** 一条工具能力事实。只写产品真实具备的能力，不写动态数据。 */
export interface ToolFact {
  label: string;
  detail: string;
}

/**
 * 工具定义。名称、排版标签、一句话说明与能力事实都集中在这里，
 * 导航、标题色块与插件面板共用同一份数据，避免多处重复维护。
 */
export interface ToolDefinition {
  name: string;
  displayName: string;
  /** 英文大写标签，用 DNDL Kicker 排版表达 */
  kicker: string;
  /** 一句话说明这个工具实际做什么 */
  tagline: string;
  facts: ToolFact[];
  component: ComponentType;
}

const registry = new Map<string, ToolDefinition>();

export function registerTool(entry: ToolDefinition): void {
  registry.set(entry.name, entry);
}

/** 按注册顺序返回全部工具 */
export function allTools(): ToolDefinition[] {
  return Array.from(registry.values());
}
