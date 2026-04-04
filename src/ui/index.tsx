import React, { useState, useCallback } from "react";
import {
  usePluginData,
  usePluginAction,
  type PluginDetailTabProps,
} from "@paperclipai/plugin-sdk/ui";

// ---------------------------------------------------------------------------
// Types mirrored from worker
// ---------------------------------------------------------------------------

interface RegisteredFile {
  id: string;
  path: string;
  issueId: string;
  addedAt: string;
  addedBy: string;
  reviewStatus: "pending" | "approved" | "rejected";
  reviewedAt?: string;
  reviewedBy?: string;
  reviewNote?: string;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    padding: "16px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: "14px",
    color: "#e4e4e7",
  } as React.CSSProperties,
  heading: {
    fontSize: "16px",
    fontWeight: 600,
    marginBottom: "12px",
    color: "#fafafa",
  } as React.CSSProperties,
  fileList: {
    listStyle: "none",
    padding: 0,
    margin: 0,
  } as React.CSSProperties,
  fileItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 12px",
    marginBottom: "4px",
    borderRadius: "6px",
    backgroundColor: "#27272a",
    border: "1px solid #3f3f46",
  } as React.CSSProperties,
  filePath: {
    fontFamily: '"JetBrains Mono", monospace',
    fontSize: "13px",
    color: "#a1a1aa",
    overflow: "hidden" as const,
    textOverflow: "ellipsis" as const,
    whiteSpace: "nowrap" as const,
    flex: 1,
    marginRight: "12px",
  } as React.CSSProperties,
  badge: (status: string): React.CSSProperties => ({
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: "9999px",
    fontSize: "11px",
    fontWeight: 500,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    backgroundColor:
      status === "approved"
        ? "#14532d"
        : status === "rejected"
          ? "#7f1d1d"
          : "#44403c",
    color:
      status === "approved"
        ? "#4ade80"
        : status === "rejected"
          ? "#fca5a5"
          : "#d6d3d1",
  }),
  emptyState: {
    textAlign: "center" as const,
    padding: "32px 16px",
    color: "#71717a",
  } as React.CSSProperties,
  addForm: {
    display: "flex",
    gap: "8px",
    marginBottom: "16px",
  } as React.CSSProperties,
  input: {
    flex: 1,
    padding: "6px 10px",
    borderRadius: "6px",
    border: "1px solid #3f3f46",
    backgroundColor: "#18181b",
    color: "#e4e4e7",
    fontSize: "13px",
    fontFamily: '"JetBrains Mono", monospace',
    outline: "none",
  } as React.CSSProperties,
  button: {
    padding: "6px 14px",
    borderRadius: "6px",
    border: "none",
    backgroundColor: "#7c3aed",
    color: "#fff",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
  } as React.CSSProperties,
  buttonSmall: {
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid #3f3f46",
    backgroundColor: "transparent",
    color: "#a1a1aa",
    fontSize: "11px",
    cursor: "pointer",
    marginLeft: "4px",
  } as React.CSSProperties,
};

// ---------------------------------------------------------------------------
// FilesTab — the main exported component
// ---------------------------------------------------------------------------

export function FilesTab({ entityId }: PluginDetailTabProps) {
  const issueId = entityId;
  const [newPath, setNewPath] = useState("");

  const {
    data,
    loading,
    error,
    refetch,
  } = usePluginData<{ files: RegisteredFile[] }>("files", { issueId });

  const registerFile = usePluginAction("register-file");

  const handleAdd = useCallback(async () => {
    const trimmed = newPath.trim();
    if (!trimmed) return;
    try {
      await registerFile({ path: trimmed, issueId, addedBy: "ui-user" });
      setNewPath("");
      refetch();
    } catch (err) {
      console.error("Failed to register file:", err);
    }
  }, [newPath, issueId, registerFile, refetch]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleAdd();
    },
    [handleAdd],
  );

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Loading files...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.emptyState, color: "#fca5a5" }}>
          Error loading files: {String(error)}
        </div>
      </div>
    );
  }

  const files = data?.files ?? [];

  return (
    <div style={styles.container}>
      <div style={styles.heading}>Linked Files</div>

      {/* Add file form */}
      <div style={styles.addForm}>
        <input
          type="text"
          placeholder="Enter file path..."
          value={newPath}
          onChange={(e) => setNewPath(e.target.value)}
          onKeyDown={handleKeyDown}
          style={styles.input}
        />
        <button onClick={handleAdd} style={styles.button}>
          Add File
        </button>
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div style={styles.emptyState}>
          No files linked to this issue yet. Add a file path above.
        </div>
      ) : (
        <ul style={styles.fileList}>
          {files.map((file) => (
            <li key={file.id} style={styles.fileItem}>
              <span style={styles.filePath} title={file.path}>
                {file.path}
              </span>
              <span style={styles.badge(file.reviewStatus)}>
                {file.reviewStatus}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
