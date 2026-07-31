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

/* ----- inline SVG icons ----- */

const PinIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 2.5L13.5 6 9 9.5 11.5 13H4.5L7 9.5 2.5 6 6 2.5A5.3 5.3 0 0 0 8 3.5 5.3 5.3 0 0 0 10 2.5Z" />
  </svg>
);

const CommitIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
  >
    <circle cx="8" cy="8" r="2" />
    <line x1="1" y1="8" x2="6" y2="8" />
    <line x1="10" y1="8" x2="15" y2="8" />
  </svg>
);

/* ----- helpers ----- */

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  return d.toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VersionTimeline({
  entityType,
  entityId,
  experimentId,
  onBack,
}: Props) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkpointLabel, setCheckpointLabel] = useState("");
  const [showCheckpointInput, setShowCheckpointInput] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);

  const targetType = experimentId ? "experiment" : entityType;
  const targetId = experimentId ?? entityId;

  useEffect(() => {
    let cancelled = false;
    const fetchVersions = async () => {
      setLoading(true);
      try {
        const res = await api.get<{ success: boolean; data: Version[] }>(
          `/api/project-lab/versions?entity_type=${encodeURIComponent(
            targetType,
          )}&entity_id=${encodeURIComponent(targetId)}`,
        );
        if (!cancelled) setVersions(res.data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchVersions();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  const handleCheckpoint = async () => {
    if (!checkpointLabel.trim()) return;
    try {
      await api.post("/api/project-lab/versions", {
        entity_type: targetType,
        entity_id: targetId,
        label: checkpointLabel.trim(),
      });
      setCheckpointLabel("");
      setShowCheckpointInput(false);
      // Refresh versions
      const res = await api.get<{ success: boolean; data: Version[] }>(
        `/api/project-lab/versions?entity_type=${encodeURIComponent(
          targetType,
        )}&entity_id=${encodeURIComponent(targetId)}`,
      );
      setVersions(res.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Checkpoint failed";
      // eslint-disable-next-line no-console
      console.error("Failed to create checkpoint:", msg);
    }
  };

  const handleRollback = async (versionId: string) => {
    setRollbackId(versionId);
    try {
      await api.post(`/api/project-lab/versions/${versionId}/rollback`);
      setRollbackId(null);
      // Refresh versions
      const res = await api.get<{ success: boolean; data: Version[] }>(
        `/api/project-lab/versions?entity_type=${encodeURIComponent(
          targetType,
        )}&entity_id=${encodeURIComponent(targetId)}`,
      );
      setVersions(res.data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Rollback failed";
      // eslint-disable-next-line no-console
      console.error("Rollback failed:", msg);
      setRollbackId(null);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: Version[] }>(
        `/api/project-lab/versions?entity_type=${encodeURIComponent(
          targetType,
        )}&entity_id=${encodeURIComponent(targetId)}`,
      );
      setVersions(res.data);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          color: "var(--text-muted)",
          padding: "48px 0",
          fontSize: 14,
        }}
      >
        {"加载中..."}
      </div>
    );
  }

  const accentButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    fontSize: 13,
    fontWeight: 500,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 12px",
    fontSize: 13,
    color: "var(--text-primary)",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onBack && (
            <button
              onClick={onBack}
              style={{
                fontSize: 13,
                color: "var(--text-muted)",
                cursor: "pointer",
                background: "none",
                border: "none",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {"← 返回"}
            </button>
          )}
          <h2
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {"版本历史"}
          </h2>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            ({versions.length})
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowCheckpointInput(!showCheckpointInput)}
            style={secondaryButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <PinIcon />
            {"打快照"}
          </button>
          <button
            onClick={handleRefresh}
            style={secondaryButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg-card-hover)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {"刷新"}
          </button>
        </div>
      </div>

      {/* Checkpoint input */}
      {showCheckpointInput && (
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            placeholder={"快照名称（如：投稿前、中期检查）"}
            value={checkpointLabel}
            onChange={(e) => setCheckpointLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCheckpoint()}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 13,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              outline: "none",
            }}
            autoFocus
          />
          <button
            onClick={handleCheckpoint}
            disabled={!checkpointLabel.trim()}
            style={{
              ...accentButtonStyle,
              opacity: !checkpointLabel.trim() ? 0.5 : 1,
              cursor: !checkpointLabel.trim()
                ? "not-allowed"
                : "pointer",
            }}
          >
            {"保存"}
          </button>
        </div>
      )}

      {/* Empty state */}
      {versions.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            padding: "48px 0",
            fontSize: 14,
          }}
        >
          {"还没有版本记录，编辑内容后自动产生"}
        </div>
      ) : (
        <div style={{ position: "relative" }}>
          {/* Vertical timeline line */}
          <div
            style={{
              position: "absolute",
              left: 15,
              top: 8,
              bottom: 8,
              width: 2,
              background: "var(--border)",
            }}
          />

          <div>
            {versions.map((v, i) => (
              <div
                key={v.id}
                style={{
                  position: "relative",
                  display: "flex",
                  gap: 16,
                  paddingBottom: 16,
                  paddingLeft: 36,
                }}
              >
                {/* Timeline dot */}
                <div
                  style={{
                    position: "absolute",
                    left: 11,
                    top: 8,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    border: "2px solid var(--bg-card)",
                    background: v.is_checkpoint
                      ? "#f97316"
                      : "var(--text-muted)",
                    zIndex: 1,
                  }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 2,
                    }}
                  >
                    {v.is_checkpoint ? (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          color: "#f97316",
                          flexShrink: 0,
                        }}
                      >
                        <PinIcon />
                      </span>
                    ) : (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          color: "var(--text-muted)",
                          flexShrink: 0,
                        }}
                      >
                        <CommitIcon />
                      </span>
                    )}
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {v.is_checkpoint ? v.label : v.change_summary}
                    </span>
                    {i === 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          padding: "1px 6px",
                          borderRadius: 8,
                          background: "var(--green-bg)",
                          color: "var(--green)",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {"当前"}
                      </span>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: "var(--text-muted)",
                    }}
                  >
                    {formatTime(v.created_at)}
                  </span>
                  {i > 0 && (
                    <button
                      onClick={() => handleRollback(v.id)}
                      disabled={rollbackId === v.id}
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: "var(--accent)",
                        cursor:
                          rollbackId === v.id
                            ? "not-allowed"
                            : "pointer",
                        background: "none",
                        border: "none",
                        padding: 0,
                        opacity: rollbackId === v.id ? 0.5 : 1,
                        textDecoration: "underline",
                      }}
                      onMouseEnter={(e) => {
                        if (rollbackId !== v.id)
                          e.currentTarget.style.color = "#92400e";
                      }}
                      onMouseLeave={(e) => {
                        if (rollbackId !== v.id)
                          e.currentTarget.style.color =
                            "var(--accent)";
                      }}
                    >
                      {rollbackId === v.id
                        ? "回滚中..."
                        : "回滚到此"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
