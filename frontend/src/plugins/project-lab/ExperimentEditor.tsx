import type { Project } from "./ProjectLabPanel";

interface Props {
  project: Project;
  onUpdate: (project: Project) => void;
}

export function ExperimentEditor(_: Props) {
  return (
    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0" }}>
      实验记录功能即将在下一步实现
    </div>
  );
}
