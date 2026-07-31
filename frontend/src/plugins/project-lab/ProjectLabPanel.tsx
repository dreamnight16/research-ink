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
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--red)",
          fontSize: 14,
        }}
      >
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Breadcrumb / View Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {selectedProject && (
            <button
              onClick={handleBackToProjects}
              style={{
                background: "none",
                border: "none",
                fontSize: 13,
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--text-primary)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              {"←"} 项目列表
            </button>
          )}
          {selectedProject && (
            <>
              <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                /
              </span>
              <span
                style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}
              >
                {selectedProject.title}
              </span>
            </>
          )}
          <div style={{ flex: 1 }} />
          {selectedProject && (
            <div style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => setViewMode("experiments")}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: viewMode === "experiments" ? 600 : 400,
                  background:
                    viewMode === "experiments"
                      ? "var(--accent)"
                      : "transparent",
                  color:
                    viewMode === "experiments"
                      ? "#fff"
                      : "var(--text-muted)",
                }}
              >
                实验记录
              </button>
              <button
                onClick={() => setViewMode("versions")}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: viewMode === "versions" ? 600 : 400,
                  background:
                    viewMode === "versions" ? "var(--accent)" : "transparent",
                  color:
                    viewMode === "versions" ? "#fff" : "var(--text-muted)",
                }}
              >
                版本历史
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: "auto", padding: 16 }}>
          {viewMode === "projects" && loading ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                color: "var(--text-muted)",
                fontSize: 14,
              }}
            >
              加载中...
            </div>
          ) : viewMode === "projects" ? (
            <ProjectList
              projects={projects}
              onSelect={handleSelectProject}
              onRefresh={fetchProjects}
            />
          ) : viewMode === "experiments" && selectedProject ? (
            <ExperimentEditor
              project={selectedProject}
              onUpdate={setSelectedProject}
            />
          ) : viewMode === "versions" && selectedProject ? (
            <VersionTimeline
              entityType="project"
              entityId={selectedProject.id}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};
