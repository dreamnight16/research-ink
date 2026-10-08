import React, { useState, useEffect, useCallback } from "react";
import { ProjectList } from "./ProjectList";
import { ExperimentEditor } from "./ExperimentEditor";
import { VersionTimeline } from "./VersionTimeline";
import { api } from "@/core/api";

export interface Project {
  id: string;
  title: string;
  discipline: string;
  description: string;
  status: "active" | "paused" | "completed" | "archived";
  tags: string[];
  experiments: Experiment[];
  created_at: string;
  updated_at: string;
}

export interface Experiment {
  id: string;
  project_id: string;
  title: string;
  method: string;
  params: Record<string, unknown>;
  result: string;
  conclusion: string;
  attachments: string[];
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ViewMode = "projects" | "experiments" | "versions";

export const ProjectLabPanel: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.projectLab.listProjects();
      setProjects((res.data as Project[]) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleSelectProject = async (project: Project) => {
    try {
      const res = await api.projectLab.getProject(project.id);
      setSelectedProject(res.data as Project);
      setViewMode("experiments");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load project");
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setViewMode("projects");
    fetchProjects();
  };

  if (error) {
    return (
      <div className="ink-notice" data-tone="danger">
        <p className="ink-notice__title">项目实验室无法加载</p>
        <p>
          无法从本机后端 127.0.0.1:8000 读取项目列表。这不是「没有项目」，
          而是这次请求失败了，下面的「重新加载」可以重试。
        </p>
        <p className="ink-note ink-note--sm">后端返回：{error}</p>
        <div className="ink-row">
          <button type="button" className="ink-btn ink-btn--sm" onClick={fetchProjects}>
            重新加载
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ink-stack" style={{ gap: 24 }}>
      {/* 上下文条：始终说明当前在哪一层，返回路径可见 */}
      <div className="ink-section__head">
        <nav className="ink-row" aria-label="当前位置">
          {selectedProject ? (
            <>
              <button type="button" className="ink-btn ink-btn--sm ink-btn--quiet" onClick={handleBackToProjects}>
                ← 项目列表
              </button>
              <span className="ink-note ink-note--sm" aria-hidden="true">/</span>
              <span className="ink-h3">{selectedProject.title}</span>
            </>
          ) : (
            <>
              <span className="ink-kicker">Scope</span>
              <span className="ink-h3">全部项目</span>
              <span className="ink-num ink-note" style={{ fontSize: "1rem" }}>
                {loading ? "…" : projects.length}
              </span>
            </>
          )}
        </nav>

        {selectedProject && (
          <div className="ink-seg" role="group" aria-label="项目视图">
            <button
              type="button"
              className="ink-seg__opt"
              aria-pressed={viewMode === "experiments"}
              onClick={() => setViewMode("experiments")}
            >
              实验记录
            </button>
            <button
              type="button"
              className="ink-seg__opt"
              aria-pressed={viewMode === "versions"}
              onClick={() => setViewMode("versions")}
            >
              版本历史
            </button>
          </div>
        )}
      </div>

      {viewMode === "projects" && loading ? (
        <p className="ink-note">正在从本机后端读取项目…</p>
      ) : viewMode === "projects" ? (
        <ProjectList projects={projects} onSelect={handleSelectProject} onRefresh={fetchProjects} />
      ) : viewMode === "experiments" && selectedProject ? (
        <ExperimentEditor project={selectedProject} onUpdate={setSelectedProject} />
      ) : viewMode === "versions" && selectedProject ? (
        <VersionTimeline entityType="project" entityId={selectedProject.id} />
      ) : null}
    </div>
  );
};
