import { useState, useCallback } from "react";
import {
  usePluginData,
  usePluginAction,
  type PluginPageProps,
  type PluginSidebarProps,
} from "@paperclipai/plugin-sdk/ui";

// ── Sidebar nav link ───────────────────────────────────────────────────────

export function FileViewerSidebar({ context }: PluginSidebarProps) {
  const href = `/${context.companyPrefix}/file-viewer`;
  const isActive = typeof window !== "undefined" && window.location.pathname === href;
  return (
    <a
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors",
        isActive
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <line x1="10" y1="9" x2="8" y2="9" />
      </svg>
      <span>File Viewer</span>
    </a>
  );
}

// ── Types (matches the running file-viewer server API) ─────────────────────

type FileRecord = {
  id: string;
  name: string;
  path: string;
  file_type: "text" | "image";
  content: string | null;
  linked_issue_id: string | null;
  linked_task_id: string | null;
  review_status: "pending" | "approved" | "changes_requested" | "rejected";
  flagged_for_review: number;
  creating_agent_id: string | null;
  created_at: string;
  updated_at: string;
  reviews?: ReviewRecord[];
};

type ReviewRecord = {
  id: string;
  action: string;
  note: string | null;
  created_at: string;
};

type FilesData = { files: FileRecord[]; total: number };

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:        { display: "flex", flexDirection: "column", height: "100%", fontFamily: "inherit", fontSize: 14 },
  topbar:      { display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 48, borderBottom: "1px solid var(--border, #e2e8f0)", flexShrink: 0 },
  title:       { fontWeight: 700, fontSize: 15 },
  tabs:        { display: "flex", gap: 4, marginLeft: "auto" },
  tab:         { background: "none", border: "none", cursor: "pointer", padding: "4px 12px", borderRadius: 6, fontSize: 13, color: "var(--muted-foreground, #64748b)" },
  tabActive:   { background: "var(--accent, #f1f5f9)", color: "var(--foreground, #0f172a)", fontWeight: 600 },
  body:        { display: "flex", flex: 1, overflow: "hidden" },
  sidebar:     { width: 300, flexShrink: 0, borderRight: "1px solid var(--border, #e2e8f0)", display: "flex", flexDirection: "column", overflow: "hidden" },
  sHead:       { padding: "10px 12px", borderBottom: "1px solid var(--border, #e2e8f0)" },
  search:      { width: "100%", padding: "6px 10px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 6, fontSize: 13, background: "transparent", color: "inherit", boxSizing: "border-box" as const },
  list:        { flex: 1, overflowY: "auto" as const },
  item:        { padding: "9px 12px", cursor: "pointer", borderBottom: "1px solid var(--border, #e2e8f0)", display: "flex", flexDirection: "column", gap: 2 },
  itemSel:     { background: "var(--accent, #f1f5f9)" },
  iName:       { fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  iPath:       { fontSize: 11, color: "var(--muted-foreground, #64748b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  iMeta:       { display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center" },
  content:     { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  placeholder: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground, #64748b)", fontSize: 13 },
  fileView:    { display: "flex", flex: 1, overflow: "hidden" },
  fileBody:    { flex: 1, overflow: "auto", padding: 20 },
  fileSide:    { width: 260, flexShrink: 0, borderLeft: "1px solid var(--border, #e2e8f0)", padding: 16, overflowY: "auto" as const, display: "flex", flexDirection: "column", gap: 10 },
  pre:         { background: "var(--muted, #f8fafc)", border: "1px solid var(--border, #e2e8f0)", borderRadius: 6, padding: 16, fontSize: 12, overflowX: "auto" as const, whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const, lineHeight: 1.6 },
  mLabel:      { fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--muted-foreground, #64748b)", marginBottom: 2 },
  mValue:      { fontSize: 13 },
  btn:         { padding: "7px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%" },
  divider:     { border: "none", borderTop: "1px solid var(--border, #e2e8f0)", margin: "4px 0" },
  empty:       { padding: "32px 12px", textAlign: "center" as const, color: "var(--muted-foreground, #64748b)", fontSize: 13 },
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:           { bg: "#fef9c3", color: "#854d0e" },
  approved:          { bg: "#dcfce7", color: "#166534" },
  changes_requested: { bg: "#ffedd5", color: "#9a3412" },
  rejected:          { bg: "#fee2e2", color: "#991b1b" },
};

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return <span style={{ display: "inline-block", padding: "1px 7px", borderRadius: 4, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", background: bg, color }}>{label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLE[status] ?? { bg: "#f1f5f9", color: "#475569" };
  return <Badge label={status.replace("_", " ")} bg={st.bg} color={st.color} />;
}

function FileItem({ file, selected, onClick }: { file: FileRecord; selected: boolean; onClick: () => void }) {
  return (
    <div style={{ ...s.item, ...(selected ? s.itemSel : {}) }} onClick={onClick}>
      <div style={s.iName}>{file.name}</div>
      <div style={s.iPath}>{file.path}</div>
      <div style={s.iMeta}>
        <StatusBadge status={file.review_status} />
        {file.flagged_for_review ? <Badge label="Flagged" bg="#ede9fe" color="#5b21b6" /> : null}
        {file.linked_issue_id ? <span style={{ fontSize: 11, color: "var(--muted-foreground, #64748b)" }}>{file.linked_issue_id}</span> : null}
      </div>
    </div>
  );
}

export function FileViewerPage({ context }: PluginPageProps) {
  const [tab, setTab]               = useState<"queue" | "all">("queue");
  const [search, setSearch]         = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pending, setPending]       = useState<string | null>(null);
  const [note, setNote]             = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);

  const companyPrefix = context?.companyPrefix ?? "";
  const listParams = tab === "queue"
    ? { flagged: true, q: search, companyPrefix }
    : { q: search, companyPrefix };

  const { data: filesData, loading: listLoading, error: listError, refresh: refreshList } =
    usePluginData<FilesData>("files", listParams);

  const { data: file, loading: fileLoading, refresh: refreshFile } =
    usePluginData<FileRecord>("file", selectedId ? { id: selectedId } : undefined);

  const reviewAction = usePluginAction("review");

  const files = filesData?.files ?? [];

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function submitReview() {
    if (!selectedId || !pending) return;
    setSubmitting(true);
    try {
      await reviewAction({ id: selectedId, action: pending, note: note || undefined });
      setPending(null);
      setNote("");
      await Promise.all([refreshList(), refreshFile()]);
      showToast(`Review submitted: ${pending.replace("_", " ")}`, true);
    } catch {
      showToast("Failed to submit review", false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.root}>
      {/* Topbar */}
      <div style={s.topbar}>
        <span style={s.title}>File Viewer</span>
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === "queue" ? s.tabActive : {}) }} onClick={() => setTab("queue")}>
            Review Queue {tab === "queue" && filesData ? `(${filesData.total})` : ""}
          </button>
          <button style={{ ...s.tab, ...(tab === "all" ? s.tabActive : {}) }} onClick={() => setTab("all")}>
            All Files
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* File list sidebar */}
        <div style={s.sidebar}>
          <div style={s.sHead}>
            <input style={s.search} placeholder="Search files…" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={s.list}>
            {listLoading && <div style={s.empty}>Loading…</div>}
            {listError && <div style={s.empty}>Error loading files</div>}
            {!listLoading && !listError && files.length === 0 && (
              <div style={s.empty}>{tab === "queue" ? "No files pending review" : "No files found"}</div>
            )}
            {files.map(f => (
              <FileItem key={f.id} file={f} selected={f.id === selectedId} onClick={() => setSelectedId(f.id)} />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div style={s.content}>
          {!selectedId ? (
            <div style={s.placeholder}>Select a file to view</div>
          ) : fileLoading ? (
            <div style={s.placeholder}>Loading…</div>
          ) : !file ? (
            <div style={s.placeholder}>File not found</div>
          ) : (
            <div style={s.fileView}>
              {/* File content */}
              <div style={s.fileBody}>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{file.name}</div>
                  <div style={{ fontSize: 12, color: "var(--muted-foreground, #64748b)", marginTop: 2 }}>{file.path}</div>
                </div>
                {file.file_type === "text" ? (
                  <pre style={s.pre}>{file.content ?? "(empty)"}</pre>
                ) : file.file_type === "image" && file.content ? (
                  <img src={file.content} alt={file.name} style={{ maxWidth: "100%", borderRadius: 6 }} />
                ) : (
                  <div style={s.placeholder}>No preview</div>
                )}
              </div>

              {/* Metadata + review sidebar */}
              <div style={s.fileSide}>
                <div>
                  <div style={s.mLabel}>Status</div>
                  <StatusBadge status={file.review_status} />
                </div>
                <hr style={s.divider} />
                {file.linked_issue_id && <div><div style={s.mLabel}>Linked Issue</div><div style={s.mValue}>{file.linked_issue_id}</div></div>}
                {file.creating_agent_id && <div><div style={s.mLabel}>Created by</div><div style={s.mValue}>{file.creating_agent_id}</div></div>}
                <hr style={s.divider} />

                {pending ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={s.mLabel}>Note (optional)</div>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={3}
                      placeholder="Add a note…"
                      style={{ resize: "vertical", padding: "6px 8px", border: "1px solid var(--border, #e2e8f0)", borderRadius: 6, fontSize: 13, fontFamily: "inherit", background: "transparent", color: "inherit" }}
                    />
                    <button
                      style={{ ...s.btn, background: pending === "approve" ? "#16a34a" : pending === "reject" ? "#dc2626" : "#ea580c", color: "#fff" }}
                      onClick={submitReview}
                      disabled={submitting}
                    >
                      {submitting ? "Submitting…" : `Confirm ${pending.replace("_", " ")}`}
                    </button>
                    <button style={{ ...s.btn, background: "var(--muted, #f1f5f9)", color: "inherit" }} onClick={() => { setPending(null); setNote(""); }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={s.mLabel}>Review Actions</div>
                    {file.review_status === "approved" ? (
                      <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>✓ Already approved</div>
                    ) : (
                      <>
                        <button style={{ ...s.btn, background: "#16a34a", color: "#fff" }} onClick={() => setPending("approve")}>✓ Approve</button>
                        <button style={{ ...s.btn, background: "#ea580c", color: "#fff" }} onClick={() => setPending("request_changes")}>✎ Request Changes</button>
                        <button style={{ ...s.btn, background: "#dc2626", color: "#fff" }} onClick={() => setPending("reject")}>✕ Reject</button>
                      </>
                    )}
                  </div>
                )}

                {file.reviews && file.reviews.length > 0 && (
                  <>
                    <hr style={s.divider} />
                    <div style={s.mLabel}>Review History</div>
                    {file.reviews.map(r => (
                      <div key={r.id} style={{ fontSize: 12, background: "var(--muted, #f8fafc)", borderRadius: 6, padding: "6px 8px" }}>
                        <StatusBadge status={r.action} />
                        {r.note && <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--muted-foreground, #64748b)" }}>"{r.note}"</div>}
                        <div style={{ marginTop: 2, color: "var(--muted-foreground, #64748b)" }}>{new Date(r.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: 20, right: 20, padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600, background: toast.ok ? "#16a34a" : "#dc2626", color: "#fff", zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.15)" }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
