import { useState } from "react";
import { api } from "@/core/api";
import type { Project, Experiment } from "./ProjectLabPanel";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

/* ----- inline SVG icons ----- */

const PlusIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
  >
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
);

const TrashIcon = () => (
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
    <path d="M2.5 4h11M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6.5 4v8.5a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V4" />
  </svg>
);

const GripIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 16 16"
    fill="currentColor"
    opacity="0.35"
  >
    <circle cx="5" cy="3" r="1.2" />
    <circle cx="11" cy="3" r="1.2" />
    <circle cx="5" cy="8" r="1.2" />
    <circle cx="11" cy="8" r="1.2" />
    <circle cx="5" cy="13" r="1.2" />
    <circle cx="11" cy="13" r="1.2" />
  </svg>
);

/* ----- status maps ----- */

const STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  running: "进行中",
  completed: "已完成",
  failed: "失败",
};

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  draft: { bg: "var(--border-light)", color: "var(--text-muted)" },
  running: { bg: "#dbeafe", color: "#1d4ed8" },
  completed: { bg: "var(--green-bg)", color: "var(--green)" },
  failed: { bg: "var(--red-bg)", color: "var(--red)" },
};

/* ----- shared styles ----- */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 10px",
  fontSize: 13,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--bg-input)",
  color: "var(--text-primary)",
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: "none",
  fontFamily: "inherit",
};

export function ExperimentEditor({ project, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      const res = await api.post<{ success: boolean; data: Experiment }>(
        `/api/project-lab/projects/${project.id}/experiments`,
        { title: "新实验" },
      );
      const exp = res.data;
      onUpdate({ ...project, experiments: [...project.experiments, exp] });
      setEditingId(exp.id);
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (exp: Experiment) => {
    setSaving(true);
    try {
      const res = await api.put<{ success: boolean; data: Experiment }>(
        `/api/project-lab/projects/${project.id}/experiments/${exp.id}`,
        {
          title: exp.title,
          method: exp.method,
          params: exp.params ?? {},
          result: exp.result,
          conclusion: exp.conclusion,
        },
      );
      onUpdate({
        ...project,
        experiments: project.experiments.map((e) =>
          e.id === exp.id ? res.data : e,
        ),
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expId: string) => {
    try {
      await api.del(
        `/api/project-lab/projects/${project.id}/experiments/${expId}`,
      );
      onUpdate({
        ...project,
        experiments: project.experiments.filter((e) => e.id !== expId),
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Delete failed";
      // eslint-disable-next-line no-console
      console.error("Failed to delete experiment:", msg);
    }
  };

  const updateExperiment = (id: string, field: string, value: string) => {
    onUpdate({
      ...project,
      experiments: project.experiments.map((e) =>
        e.id === id ? { ...e, [field]: value } : e,
      ),
    });
  };

  const accentButtonStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "6px 14px",
    fontSize: 13,
    fontWeight: 500,
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    whiteSpace: "nowrap",
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
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {project.title} — {"实验记录"}
        </h2>
        <button
          onClick={handleCreate}
          disabled={saving}
          style={{
            ...accentButtonStyle,
            opacity: saving ? 0.6 : 1,
            cursor: saving ? "not-allowed" : "pointer",
          }}
        >
          <PlusIcon />
          {"新建实验"}
        </button>
      </div>

      {/* Empty state */}
      {project.experiments.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            padding: "48px 0",
            fontSize: 14,
          }}
        >
          {"还没有实验，点击「新建实验」开始记录"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {project.experiments.map((exp) => {
            const isEditing = editingId === exp.id;
            const statusStyle =
              STATUS_STYLES[exp.status] || STATUS_STYLES.draft;

            return (
              <div
                key={exp.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--bg-card)",
                  overflow: "hidden",
                }}
              >
                {/* Accordion header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 16px",
                    cursor: "pointer",
                    background: isEditing
                      ? "var(--bg-card-hover)"
                      : "transparent",
                    transition: "background var(--transition)",
                  }}
                  onClick={() => setEditingId(isEditing ? null : exp.id)}
                  onMouseEnter={(e) => {
                    if (!isEditing)
                      e.currentTarget.style.background =
                        "var(--bg-card-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isEditing)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      color: "var(--text-muted)",
                      flexShrink: 0,
                    }}
                  >
                    <GripIcon />
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {exp.title}
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      padding: "2px 10px",
                      borderRadius: 12,
                      fontWeight: 500,
                      background: statusStyle.bg,
                      color: statusStyle.color,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {STATUS_LABELS[exp.status] || exp.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(exp.id);
                    }}
                    style={{
                      padding: 4,
                      color: "var(--text-muted)",
                      cursor: "pointer",
                      background: "none",
                      border: "none",
                      display: "flex",
                      alignItems: "center",
                      borderRadius: "var(--radius-sm)",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "var(--red)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "var(--text-muted)";
                    }}
                    title={"删除实验"}
                  >
                    <TrashIcon />
                  </button>
                </div>

                {/* Expanded editor */}
                {isEditing && (
                  <div
                    style={{
                      padding: "12px 16px 16px 16px",
                      borderTop: "1px solid var(--border)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {/* Title */}
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {"标题"}
                      </label>
                      <input
                        type="text"
                        value={exp.title}
                        onChange={(e) =>
                          updateExperiment(exp.id, "title", e.target.value)
                        }
                        style={inputStyle}
                      />
                    </div>
                    {/* Method */}
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {"方法/方案"}
                      </label>
                      <textarea
                        value={exp.method}
                        onChange={(e) =>
                          updateExperiment(exp.id, "method", e.target.value)
                        }
                        rows={3}
                        style={{ ...textareaStyle, minHeight: 60 }}
                      />
                    </div>
                    {/* Result */}
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {"结果/观察"}
                      </label>
                      <textarea
                        value={exp.result}
                        onChange={(e) =>
                          updateExperiment(exp.id, "result", e.target.value)
                        }
                        rows={2}
                        style={textareaStyle}
                      />
                    </div>
                    {/* Conclusion */}
                    <div>
                      <label
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          display: "block",
                          marginBottom: 4,
                        }}
                      >
                        {"结论/分析"}
                      </label>
                      <textarea
                        value={exp.conclusion}
                        onChange={(e) =>
                          updateExperiment(
                            exp.id,
                            "conclusion",
                            e.target.value,
                          )
                        }
                        rows={2}
                        style={textareaStyle}
                      />
                    </div>
                    {/* Actions */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 8,
                        paddingTop: 8,
                      }}
                    >
                      <button
                        onClick={() => setEditingId(null)}
                        style={{
                          padding: "6px 14px",
                          fontSize: 13,
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          background: "none",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color =
                            "var(--text-primary)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "var(--text-muted)";
                        }}
                      >
                        {"取消"}
                      </button>
                      <button
                        onClick={() => handleSave(exp)}
                        disabled={saving}
                        style={{
                          padding: "6px 14px",
                          fontSize: 13,
                          fontWeight: 500,
                          background: "var(--accent)",
                          color: "#fff",
                          border: "none",
                          borderRadius: "var(--radius-sm)",
                          cursor: saving ? "not-allowed" : "pointer",
                          opacity: saving ? 0.6 : 1,
                        }}
                      >
                        {saving
                          ? "保存中..."
                          : "保存"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
