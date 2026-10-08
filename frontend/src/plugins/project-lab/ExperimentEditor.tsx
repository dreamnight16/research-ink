import { useState } from "react";
import { api } from "@/core/api";
import type { Project, Experiment } from "./ProjectLabPanel";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

/* ----- inline SVG icons ----- */

const PlusIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="8" y1="3" x2="8" y2="13" />
    <line x1="3" y1="8" x2="13" y2="8" />
  </svg>
);

const TrashIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2.5 4h11M5.5 4V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1M6.5 4v8.5a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1V4" />
  </svg>
);

const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"
    style={{ transform: open ? "rotate(90deg)" : "none" }}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
);

/* ----- status maps：状态同时用文字与色条表达 ----- */

const STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "草稿", tone: "neutral" },
  running: { label: "进行中", tone: "info" },
  completed: { label: "已完成", tone: "ok" },
  failed: { label: "失败", tone: "error" },
};

export function ExperimentEditor({ project, onUpdate }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ success: boolean; data: Experiment }>(
        `/api/project-lab/projects/${project.id}/experiments`,
        { title: "新实验" },
      );
      const exp = res.data;
      onUpdate({ ...project, experiments: [...project.experiments, exp] });
      setEditingId(exp.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "新建实验失败");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (exp: Experiment) => {
    setSaving(true);
    setError(null);
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
        experiments: project.experiments.map((e) => (e.id === exp.id ? res.data : e)),
      });
      setEditingId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expId: string) => {
    try {
      await api.del(`/api/project-lab/projects/${project.id}/experiments/${expId}`);
      onUpdate({
        ...project,
        experiments: project.experiments.filter((e) => e.id !== expId),
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "删除失败");
    }
  };

  const updateExperiment = (id: string, field: string, value: string) => {
    onUpdate({
      ...project,
      experiments: project.experiments.map((e) => (e.id === id ? { ...e, [field]: value } : e)),
    });
  };

  return (
    <div className="ink-stack">
      <div className="ink-row" style={{ justifyContent: "space-between" }}>
        <div>
          <p className="ink-kicker">Experiments</p>
          <h2 className="ink-h2">实验记录 · {project.experiments.length}</h2>
        </div>
        <button
          type="button"
          className="ink-btn ink-btn--primary"
          onClick={handleCreate}
          disabled={saving}
        >
          <PlusIcon />
          新建实验
        </button>
      </div>

      {error && (
        <div className="ink-notice" data-tone="danger">
          <p className="ink-notice__title">操作未完成</p>
          <p>{error}</p>
        </div>
      )}

      {project.experiments.length === 0 ? (
        <div className="ink-empty">
          <p className="ink-empty__mark" aria-hidden="true">—</p>
          <p className="ink-h3">还没有实验记录</p>
          <p className="ink-note">点「新建实验」记录每一次尝试与发现，保存时会自动留下版本。</p>
        </div>
      ) : (
        <div
          className="ink-stack ink-stack--tight"
          onKeyDown={(e) => {
            if (e.key === "Escape" && editingId) setEditingId(null);
          }}
        >
          {project.experiments.map((exp) => {
            const isEditing = editingId === exp.id;
            const status = STATUS[exp.status] ?? STATUS.draft;

            return (
              <div className="ink-accordion" key={exp.id} data-tool="project-lab">
                <div className="ink-row" style={{ gap: 0 }}>
                  <button
                    type="button"
                    className="ink-accordion__head"
                    aria-expanded={isEditing}
                    aria-controls={`exp-body-${exp.id}`}
                    onClick={() => setEditingId(isEditing ? null : exp.id)}
                  >
                    <ChevronIcon open={isEditing} />
                    <span className="ink-accordion__title">{exp.title}</span>
                    <span className="ink-flag" data-tone={status.tone}>
                      <span>{status.label}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="ink-btn ink-btn--sm ink-btn--quiet"
                    onClick={() => handleDelete(exp.id)}
                    aria-label={`删除实验 ${exp.title}`}
                    title="删除实验"
                  >
                    <TrashIcon />
                  </button>
                </div>

                {isEditing && (
                  <div className="ink-accordion__body" id={`exp-body-${exp.id}`}>
                    <label className="ink-field">
                      <span className="ink-label">标题</span>
                      <input
                        className="ink-input"
                        type="text"
                        value={exp.title}
                        onChange={(e) => updateExperiment(exp.id, "title", e.target.value)}
                        placeholder="实验名称"
                      />
                    </label>

                    <label className="ink-field">
                      <span className="ink-label">方法 / 方案</span>
                      <textarea
                        className="ink-textarea"
                        value={exp.method}
                        onChange={(e) => updateExperiment(exp.id, "method", e.target.value)}
                        rows={3}
                        placeholder="实验方案、使用的方法、工具或流程"
                      />
                    </label>

                    <label className="ink-field">
                      <span className="ink-label">结果 / 观察</span>
                      <textarea
                        className="ink-textarea"
                        value={exp.result}
                        onChange={(e) => updateExperiment(exp.id, "result", e.target.value)}
                        rows={2}
                        placeholder="实验观察到的现象、数据或输出"
                      />
                    </label>

                    <label className="ink-field">
                      <span className="ink-label">结论 / 分析</span>
                      <textarea
                        className="ink-textarea"
                        value={exp.conclusion}
                        onChange={(e) => updateExperiment(exp.id, "conclusion", e.target.value)}
                        rows={2}
                        placeholder="从结果中得出的结论、分析或下一步计划"
                      />
                    </label>

                    <div className="ink-row ink-row--end">
                      <button
                        type="button"
                        className="ink-btn ink-btn--ghost"
                        onClick={() => setEditingId(null)}
                      >
                        取消（Esc）
                      </button>
                      <button
                        type="button"
                        className="ink-btn ink-btn--primary"
                        onClick={() => handleSave(exp)}
                        disabled={saving}
                      >
                        {saving ? "保存中…" : "保存"}
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
