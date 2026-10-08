import { useState, useEffect } from "react";
import { api } from "@/core/api";

interface Version {
  id: string;
  entity_type: string;
  entity_id: string;
  snapshot: Record<string, unknown>;
  change_summary: string;
  is_checkpoint: boolean;
  label: string;
  created_at: string;
}

interface Props {
  entityType: "project" | "experiment";
  entityId: string;
  experimentId?: string;
  onBack?: () => void;
}

const PinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 2.5L13.5 6 9 9.5 11.5 13H4.5L7 9.5 2.5 6 6 2.5A5.3 5.3 0 0 0 8 3.5 5.3 5.3 0 0 0 10 2.5Z" />
  </svg>
);

function formatTime(iso: string): string {
  const d = new Date(iso);
  const diffMin = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionTimeline({ entityType, entityId, experimentId, onBack }: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetType = experimentId ? "experiment" : entityType;
  const targetId = experimentId ?? entityId;

  const fetchVersions = async () => {
    const res = await api.get<{ success: boolean; data: Version[] }>(
      `/api/project-lab/versions?entity_type=${encodeURIComponent(
        targetType,
      )}&entity_id=${encodeURIComponent(targetId)}`,
    );
    setVersions(res.data);
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await api.get<{ success: boolean; data: Version[] }>(
          `/api/project-lab/versions?entity_type=${encodeURIComponent(
            targetType,
          )}&entity_id=${encodeURIComponent(targetId)}`,
        );
        if (!cancelled) setVersions(res.data);
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : "版本记录读取失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const handleCheckpoint = async () => {
    if (!checkpointLabel.trim()) return;
    setError(null);
    try {
      await api.post("/api/project-lab/versions", {
        entity_type: targetType,
        entity_id: targetId,
        label: checkpointLabel.trim(),
      });
      setCheckpointLabel("");
      setShowCheckpointInput(false);
      await fetchVersions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "创建快照失败");
    }
  };

  const handleRollback = async (versionId: string) => {
    setRollbackId(versionId);
    setError(null);
    try {
      await api.post(`/api/project-lab/versions/${versionId}/rollback`);
      setRollbackId(null);
      await fetchVersions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "回滚失败");
      setRollbackId(null);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);
    try {
      await fetchVersions();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "刷新失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ink-stack">
      <div className="ink-row" style={{ justifyContent: "space-between" }}>
        <div className="ink-row">
          {onBack && (
            <button type="button" className="ink-btn ink-btn--sm ink-btn--quiet" onClick={onBack}>
              ← 返回
            </button>
          )}
          <div>
            <p className="ink-kicker">Versions</p>
            <h2 className="ink-h2">版本历史 · {versions.length}</h2>
          </div>
        </div>
        <div className="ink-row">
          <button
            type="button"
            className="ink-btn"
            aria-expanded={showCheckpointInput}
            onClick={() => setShowCheckpointInput(!showCheckpointInput)}
          >
            <PinIcon />
            打快照
          </button>
          <button type="button" className="ink-btn" onClick={handleRefresh} disabled={loading}>
            {loading ? "刷新中…" : "刷新"}
          </button>
        </div>
      </div>

      {error && (
        <div className="ink-notice" data-tone="danger">
          <p className="ink-notice__title">版本操作未完成</p>
          <p>{error}</p>
        </div>
      )}

      {showCheckpointInput && (
        <div className="ink-row">
          <label className="ink-field" style={{ flex: "1 1 240px" }}>
            <span className="ink-label">快照名称</span>
            <input
              className="ink-input"
              type="text"
              placeholder="如：投稿前、中期检查"
              value={checkpointLabel}
              onChange={(e) => setCheckpointLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCheckpoint()}
              autoFocus
            />
          </label>
          <button
            type="button"
            className="ink-btn ink-btn--primary"
            onClick={handleCheckpoint}
            disabled={!checkpointLabel.trim()}
            style={{ alignSelf: "flex-end" }}
          >
            保存快照
          </button>
        </div>
      )}

      {loading ? (
        <p className="ink-note">正在读取版本记录…</p>
      ) : versions.length === 0 ? (
        <div className="ink-empty">
          <p className="ink-empty__mark" aria-hidden="true">—</p>
          <p className="ink-h3">还没有版本记录</p>
          <p className="ink-note">编辑内容后会自动产生版本记录；也可以手动打快照标记重要节点。</p>
        </div>
      ) : (
        <div className="ink-timeline">
          <span className="ink-timeline__line" aria-hidden="true" />
          {versions.map((v, i) => (
            <div
              key={v.id}
              className={[
                "ink-timeline__item",
                v.is_checkpoint ? "ink-timeline__item--checkpoint" : "",
                i === 0 ? "ink-timeline__item--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className="ink-timeline__marker" aria-hidden="true" />
              <div className="ink-list__main">
                <p className="ink-h3">{v.is_checkpoint ? v.label : v.change_summary || "内容变更"}</p>
                <p className="ink-list__meta">
                  <span>{v.is_checkpoint ? "手动快照" : "自动记录"}</span>
                  <span>{formatTime(v.created_at)}</span>
                </p>
              </div>
              <div className="ink-row">
                {i === 0 && (
                  <span className="ink-flag" data-tone="ok">
                    <span aria-hidden="true">●</span>
                    <span>当前版本</span>
                  </span>
                )}
                {i > 0 && (
                  <button
                    type="button"
                    className="ink-btn ink-btn--sm"
                    disabled={rollbackId === v.id}
                    onClick={() => {
                      if (window.confirm("确定要回滚到此版本吗？当前未保存的更改将丢失。")) {
                        handleRollback(v.id);
                      }
                    }}
                  >
                    {rollbackId === v.id ? "回滚中…" : "回滚到此"}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
