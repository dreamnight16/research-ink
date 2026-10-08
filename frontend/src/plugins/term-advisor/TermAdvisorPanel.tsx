import React, { useState } from 'react';

interface ParsedTask {
  action: string;
  keywords: string[];
  priority: string;
}

interface PlannedTask {
  index: number;
  action: string;
  keywords: string[];
  phase: string;
  estimated_days_min: number;
  estimated_days_max: number;
  depends_on: number[];
  subtasks: string[];
  resources: string[];
  milestone: string;
}

interface ResearchPlan {
  title: string;
  total_days_min: number;
  total_days_max: number;
  tasks: PlannedTask[];
  timeline: { task_index: number; action: string; phase: string; start_day: number; end_day: number }[];
}

/** 阶段用品牌色区分功能，同时始终显示阶段名称，不只靠颜色 */
const PHASE_COLOR: Record<string, string> = {
  调研阶段: 'var(--dn-cyan)',
  设计阶段: 'var(--dn-violet)',
  实现阶段: 'var(--dn-amber)',
  实验阶段: 'var(--dn-emerald)',
  写作阶段: 'var(--dn-orange)',
};

function accentStyle(color: string): React.CSSProperties {
  return { '--ink-accent': color } as React.CSSProperties;
}

const PhaseTag: React.FC<{ phase: string }> = ({ phase }) => (
  <span className="ink-tag ink-tag--field" style={accentStyle(PHASE_COLOR[phase] ?? 'var(--dn-steel)')}>
    {phase}
  </span>
);

export const TermAdvisorPanel: React.FC = () => {
  const [input, setInput] = useState('');
  const [tasks, setTasks] = useState<ParsedTask[]>([]);
  const [plan, setPlan] = useState<ResearchPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'parse' | 'plan'>('plan');

  const doParse = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setPlan(null);
    const res = await fetch('http://127.0.0.1:8000/api/term-advisor/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    });
    const data = await res.json();
    setTasks(data.tasks);
    setLoading(false);
  };

  const doPlan = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setTasks([]);
    const res = await fetch('http://127.0.0.1:8000/api/term-advisor/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input, title: '' }),
    });
    const data = await res.json();
    setPlan(data);
    setLoading(false);
  };

  const handleSubmit = () => {
    if (mode === 'plan') doPlan();
    else doParse();
  };

  return (
    <div className="ink-stack" style={{ gap: 28 }}>
      <div className="ink-notice" data-tone="warn">
        <p className="ink-notice__title">导师沟通按机密级（级 3）处理</p>
        <p>这个工具只使用本地模型；机密级内容会被安全层拦截，不会发往云端 API。</p>
      </div>

      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Input</p>
            <h2 className="ink-h2 ink-section__title">导师原话</h2>
          </div>
          <div className="ink-seg" role="group" aria-label="输出模式">
            <button
              type="button"
              className="ink-seg__opt"
              aria-pressed={mode === 'plan'}
              onClick={() => setMode('plan')}
            >
              完整计划
            </button>
            <button
              type="button"
              className="ink-seg__opt"
              aria-pressed={mode === 'parse'}
              onClick={() => setMode('parse')}
            >
              仅拆解
            </button>
          </div>
        </div>

        <label className="ink-field">
          <span className="ink-label">粘贴导师的交代</span>
          <textarea
            className="ink-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={6}
            placeholder={
              '例如：先做 Transformer attention 的文献综述，再实现一个改进的稀疏注意力变体，最后在 GLUE 上和 baseline 对比做实验'
            }
          />
        </label>

        <div className="ink-row">
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
          >
            {loading ? '处理中…' : mode === 'plan' ? '生成计划' : '拆解任务'}
          </button>
          <span className="ink-note ink-note--sm">
            完整计划 = 拆解 + 排期；仅拆解只返回任务与关键词。
          </span>
        </div>
      </section>

      {tasks.length > 0 && !plan && (
        <section className="ink-section">
          <div className="ink-section__head">
            <div>
              <p className="ink-kicker">Parsed</p>
              <h2 className="ink-h2 ink-section__title">拆解结果 · {tasks.length} 项</h2>
            </div>
          </div>
          <div className="ink-list">
            {tasks.map((t, i) => (
              <div className="ink-list__row" key={i}>
                <div className="ink-list__main">
                  <p className="ink-h3">{t.action}</p>
                  {t.keywords.length > 0 && (
                    <div className="ink-row" style={{ marginTop: 8 }}>
                      {t.keywords.map((kw, j) => (
                        <span className="ink-tag" key={j}>{kw}</span>
                      ))}
                    </div>
                  )}
                </div>
                {t.priority && <span className="ink-flag" data-tone="neutral"><span>优先级 {t.priority}</span></span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {plan && (
        <>
          <section className="ink-section">
            <div className="ink-section__head">
              <div>
                <p className="ink-kicker">Plan</p>
                <h2 className="ink-h2 ink-section__title">{plan.title || '研究计划'}</h2>
              </div>
              <p className="ink-note ink-note--sm">天数由后端根据阶段模型估算，不是日历日期。</p>
            </div>
            <div className="ink-metrics">
              <div className="ink-metric">
                <span className="ink-metric__label">任务数</span>
                <span className="ink-num ink-metric__value">{plan.tasks.length}</span>
              </div>
              <div className="ink-metric">
                <span className="ink-metric__label">预计工期</span>
                <span className="ink-num ink-metric__value">{plan.total_days_min}–{plan.total_days_max}</span>
                <span className="ink-metric__sub">天</span>
              </div>
              <div className="ink-metric">
                <span className="ink-metric__label">时间线跨度</span>
                <span className="ink-num ink-metric__value">
                  {plan.timeline.length > 0 ? plan.timeline[plan.timeline.length - 1].end_day : 0}
                </span>
                <span className="ink-metric__sub">天</span>
              </div>
            </div>
          </section>

          <section className="ink-section">
            <div className="ink-section__head">
              <div>
                <p className="ink-kicker">Timeline</p>
                <h2 className="ink-h2 ink-section__title">排期顺序</h2>
              </div>
            </div>
            <div className="ink-timeline">
              <span className="ink-timeline__line" aria-hidden="true" />
              {plan.timeline.map((entry) => (
                <div className="ink-timeline__item" key={entry.task_index}>
                  <span className="ink-timeline__marker" aria-hidden="true" />
                  <div className="ink-list__main">
                    <p className="ink-h3">{entry.action}</p>
                    <div className="ink-row" style={{ marginTop: 6 }}>
                      <PhaseTag phase={entry.phase} />
                    </div>
                  </div>
                  <span className="ink-note ink-num" style={{ fontSize: '0.875rem' }}>
                    Day {entry.start_day} – {entry.end_day}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="ink-section">
            <div className="ink-section__head">
              <div>
                <p className="ink-kicker">Details</p>
                <h2 className="ink-h2 ink-section__title">任务明细</h2>
              </div>
            </div>
            <div className="ink-stack">
              {plan.tasks.map((task) => (
                <article className="ink-panel ink-panel--accent" key={task.index} style={accentStyle(
                  PHASE_COLOR[task.phase] ?? 'var(--dn-steel)',
                )}>
                  <div className="ink-row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div className="ink-list__main">
                      <p className="ink-h3">
                        {String(task.index + 1).padStart(2, '0')} · {task.action}
                      </p>
                      <div className="ink-row" style={{ marginTop: 8 }}>
                        <PhaseTag phase={task.phase} />
                        {task.milestone && <span className="ink-flag" data-tone="info"><span>里程碑 {task.milestone}</span></span>}
                        {task.depends_on.length > 0 && (
                          <span className="ink-note ink-note--sm">
                            依赖 {task.depends_on.map((d) => '#' + (d + 1)).join('、')}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="ink-num" style={{ fontSize: '1.25rem' }}>
                      {task.estimated_days_min}–{task.estimated_days_max} 天
                    </span>
                  </div>

                  {task.keywords.length > 0 && (
                    <div className="ink-row" style={{ marginTop: 12 }}>
                      {task.keywords.map((kw, j) => (
                        <span className="ink-tag" key={j}>{kw}</span>
                      ))}
                    </div>
                  )}

                  <div className="ink-stack ink-stack--tight" style={{ marginTop: 16 }}>
                    <details className="ink-accordion">
                      <summary className="ink-accordion__head">
                        <span className="ink-kicker">子步骤</span>
                        <span className="ink-accordion__title">
                          {task.subtasks.length} 条
                        </span>
                      </summary>
                      <div className="ink-accordion__body">
                        <ul style={{ paddingLeft: 20 }}>
                          {task.subtasks.map((s, j) => (
                            <li key={j} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    </details>

                    {task.resources.length > 0 && (
                      <details className="ink-accordion">
                        <summary className="ink-accordion__head">
                          <span className="ink-kicker">参考资料</span>
                          <span className="ink-accordion__title">
                            {task.resources.length} 条
                          </span>
                        </summary>
                        <div className="ink-accordion__body">
                          <ul style={{ paddingLeft: 20 }}>
                            {task.resources.map((r, j) => (
                              <li key={j} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{r}</li>
                            ))}
                          </ul>
                        </div>
                      </details>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
};
