import React, { useState } from 'react';

interface OutlineSection {
  title: string;
  key_points: string[];
  estimated_words: number;
}

interface BibEntry {
  cite_key: string;
  title: string;
  author: string;
  year: string;
  journal: string;
}

interface DeAIResult {
  original_score: number;
  cleaned_score: number;
  original_flags: string[];
  original_summary: string;
  cleaned_text: string;
}

export const PaperWriterPanel: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [outline, setOutline] = useState<OutlineSection[]>([]);
  const [bibtex, setBibtex] = useState('');
  const [entries, setEntries] = useState<BibEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [deaiInput, setDeaiInput] = useState('');
  const [deaiLoading, setDeaiLoading] = useState(false);
  const [deaiResult, setDeaiResult] = useState<DeAIResult | null>(null);

  const generateOutline = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    const res = await fetch('http://127.0.0.1:8000/api/paper-writer/outline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic }),
    });
    const data = await res.json();
    setOutline(data.sections);
    setLoading(false);
  };

  const parseBibtex = async () => {
    if (!bibtex.trim()) return;
    const res = await fetch('http://127.0.0.1:8000/api/paper-writer/citation/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bibtex }),
    });
    const data = await res.json();
    setEntries(data.entries);
  };

  const runDeAI = async () => {
    if (!deaiInput.trim()) return;
    setDeaiLoading(true);
    const res = await fetch('http://127.0.0.1:8000/api/paper-writer/deai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: deaiInput }),
    });
    const data = await res.json();
    setDeaiResult(data);
    setDeaiLoading(false);
  };

  const totalWords = outline.reduce((sum, s) => sum + s.estimated_words, 0);

  return (
    <div className="ink-stack" style={{ gap: 32 }}>
      {/* ------------------------------------------------ 大纲生成 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Outline</p>
            <h2 className="ink-h2 ink-section__title">章节大纲</h2>
          </div>
          {outline.length > 0 && (
            <p className="ink-num" style={{ fontSize: '1.5rem' }}>
              ≈ {totalWords} 字
            </p>
          )}
        </div>

        <div className="ink-row">
          <label className="ink-field" style={{ flex: '1 1 280px' }}>
            <span className="ink-label">论文题目</span>
            <input
              className="ink-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateOutline()}
              placeholder="例如：面向长文档检索的稀疏注意力机制"
            />
          </label>
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={generateOutline}
            disabled={loading || !topic.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            {loading ? '生成中…' : '生成大纲'}
          </button>
        </div>

        {outline.length > 0 && (
          <>
            <div className="ink-metrics">
              <div className="ink-metric">
                <span className="ink-metric__label">章节数</span>
                <span className="ink-num ink-metric__value">{outline.length}</span>
              </div>
              <div className="ink-metric">
                <span className="ink-metric__label">预计总字数</span>
                <span className="ink-num ink-metric__value">{totalWords}</span>
                <span className="ink-metric__sub">由后端按章节估算</span>
              </div>
            </div>

            <div className="ink-list">
              {outline.map((section, i) => (
                <div className="ink-list__row" key={i}>
                  <div className="ink-list__main">
                    <p className="ink-h3">
                      {String(i + 1).padStart(2, '0')} · {section.title}
                    </p>
                    {section.key_points.length > 0 && (
                      <ul style={{ paddingLeft: 20, marginTop: 8 }}>
                        {section.key_points.map((kp, j) => (
                          <li key={j} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{kp}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <span className="ink-num ink-note" style={{ fontSize: '0.9375rem', whiteSpace: 'nowrap' }}>
                    ≈ {section.estimated_words} 字
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ------------------------------------------------ 引用管理 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Citations</p>
            <h2 className="ink-h2 ink-section__title">BibTeX 引用</h2>
          </div>
          {entries.length > 0 && (
            <p className="ink-note ink-note--sm">已解析 {entries.length} 条</p>
          )}
        </div>

        <label className="ink-field">
          <span className="ink-label">粘贴 BibTeX</span>
          <textarea
            className="ink-textarea ink-textarea--mono"
            value={bibtex}
            onChange={(e) => setBibtex(e.target.value)}
            rows={6}
            placeholder={'@article{key,\n  title = {...},\n  author = {...},\n  year = {2024}\n}'}
          />
        </label>
        <div className="ink-row">
          <button
            type="button"
            className="ink-btn"
            onClick={parseBibtex}
            disabled={!bibtex.trim()}
          >
            解析引用
          </button>
        </div>

        {entries.length > 0 && (
          <div className="ink-list">
            {entries.map((entry, i) => (
              <div className="ink-list__row" key={i}>
                <div className="ink-list__main">
                  <p className="ink-h3">{entry.title}</p>
                  <p className="ink-list__meta">
                    {entry.author && <span>{entry.author}</span>}
                    {entry.year && <span>{entry.year}</span>}
                    {entry.journal && <span>{entry.journal}</span>}
                  </p>
                </div>
                <span className="ink-tag ink-tag--field">{entry.cite_key}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------ 去 AI 味 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Humanize</p>
            <h2 className="ink-h2 ink-section__title">去 AI 味</h2>
          </div>
          {deaiResult && (
            <div className="ink-row">
              <span className="ink-flag" data-tone="neutral">
                <span>原文得分 {deaiResult.original_score}</span>
              </span>
              <span className="ink-flag" data-tone={deaiResult.cleaned_score < deaiResult.original_score ? 'ok' : 'warn'}>
                <span aria-hidden="true">{deaiResult.cleaned_score < deaiResult.original_score ? '↓' : '→'}</span>
                <span>清理后 {deaiResult.cleaned_score}</span>
              </span>
            </div>
          )}
        </div>
        <p className="ink-note ink-note--sm">
          得分由后端规则引擎给出，数值越低代表 AI 写作痕迹越少。
        </p>

        <label className="ink-field">
          <span className="ink-label">待检测文本</span>
          <textarea
            className="ink-textarea"
            value={deaiInput}
            onChange={(e) => setDeaiInput(e.target.value)}
            rows={7}
            placeholder="粘贴需要检测的中文或英文段落。"
          />
        </label>
        <div className="ink-row">
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={runDeAI}
            disabled={deaiLoading || !deaiInput.trim()}
          >
            {deaiLoading ? '处理中…' : '检测并清理'}
          </button>
        </div>

        {deaiResult && (
          <div className="ink-split">
            <div className="ink-panel">
              <p className="ink-kicker">Flags</p>
              <h3 className="ink-h3" style={{ marginTop: 4 }}>
                检测到的痕迹 · {deaiResult.original_flags.length}
              </h3>
              {deaiResult.original_summary && (
                <p className="ink-note" style={{ marginTop: 8 }}>{deaiResult.original_summary}</p>
              )}
              {deaiResult.original_flags.length > 0 ? (
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {deaiResult.original_flags.map((flag, i) => (
                    <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{flag}</li>
                  ))}
                </ul>
              ) : (
                <p className="ink-note" style={{ marginTop: 12 }}>没有命中已知的 AI 写作痕迹规则。</p>
              )}
            </div>

            <div className="ink-panel">
              <p className="ink-kicker">Cleaned</p>
              <h3 className="ink-h3" style={{ marginTop: 4 }}>清理后的文本</h3>
              {deaiResult.cleaned_text ? (
                <div className="ink-deai-out" style={{ marginTop: 12 }}>{deaiResult.cleaned_text}</div>
              ) : (
                <p className="ink-note" style={{ marginTop: 12 }}>后端没有返回清理后的文本。</p>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
