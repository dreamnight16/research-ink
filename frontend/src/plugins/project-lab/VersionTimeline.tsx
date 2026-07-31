interface Props {
  entityType: "project" | "experiment";
  entityId: string;
}

export function VersionTimeline(_: Props) {
  return (
    <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 0" }}>
      版本时间线功能即将在下一步实现
    </div>
  );
}
