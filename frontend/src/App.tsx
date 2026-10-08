import React from 'react';
import { Workbench } from './core/Workbench';
import { registerTool } from './core/pluginRegistry';
import { TermAdvisorPanel } from './plugins/term-advisor/TermAdvisorPanel';
import { LiteraturePanel } from './plugins/literature/LiteraturePanel';
import { EvaluatorPanel } from './plugins/evaluator/EvaluatorPanel';
import { FormulaPanel } from './plugins/formula/FormulaPanel';
import { PaperWriterPanel } from './plugins/paper-writer/PaperWriterPanel';
import { ProjectLabPanel } from './plugins/project-lab/ProjectLabPanel';

// 在模块加载时注册，导航与标题色块第一次渲染就能拿到完整工具列表。
registerTool({
  name: 'term-advisor',
  displayName: '读懂导师',
  kicker: 'Advisor Decoder',
  tagline: '把导师一段模糊的交代拆成可执行的任务、依赖顺序与时间估算。',
  facts: [
    { label: '仅本地模型', detail: '导师沟通按机密级处理' },
    { label: '两种输出', detail: '仅拆解 / 完整计划' },
  ],
  component: TermAdvisorPanel,
});

registerTool({
  name: 'literature',
  displayName: '追新论文',
  kicker: 'Paper Tracker',
  tagline: '按关键词并行取回论文，去重后按时间排列，可做摘要、找研究空白、看引用关系。',
  facts: [
    { label: '三个数据源', detail: 'ArXiv · Semantic Scholar · DBLP' },
    { label: '三重去重', detail: '标题 · arXiv ID · DOI' },
  ],
  component: LiteraturePanel,
});

registerTool({
  name: 'evaluator',
  displayName: '审项目',
  kicker: 'Project Reviewer',
  tagline: '从创新性、合理性、方法学三个维度给项目提案打分，并列出弱点与改进建议。',
  facts: [
    { label: '三个维度', detail: '各自 10 分制' },
    { label: '输出', detail: '优点 · 弱点 · 建议' },
  ],
  component: EvaluatorPanel,
});

registerTool({
  name: 'formula',
  displayName: '验公式',
  kicker: 'Formula Validator',
  tagline: '公式同时走基础检查与 SymPy 符号计算两条通道，两条都通过才判定为通过。',
  facts: [
    { label: '不使用大模型', detail: '纯本地数值与符号计算' },
    { label: '双通道', detail: '基础检查 + SymPy' },
  ],
  component: FormulaPanel,
});

registerTool({
  name: 'paper-writer',
  displayName: '写论文',
  kicker: 'Thesis Writer',
  tagline: '生成带字数估算的章节大纲、解析 BibTeX 引用条目，并检测与清理 AI 写作痕迹。',
  facts: [
    { label: '三件事', detail: '大纲 · 引用 · 去 AI 味' },
    { label: '本地处理', detail: '文本不离开本机' },
  ],
  component: PaperWriterPanel,
});

registerTool({
  name: 'project-lab',
  displayName: '项目实验室',
  kicker: 'Project Lab',
  tagline: '结构化记录项目与实验过程，每次保存自动留下版本，可打快照并回滚。',
  facts: [
    { label: '结构化记录', detail: '项目 → 实验 → 版本' },
    { label: '可回滚', detail: '手动快照 · 版本时间线' },
  ],
  component: ProjectLabPanel,
});

export const App: React.FC = () => <Workbench />;
