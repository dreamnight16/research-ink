import React, { useState } from 'react';
import { SecurityBadge } from '../../shared/SecurityBadge';
import type { Classification } from '../../core/types';

interface EvalResult {
  innovation_score: number;
  rationality_score: number;
  methodology_score: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
}

/** 三个维度用不同品牌色区分功能；分值同时以数字与长度表达，不只靠颜色 */
const DIMENSIONS = [
  { key: 'innovation_score', label: '创新性', en: 'Innovation', color: 'var(--dn-violet)' },
  { key: 'rationality_score', label: '合理性', en: 'Rationality', color: 'var(--dn-emerald)' },
  { key: 'methodology_score', label: '方法学', en: 'Methodology', color: 'var(--dn-cyan)' },
] as const;

export const EvaluatorPanel: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [classification, setClassification] = useState<Classification>('cautious');
  const [result, setResult] = useState<EvalResult | null>(null);
  const [loading, setLoading] = useState(false);

  const evaluate = async () => {
    if (!description.trim()) return;
    setLoading(true);
    const res = await fetch('http://127.0.0.1:8000/api/evaluator/evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="ink-stack" style={{ gap: 28 }}>
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Submission</p>
            <h2 className="ink-h2 ink-section__title">待评审的项目</h2>
          </div>
          <label className="ink-field">
            <span className="ink-label">数据级别</span>
            <SecurityBadge classification={classification} onChange={setClassification} />
          </label>
        </div>

        <label className="ink-field">
          <span className="ink-label">项目名称</span>
          <input
            className="ink-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="例如：面向长文档的稀疏注意力检索"
          />
        </label>

        <label className="ink-field">
          <span className="ink-label">项目描述</span>
          <textarea
            className="ink-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={8}
            placeholder="写清研究问题、方法、创新点与预期结果。"
          />
        </label>

        <div className="ink-row">
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={evaluate}
            disabled={loading || !description.trim()}
          >
            {loading ? '评审中…' : '开始评审'}
          </button>
          <span className="ink-note ink-note--sm">决策由后端模型给出，界面只负责呈现。</span>
        </div>
      </section>

      {result && (
        <>
          <section className="ink-section">
            <div className="ink-section__head">
              <div>
                <p className="ink-kicker">Scores</p>
                <h2 className="ink-h2 ink-section__title">三维评分</h2>
              </div>
              <p className="ink-note ink-note--sm">每项满分 10 分，来自本次评审结果。</p>
            </div>
            <div className="ink-metrics">
              {DIMENSIONS.map((dim) => {
                const score = Number(result[dim.key] ?? 0);
                return (
                  <div
                    className="ink-metric"
                    key={dim.key}
                    style={{ '--ink-accent': dim.color } as React.CSSProperties}
                  >
                    <span className="ink-metric__label">{dim.en}</span>
                    <span className="ink-num ink-metric__value">{score}</span>
                    <span className="ink-metric__sub">{dim.label} · 满分 10 分</span>
                  </div>
                );
              })}
            </div>
            <div className="ink-stack ink-stack--tight">
              {DIMENSIONS.map((dim) => {
                const score = Number(result[dim.key] ?? 0);
                const pct = Math.max(0, Math.min(100, (score / 10) * 100));
                return (
                  <div className="ink-meter ink-meter--canvas" key={dim.key}>
                    <span className="ink-note ink-note--sm" style={{ width: 64 }}>{dim.label}</span>
                    <span
                      className="ink-meter__track"
                      role="img"
                      aria-label={`${dim.label} ${score} 分，满分 10 分`}
                    >
                      <span
                        className="ink-meter__fill"
                        style={{
                          width: `${pct}%`,
                          background: dim.color,
                        }}
                      />
                    </span>
                    <span className="ink-num" style={{ fontSize: '0.875rem' }}>{score}/10</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ink-section">
            <div className="ink-section__head">
              <div>
                <p className="ink-kicker">Review</p>
                <h2 className="ink-h2 ink-section__title">评语</h2>
              </div>
            </div>
            <div className="ink-split">
              <div className="ink-panel" style={{ borderTop: '4px solid var(--dn-emerald)' }}>
                <p className="ink-kicker">Strengths</p>
                <h3 className="ink-h3" style={{ marginTop: 4 }}>优点 · {result.strengths.length}</h3>
                {result.strengths.length > 0 ? (
                  <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                    {result.strengths.map((s, i) => (
                      <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="ink-note" style={{ marginTop: 12 }}>本次没有给出优点条目。</p>
                )}
              </div>

              <div className="ink-panel" style={{ borderTop: '4px solid var(--dn-crimson)' }}>
                <p className="ink-kicker">Weaknesses</p>
                <h3 className="ink-h3" style={{ marginTop: 4 }}>弱点 · {result.weaknesses.length}</h3>
                {result.weaknesses.length > 0 ? (
                  <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                    {result.weaknesses.map((w, i) => (
                      <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{w}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="ink-note" style={{ marginTop: 12 }}>本次没有给出弱点条目。</p>
                )}
              </div>

              <div className="ink-panel" style={{ borderTop: '4px solid var(--dn-cyan)' }}>
                <p className="ink-kicker">Suggestions</p>
                <h3 className="ink-h3" style={{ marginTop: 4 }}>改进建议 · {result.suggestions.length}</h3>
                {result.suggestions.length > 0 ? (
                  <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                    {result.suggestions.map((s, i) => (
                      <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="ink-note" style={{ marginTop: 12 }}>本次没有给出建议条目。</p>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
