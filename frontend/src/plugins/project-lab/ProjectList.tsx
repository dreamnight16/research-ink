import { useState } from "react";
import { api } from "@/core/api";
import { useDetailLayer } from "@/shared/useDetailLayer";
import type { Project } from "./ProjectLabPanel";

const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  active: { label: "进行中", tone: "ok" },
  paused: { label: "已暂停", tone: "warn" },
  completed: { label: "已完成", tone: "info" },
  archived: { label: "已归档", tone: "neutral" },
};

interface Props {
  projects: Project[];
  onSelect: (project: Project) => void;
  onRefresh: () => void;
}

export function ProjectList({ projects, onSelect, onRefresh }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createLayer = useDetailLayer(showCreate, () => setShowCreate(false));

  const filtered = projects.filter((p) => {
    if (search && !p.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (statusFilter && p.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await api.projectLab.createProject({ title: newTitle.trim() });
      setNewTitle("");
      setShowCreate(false);
      onRefresh();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="ink-stack">
      <div className="ink-row">
        <label className="ink-field" style={{ flex: "1 1 200px", maxWidth: 280 }}>
          <span className="ink-label">搜索</span>
          <input
            className="ink-input"
            type="text"
            placeholder="按项目名称搜索"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="ink-field" style={{ flex: "0 1 180px" }}>
          <span className="ink-label">状态</span>
          <select
            className="ink-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">全部状态</option>
            <option value="active">进行中</option>
            <option value="paused">已暂停</option>
            <option value="completed">已完成</option>
            <option value="archived">已归档</option>
          </select>
        </label>
        <button
          type="button"
          className="ink-btn ink-btn--primary"
          onClick={() => setShowCreate(true)}
          style={{ alignSelf: "flex-end" }}
        >
          新建项目
        </button>
      </div>

      {showCreate && (
        <div className="ink-scrim ink-scrim--center">
          <div
            className="ink-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            tabIndex={-1}
            ref={createLayer}
          >
            <div>
              <p className="ink-kicker">New Project</p>
              <h2 className="ink-h2" id="create-project-title">新建研究项目</h2>
            </div>

            {createError && (
              <div className="ink-notice" data-tone="danger">
                <p className="ink-notice__title">创建失败</p>
                <p>{createError}</p>
              </div>
            )}

            <label className="ink-field">
              <span className="ink-label">项目名称</span>
              <input
                className="ink-input"
                type="text"
                placeholder="项目名称"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </label>

            <div className="ink-row ink-row--end">
              <button type="button" className="ink-btn ink-btn--ghost" onClick={() => setShowCreate(false)}>
                取消（Esc）
              </button>
              <button
                type="button"
                className="ink-btn ink-btn--primary"
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? "创建中…" : "创建"}
              </button>
            </div>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="ink-empty">
          <p className="ink-empty__mark" aria-hidden="true">—</p>
          <p className="ink-h3">{projects.length === 0 ? "还没有项目" : "没有匹配的项目"}</p>
          <p className="ink-note">
            {projects.length === 0
              ? "点「新建项目」记录你的第一个研究项目。"
              : "换一个搜索词或把状态筛选改回全部。"}
          </p>
        </div>
      ) : (
        <div className="ink-split">
          {filtered.map((project) => {
            const status = STATUS_LABELS[project.status] ?? {
              label: project.status,
              tone: "neutral",
            };
            return (
              <button
                key={project.id}
                type="button"
                className="ink-card dn-interactive"
                onClick={() => onSelect(project)}
              >
                <span className="ink-row" style={{ justifyContent: "space-between" }}>
                  <span className="ink-flag" data-tone={status.tone}>
                    <span>{status.label}</span>
                  </span>
                  <span className="ink-num ink-note" style={{ fontSize: "1rem" }}>
                    {project.experiments?.length ?? 0} 个实验
                  </span>
                </span>
                <span className="ink-card__title">{project.title}</span>
                {project.discipline && <span className="ink-note">{project.discipline}</span>}
                <span className="ink-list__meta">
                  <span>更新于 {new Date(project.updated_at).toLocaleString("zh-CN")}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
