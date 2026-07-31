import { useState } from "react";
import { api } from "@/core/api";
import type { Project } from "./ProjectLabPanel";

const STATUS_DOT_COLORS: Record<string, string> = {
  active: "var(--green)",
  paused: "var(--amber)",
  completed: "var(--accent)",
  archived: "var(--text-muted)",
};

const STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  paused: "已暂停",
  completed: "已完成",
  archived: "已归档",
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
    try {
      await api.projectLab.createProject({ title: newTitle.trim() });
      setNewTitle("");
      setShowCreate(false);
      onRefresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Create failed";
      // eslint-disable-next-line no-console
      console.error("Failed to create project:", msg);
    } finally {
      setCreating(false);
    }
  };

  const toolbarStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  };

  const inputBaseStyle: React.CSSProperties = {
    fontSize: 13,
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-input)",
    color: "var(--text-primary)",
    padding: "6px 10px",
    outline: "none",
  };

  const createModal = showCreate && (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.3)",
      }}
      onClick={() => setShowCreate(false)}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          width: 380,
          boxShadow: "var(--shadow-lg)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            fontSize: 16,
            fontWeight: 600,
            marginBottom: 16,
            color: "var(--text-primary)",
          }}
        >
          新建研究项目
        </h3>
        <input
          type="text"
          placeholder="项目名称"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          style={{ ...inputBaseStyle, width: "100%", marginBottom: 16, padding: "8px 12px" }}
          autoFocus
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={() => setShowCreate(false)}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              borderRadius: "var(--radius-sm)",
            }}
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={!newTitle.trim() || creating}
            style={{
              padding: "6px 14px",
              fontSize: 13,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: !newTitle.trim() || creating ? "not-allowed" : "pointer",
              opacity: !newTitle.trim() || creating ? 0.5 : 1,
            }}
          >
            {creating ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ position: "relative", flex: 1, maxWidth: 240 }}>
          <input
            type="text"
            placeholder="搜索项目..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              ...inputBaseStyle,
              width: "100%",
              paddingLeft: 10,
              paddingRight: 10,
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={inputBaseStyle}
        >
          <option value="">全部状态</option>
          <option value="active">进行中</option>
          <option value="paused">已暂停</option>
          <option value="completed">已完成</option>
          <option value="archived">已归档</option>
        </select>
        <button
          onClick={() => setShowCreate(true)}
          style={{
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
          }}
        >
          + 新建项目
        </button>
      </div>

      {/* Create Modal */}
      {createModal}

      {/* Content */}
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            color: "var(--text-muted)",
            padding: "64px 0",
            fontSize: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div style={{
            fontSize: 40,
            lineHeight: 1,
            opacity: 0.3,
            fontFamily: "var(--font-serif)",
          }}>
            {projects.length === 0 ? "⚗️" : "🔍"}
          </div>
          <div>
            {projects.length === 0
              ? "还没有项目，点击「新建项目」开始你的研究之旅"
              : "没有匹配的项目"}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: 12,
          }}
        >
          {filtered.map((project) => (
            <button
              key={project.id}
              onClick={() => onSelect(project)}
              style={{
                textAlign: "left",
                padding: 16,
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                background: "var(--bg-card)",
                cursor: "pointer",
                transition: "all var(--transition)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-border)";
                e.currentTarget.style.boxShadow = "var(--shadow-sm)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background:
                      STATUS_DOT_COLORS[project.status] || "var(--text-muted)",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                  }}
                >
                  {STATUS_LABELS[project.status] || project.status}
                </span>
              </div>
              <h3
                style={{
                  fontWeight: 500,
                  fontSize: 14,
                  marginBottom: 4,
                  color: "var(--text-primary)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {project.title}
              </h3>
              {project.discipline && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  {project.discipline}
                </span>
              )}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 8,
                  fontSize: 12,
                  color: "var(--text-muted)",
                }}
              >
                <span>
                  {(project.experiments?.length ?? 0)} 个实验
                </span>
                <span>
                  更新于{" "}
                  {new Date(project.updated_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
