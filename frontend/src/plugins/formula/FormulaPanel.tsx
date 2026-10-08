import React, { useMemo, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface VerificationResult {
  basic: { is_valid: boolean; errors: string[]; warnings: string[]; suggestions: string[] };
  sympy: { is_valid: boolean; errors: string[]; suggestions: string[] };
  cross_validated: boolean;
}

/** KaTeX 渲染失败时退回原文，保证预览区始终可用 */
function renderLatex(source: string): { html: string | null; error: string | null } {
  if (!source.trim()) return { html: null, error: null };
  try {
    const html = katex.renderToString(source, {
      displayMode: true,
      throwOnError: true,
      strict: false,
    });
    return { html, error: null };
  } catch (e) {
    return { html: null, error: e instanceof Error ? e.message : '渲染失败' };
  }
}

export const FormulaPanel: React.FC = () => {
  const [latex, setLatex] = useState('');
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const preview = useMemo(() => renderLatex(latex), [latex]);

  const verify = async () => {
    if (!latex.trim()) return;
    setLoading(true);
    const res = await fetch('http://127.0.0.1:8000/api/formula/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expression: latex }),
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="ink-stack" style={{ gap: 28 }}>
      <div className="ink-notice" data-tone="info">
        <p className="ink-notice__title">纯本地计算</p>
        <p>基础检查与 SymPy 符号计算都在本机完成，不调用大模型，公式不会离开这台机器。</p>
      </div>

      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Source</p>
            <h2 className="ink-h2 ink-section__title">公式与预览</h2>
          </div>
        </div>

        <div className="ink-split">
          <div className="ink-stack">
            <label className="ink-field">
              <span className="ink-label">LaTeX 源码</span>
              <textarea
                className="ink-textarea ink-textarea--mono"
                value={latex}
                onChange={(e) => setLatex(e.target.value)}
                rows={6}
                placeholder={'例如：\\frac{-b + \\sqrt{b^2 - 4ac}}{2a}'}
              />
            </label>
            <div className="ink-row">
              <button
                type="button"
                className="ink-btn ink-btn--primary"
                onClick={verify}
                disabled={loading || !latex.trim()}
              >
                {loading ? '校验中…' : '双通道校验'}
              </button>
            </div>
          </div>

          <div>
            <p className="ink-label">渲染预览</p>
            <div className="ink-preview">
              {preview.html ? (
                <div dangerouslySetInnerHTML={{ __html: preview.html }} />
              ) : preview.error ? (
                <p className="ink-note">KaTeX 无法渲染这段源码：{preview.error}</p>
              ) : (
                <p className="ink-note">输入 LaTeX 后这里会显示渲染结果。</p>
              )}
            </div>
          </div>
        </div>
      </section>

      {result && (
        <section className="ink-section">
          <div className="ink-section__head">
            <div>
              <p className="ink-kicker">Result</p>
              <h2 className="ink-h2 ink-section__title">校验结果</h2>
            </div>
            <span className="ink-flag" data-tone={result.cross_validated ? 'ok' : 'error'}>
              <span aria-hidden="true">{result.cross_validated ? '✓' : '!'}</span>
              <span>{result.cross_validated ? '双通道通过' : '发现问题'}</span>
            </span>
          </div>

          <div className="ink-split">
            <div className="ink-panel">
              <p className="ink-kicker">Channel 1</p>
              <h3 className="ink-h3" style={{ marginTop: 4 }}>基础检查</h3>
              <p className="ink-note" style={{ marginTop: 6 }}>
                {result.basic.is_valid ? '通过' : '未通过'} · 括号匹配、除零与定义域等
              </p>
              {result.basic.errors.length > 0 && (
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {result.basic.errors.map((e, i) => (
                    <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{e}</li>
                  ))}
                </ul>
              )}
              {result.basic.warnings.length > 0 && (
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {result.basic.warnings.map((w, i) => (
                    <li key={i} className="ink-note">警告：{w}</li>
                  ))}
                </ul>
              )}
              {result.basic.errors.length === 0 && result.basic.warnings.length === 0 && (
                <p className="ink-note" style={{ marginTop: 12 }}>没有错误或警告。</p>
              )}
            </div>

            <div className="ink-panel">
              <p className="ink-kicker">Channel 2</p>
              <h3 className="ink-h3" style={{ marginTop: 4 }}>SymPy 符号计算</h3>
              <p className="ink-note" style={{ marginTop: 6 }}>
                {result.sympy.is_valid ? '通过' : '未通过'} · 符号化简与等价性检查
              </p>
              {result.sympy.errors.length > 0 && (
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {result.sympy.errors.map((e, i) => (
                    <li key={i} className="ink-note" style={{ color: 'var(--dn-text-primary)' }}>{e}</li>
                  ))}
                </ul>
              )}
              {result.sympy.suggestions.length > 0 && (
                <ul style={{ paddingLeft: 20, marginTop: 12 }}>
                  {result.sympy.suggestions.map((s, i) => (
                    <li key={i} className="ink-note">{s}</li>
                  ))}
                </ul>
              )}
              {result.sympy.errors.length === 0 && result.sympy.suggestions.length === 0 && (
                <p className="ink-note" style={{ marginTop: 12 }}>没有错误或建议。</p>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
