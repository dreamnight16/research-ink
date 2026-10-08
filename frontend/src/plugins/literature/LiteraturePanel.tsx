import React, { useState, useEffect, useCallback } from 'react';

interface Paper {
  id?: string;
  arxiv_id?: string;
  title: string;
  authors: string;
  summary: string;
  published: string;
  link: string;
  venue?: string | { name?: string };
  citations?: number;
  year?: string;
  doi?: string;
}

interface Gap {
  direction: string;
  confidence: string;
  reason: string;
}

interface Graph {
  nodes: { id: string; name: string; symbolSize: number }[];
  edges: { source: string; target: string; weight: number; shared_keywords: string[] }[];
  total_nodes: number;
  total_edges: number;
}

const paperKey = (p: Paper): string => p.id || p.arxiv_id || p.title;
const paperLink = (p: Paper): string => p.link || (p.doi ? `https://doi.org/${p.doi}` : '#');
const venueName = (p: Paper): string => {
  if (!p.venue) return '';
  if (typeof p.venue === 'string') return p.venue;
  return p.venue.name || '';
};

/** 相对时间按本机当前时间计算，来源是论文自身的发表日期 */
const timeAgo = (dateStr: string): string => {
  if (!dateStr) return '';
  const pub = new Date(dateStr);
  if (Number.isNaN(pub.getTime())) return '';
  const days = Math.floor((Date.now() - pub.getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 0) return '今天';
  if (days === 1) return '昨天';
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  return pub.toLocaleDateString('zh-CN');
};

const confidenceLabel: Record<string, string> = {
  high: '高置信度',
  medium: '中等置信度',
  low: '低置信度',
};

export const LiteraturePanel: React.FC = () => {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [loading, setLoading] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [gaps, setGaps] = useState<Gap[]>([]);
  const [showGaps, setShowGaps] = useState(false);
  const [graph, setGraph] = useState<Graph | null>(null);
  /** 动作失败时明确说明原因，界面不静默失败 */
  const [actionError, setActionError] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/literature/feed', { method: 'POST' });
      const data = await res.json();
      setPapers(data.papers ?? []);
      if (data.interests?.length) setInterests(data.interests);
      setActionError(null);
    } catch (e: unknown) {
      // 后端不可达时给出明确说明，而不是显示成「没有论文」
      setPapers([]);
      setActionError(
        '无法连接本机后端 127.0.0.1:8000，下面的列表为空是连接失败，不是没有论文。' +
          (e instanceof Error ? '（' + e.message + '）' : ''),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInterests = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/literature/interests');
      const data = await res.json();
      if (data.keywords?.length) setInterests(data.keywords);
    } catch {
      // 关键词读取失败不影响后续操作，界面下方已有连接状态提示
    }
  };

  useEffect(() => {
    loadInterests();
    loadFeed();
  }, [loadFeed]);

  const findGaps = async () => {
    if (papers.length === 0) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/evaluator/gap-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: papers.slice(0, 10) }),
      });
      const data = await res.json();
      setGaps(data.gaps || []);
      setShowGaps(true);
      setActionError(null);
    } catch (e: unknown) {
      setActionError('研究空白分析失败：' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const buildGraph = async () => {
    if (papers.length < 2) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/literature/citation-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ papers: papers.slice(0, 20) }),
      });
      const data = await res.json();
      setGraph(data);
      setActionError(null);
    } catch (e: unknown) {
      setActionError('引用关系分析失败：' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const saveInterests = async (updated: string[]) => {
    setInterests(updated);
    try {
      await fetch('http://127.0.0.1:8000/api/literature/interests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: updated }),
      });
      setActionError(null);
    } catch (e: unknown) {
      setActionError('关键词没有写入后端：' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  const addInterest = () => {
    const kw = newInterest.trim();
    if (!kw || interests.includes(kw)) return;
    saveInterests([...interests, kw]);
    setNewInterest('');
  };

  const removeInterest = (kw: string) => {
    saveInterests(interests.filter((k) => k !== kw));
  };

  const doSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/literature/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, max_results: 10 }),
      });
      const data = await res.json();
      setPapers(data.papers);
      setActionError(null);
    } catch (e: unknown) {
      setActionError('搜索失败：' + (e instanceof Error ? e.message : '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const summarizePaper = async (paper: Paper) => {
    if (summaries[paperKey(paper)]) return;
    try {
      const res = await fetch('http://127.0.0.1:8000/api/literature/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paper),
      });
      const data = await res.json();
      setSummaries((prev) => ({ ...prev, [paperKey(paper)]: data.summary }));
      setActionError(null);
    } catch (e: unknown) {
      setActionError('摘要失败：' + (e instanceof Error ? e.message : '未知错误'));
    }
  };

  return (
    <div className="ink-stack" style={{ gap: 32 }}>
      {/* ------------------------------------------------ 关注领域 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Fields</p>
            <h2 className="ink-h2 ink-section__title">关注领域</h2>
          </div>
          <p className="ink-note ink-note--sm">这些关键词决定订阅源抓取什么。点标签即可移除。</p>
        </div>

        <div className="ink-row">
          {interests.length === 0 && (
            <span className="ink-note">还没有关键词，先添加一个再刷新订阅。</span>
          )}
          {interests.map((kw) => (
            <button
              key={kw}
              type="button"
              className="ink-tag ink-tag--field"
              onClick={() => removeInterest(kw)}
              aria-label={`移除关键词 ${kw}`}
            >
              {kw}
              <span className="ink-tag__x" aria-hidden="true">×</span>
            </button>
          ))}
        </div>

        <div className="ink-row">
          <label className="ink-field" style={{ flex: '1 1 220px', maxWidth: 320 }}>
            <span className="ink-label">新增关键词</span>
            <input
              className="ink-input"
              value={newInterest}
              onChange={(e) => setNewInterest(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addInterest()}
              placeholder="例如：sparse attention"
            />
          </label>
          <button
            type="button"
            className="ink-btn"
            onClick={addInterest}
            disabled={!newInterest.trim()}
            style={{ alignSelf: 'flex-end' }}
          >
            添加
          </button>
        </div>
      </section>

      {/* ------------------------------------------------ 操作 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Actions</p>
            <h2 className="ink-h2 ink-section__title">抓取与分析</h2>
          </div>
          {papers.length > 0 && (
            <p className="ink-num" style={{ fontSize: '1.5rem' }}>{papers.length} 篇</p>
          )}
        </div>

        <div className="ink-row">
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={loadFeed}
            disabled={loading}
          >
            {loading ? '抓取中…' : '刷新订阅'}
          </button>
          <button
            type="button"
            className="ink-btn"
            aria-expanded={showSearch}
            onClick={() => setShowSearch(!showSearch)}
          >
            {showSearch ? '收起搜索' : '按关键词搜索'}
          </button>
          <button
            type="button"
            className="ink-btn"
            onClick={findGaps}
            disabled={papers.length === 0}
          >
            找研究空白
          </button>
          <button
            type="button"
            className="ink-btn"
            onClick={buildGraph}
            disabled={papers.length < 2}
          >
            看引用关系
          </button>
        </div>

        {showSearch && (
          <div className="ink-row">
            <label className="ink-field" style={{ flex: '1 1 260px' }}>
              <span className="ink-label">搜索 ArXiv</span>
              <input
                className="ink-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                placeholder="输入关键词后回车"
              />
            </label>
            <button
              type="button"
              className="ink-btn"
              onClick={doSearch}
              disabled={!searchQuery.trim()}
              style={{ alignSelf: 'flex-end' }}
            >
              搜索
            </button>
          </div>
        )}

        {actionError && (
          <div className="ink-notice" data-tone="danger">
            <p className="ink-notice__title">这一步没有完成</p>
            <p>{actionError}</p>
          </div>
        )}

        <p className="ink-data-note">
          列表内容来自本机后端返回的论文数据，界面不生成、不补全任何论文或时间。
        </p>
      </section>

      {/* ------------------------------------------------ 研究空白 --- */}
      {showGaps && gaps.length > 0 && (
        <section className="ink-section">
          <div className="ink-section__head">
            <div>
              <p className="ink-kicker">Gaps</p>
              <h2 className="ink-h2 ink-section__title">研究空白 · {gaps.length} 条</h2>
            </div>
            <button type="button" className="ink-btn ink-btn--sm" onClick={() => setShowGaps(false)}>
              关闭
            </button>
          </div>
          <div className="ink-list">
            {gaps.map((g, i) => (
              <div className="ink-list__row" key={i}>
                <div className="ink-list__main">
                  <p className="ink-h3">{g.direction}</p>
                  {g.reason && <p className="ink-note" style={{ marginTop: 4 }}>{g.reason}</p>}
                </div>
                <span
                  className="ink-flag"
                  data-tone={g.confidence === 'high' ? 'error' : g.confidence === 'low' ? 'neutral' : 'warn'}
                >
                  <span>{confidenceLabel[g.confidence] ?? g.confidence}</span>
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ------------------------------------------------ 引用关系 --- */}
      {graph && (
        <section className="ink-section">
          <div className="ink-section__head">
            <div>
              <p className="ink-kicker">Graph</p>
              <h2 className="ink-h2 ink-section__title">引用关系</h2>
            </div>
            <div className="ink-row">
              <span className="ink-note ink-note--sm">
                {graph.total_nodes} 个节点 · {graph.total_edges} 条连接
              </span>
              <button type="button" className="ink-btn ink-btn--sm" onClick={() => setGraph(null)}>
                关闭
              </button>
            </div>
          </div>

          {graph.edges.length === 0 ? (
            <div className="ink-empty">
              <p className="ink-empty__mark" aria-hidden="true">—</p>
              <p className="ink-h3">这些论文之间没有共享关键词</p>
              <p className="ink-note">增加更多论文或调整关键词后再试。</p>
            </div>
          ) : (
            <div className="ink-list">
              {graph.edges.slice(0, 20).map((edge, i) => {
                const src = graph.nodes.find((n) => n.id === edge.source);
                const tgt = graph.nodes.find((n) => n.id === edge.target);
                return (
                  <div className="ink-timeline__item" key={i}>
                    <span className="ink-list__main" style={{ textAlign: 'right' }}>
                      {src?.name || edge.source}
                    </span>
                    <span className="ink-tag ink-tag--field">{edge.weight} 个共享关键词</span>
                    <span className="ink-list__main">{tgt?.name || edge.target}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ------------------------------------------------ 论文列表 --- */}
      <section className="ink-section">
        <div className="ink-section__head">
          <div>
            <p className="ink-kicker">Feed</p>
            <h2 className="ink-h2 ink-section__title">论文订阅</h2>
          </div>
        </div>

        {!loading && papers.length === 0 ? (
          <div className="ink-empty">
            <p className="ink-empty__mark" aria-hidden="true">—</p>
            <p className="ink-h3">{actionError ? '暂时没有可显示的论文' : '还没有论文'}</p>
            <p className="ink-note">
              {actionError
                ? '上面的提示说明了失败原因；恢复后端连接后点「刷新订阅」重试。'
                : '先在上面添加研究关键词，然后点「刷新订阅」；也可以直接用「按关键词搜索」。'}
            </p>
          </div>
        ) : (
          <div className="ink-split">
            {papers.map((paper) => {
              const isNew =
                !!paper.published &&
                new Date(paper.published).getTime() > Date.now() - 7 * 24 * 60 * 60 * 1000;
              const summary = summaries[paperKey(paper)];
              return (
                <article className="ink-card" key={paperKey(paper)}>
                  <div className="ink-row" style={{ justifyContent: 'space-between' }}>
                    <p className="ink-card__title" style={{ flex: '1 1 220px' }}>
                      <a href={paperLink(paper)} target="_blank" rel="noopener noreferrer">
                        {paper.title}
                      </a>
                    </p>
                    {isNew && (
                      <span className="ink-flag" data-tone="info">
                        <span aria-hidden="true">◆</span>
                        <span>近 7 天</span>
                      </span>
                    )}
                  </div>

                  <p className="ink-list__meta">
                    {paper.authors && (
                      <span>
                        {paper.authors.split(',').slice(0, 3).join(', ')}
                        {paper.authors.split(',').length > 3 ? ' 等' : ''}
                      </span>
                    )}
                    {paper.year && <span>{paper.year}</span>}
                    {paper.citations !== undefined && paper.citations > 0 && (
                      <span>被引 {paper.citations}</span>
                    )}
                    {venueName(paper) && <span>{venueName(paper)}</span>}
                    {paper.published && <span>{timeAgo(paper.published)}</span>}
                    {paper.doi && <span>DOI {paper.doi}</span>}
                  </p>

                  {paper.summary && (
                    <p className="ink-note">
                      {paper.summary.slice(0, 280)}
                      {paper.summary.length > 280 ? '…' : ''}
                    </p>
                  )}

                  {summary ? (
                    <div className="ink-panel" style={{ borderLeft: '4px solid var(--dn-cyan)' }}>
                      <p className="ink-kicker">本地摘要</p>
                      <p className="ink-note" style={{ marginTop: 6, color: 'var(--dn-text-primary)' }}>
                        {summary}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        className="ink-btn ink-btn--sm"
                        onClick={() => summarizePaper(paper)}
                      >
                        用本地模型摘要
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
