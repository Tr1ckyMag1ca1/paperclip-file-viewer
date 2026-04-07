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

// ── Types ─────────────────────────────────────────────────────────────────

type ReviewStatus = "pending" | "approved" | "changes_requested" | "rejected" | "dismissed";

type ReviewEntry = {
  id: string;
  action: string;
  note: string | null;
  reviewedAt: string;
};

type DocumentRecord = {
  id: string;
  name: string;
  docKey: string;
  issueId: string;
  issueIdentifier: string;
  issueTitle: string;
  issueStatus: string;
  issuePriority: string;
  assigneeAgentId: string | null;
  companyId: string;
  companyPrefix: string;
  projectId: string | null;
  content: string | null;
  format: string;
  revisionNumber: number;
  createdByAgentId: string | null;
  updatedByAgentId: string | null;
  reviewStatus: ReviewStatus;
  reviews: ReviewEntry[];
  createdAt: string;
  updatedAt: string;
};

type DocumentsData = { documents: DocumentRecord[]; total: number };

type IssueContext = {
  id: string;
  identifier: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeAgentId: string | null;
  projectId: string | null;
  documents: { key: string; title: string | null; revisionNumber: number; updatedAt: string }[];
  createdAt: string;
  updatedAt: string;
};

// ── Tab type ──────────────────────────────────────────────────────────────

type TabId = "inbox" | "approved" | "dismissed" | "all";

const TABS: { id: TabId; label: string; statusFilter: string | undefined }[] = [
  { id: "inbox", label: "Inbox", statusFilter: "pending" },
  { id: "approved", label: "Approved", statusFilter: "approved" },
  { id: "dismissed", label: "Dismissed", statusFilter: "dismissed" },
  { id: "all", label: "All", statusFilter: undefined },
];

// ── Styles ─────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root:        { display: "flex", flexDirection: "column", height: "100%", fontFamily: "inherit", fontSize: 14 },
  topbar:      { display: "flex", alignItems: "center", gap: 12, padding: "0 16px", height: 48, borderBottom: "1px solid var(--border, #333)", flexShrink: 0 },
  title:       { fontWeight: 700, fontSize: 15 },
  tabs:        { display: "flex", gap: 2, marginLeft: "auto" },
  tab:         { background: "none", border: "none", cursor: "pointer", padding: "4px 10px", borderRadius: 6, fontSize: 12, color: "var(--muted-foreground, #888)" },
  tabActive:   { background: "var(--accent, #2a2a2a)", color: "var(--foreground, #e5e5e5)", fontWeight: 600 },
  body:        { display: "flex", flex: 1, overflow: "hidden" },
  sidebar:     { width: 340, flexShrink: 0, borderRight: "1px solid var(--border, #333)", display: "flex", flexDirection: "column", overflow: "hidden" },
  sHead:       { padding: "10px 12px", borderBottom: "1px solid var(--border, #333)", display: "flex", flexDirection: "column", gap: 6 },
  search:      { width: "100%", padding: "6px 10px", border: "1px solid var(--border, #333)", borderRadius: 6, fontSize: 13, background: "transparent", color: "inherit", boxSizing: "border-box" as const },
  list:        { flex: 1, overflowY: "auto" as const },
  item:        { padding: "10px 12px", cursor: "pointer", borderBottom: "1px solid var(--border, #333)", display: "flex", flexDirection: "column", gap: 3 },
  itemSel:     { background: "var(--accent, #2a2a2a)" },
  iName:       { fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const },
  iMeta:       { display: "flex", gap: 4, flexWrap: "wrap" as const, alignItems: "center", fontSize: 11, color: "var(--muted-foreground, #888)" },
  content:     { flex: 1, overflow: "auto", display: "flex", flexDirection: "column" },
  placeholder: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground, #888)", fontSize: 13 },
  docView:     { display: "flex", flex: 1, overflow: "hidden" },
  docBody:     { flex: 1, overflow: "auto", padding: 20 },
  docSide:     { width: 280, flexShrink: 0, borderLeft: "1px solid var(--border, #333)", padding: 16, overflowY: "auto" as const, display: "flex", flexDirection: "column", gap: 10 },
  pre:         { background: "var(--muted, #1a1a1a)", border: "1px solid var(--border, #333)", borderRadius: 6, padding: 16, fontSize: 12, overflowX: "auto" as const, whiteSpace: "pre-wrap" as const, wordBreak: "break-word" as const, lineHeight: 1.7 },
  mLabel:      { fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.5px", color: "var(--muted-foreground, #888)", marginBottom: 2 },
  mValue:      { fontSize: 13 },
  btn:         { padding: "7px 12px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, width: "100%" },
  divider:     { border: "none", borderTop: "1px solid var(--border, #333)", margin: "4px 0" },
  empty:       { padding: "32px 12px", textAlign: "center" as const, color: "var(--muted-foreground, #888)", fontSize: 13 },
  issueLink:   { fontSize: 12, color: "var(--primary, #818cf8)", textDecoration: "none", fontWeight: 500 },
  issueMeta:   { fontSize: 12, color: "var(--muted-foreground, #888)", lineHeight: 1.5 },
};

// ── Badge components ──────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending:           { bg: "#fef9c3", color: "#854d0e" },
  approved:          { bg: "#dcfce7", color: "#166534" },
  changes_requested: { bg: "#ffedd5", color: "#9a3412" },
  rejected:          { bg: "#fee2e2", color: "#991b1b" },
  dismissed:         { bg: "#e2e8f0", color: "#475569" },
};

const ISSUE_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  backlog:     { bg: "#374151", color: "#d1d5db" },
  todo:        { bg: "#3b82f6", color: "#fff" },
  in_progress: { bg: "#f59e0b", color: "#fff" },
  in_review:   { bg: "#8b5cf6", color: "#fff" },
  done:        { bg: "#22c55e", color: "#fff" },
  blocked:     { bg: "#ef4444", color: "#fff" },
  cancelled:   { bg: "#6b7280", color: "#fff" },
};

function Badge({ label, bg, color }: { label: string; bg: string; color: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "1px 7px", borderRadius: 4,
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.5px", background: bg, color, lineHeight: "18px",
    }}>
      {label.replace(/_/g, " ")}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const st = STATUS_STYLE[status] ?? { bg: "#374151", color: "#d1d5db" };
  return <Badge label={status} bg={st.bg} color={st.color} />;
}

function IssueStatusBadge({ status }: { status: string }) {
  const st = ISSUE_STATUS_STYLE[status] ?? { bg: "#374151", color: "#d1d5db" };
  return <Badge label={status} bg={st.bg} color={st.color} />;
}

// ── Document list item ────────────────────────────────────────────────────

function DocItem({ doc, selected, onClick }: { doc: DocumentRecord; selected: boolean; onClick: () => void }) {
  return (
    <div style={{ ...s.item, ...(selected ? s.itemSel : {}) }} onClick={onClick}>
      <div style={s.iName}>{doc.name}</div>
      <div style={s.iMeta}>
        <StatusBadge status={doc.reviewStatus} />
        <IssueStatusBadge status={doc.issueStatus} />
        <span>{doc.issueIdentifier}</span>
        {doc.assigneeAgentId && <span style={{ opacity: 0.7 }}>{doc.assigneeAgentId}</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground, #888)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
        {doc.issueTitle}
      </div>
    </div>
  );
}

// ── Issue context panel ───────────────────────────────────────────────────

function IssueContextPanel({ issueId, companyId, companyPrefix }: { issueId: string; companyId: string; companyPrefix: string }) {
  const { data: issue, loading } = usePluginData<IssueContext>("issue-context", { issueId, companyId });

  if (loading) return <div style={{ fontSize: 12, color: "var(--muted-foreground, #888)" }}>Loading issue...</div>;
  if (!issue) return null;

  const issueUrl = `/${companyPrefix}/issues/${issue.identifier}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={s.mLabel}>Linked Issue</div>
      <a href={issueUrl} style={s.issueLink}>{issue.identifier}: {issue.title}</a>
      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
        <IssueStatusBadge status={issue.status} />
        <Badge label={issue.priority} bg="#374151" color="#d1d5db" />
      </div>
      {issue.description && (
        <div style={{ ...s.issueMeta, maxHeight: 80, overflow: "hidden", textOverflow: "ellipsis" }}>
          {issue.description.slice(0, 200)}{issue.description.length > 200 ? "..." : ""}
        </div>
      )}
      {issue.assigneeAgentId && (
        <div style={s.issueMeta}>Agent: {issue.assigneeAgentId}</div>
      )}
      {issue.documents.length > 1 && (
        <div style={{ fontSize: 11, color: "var(--muted-foreground, #888)" }}>
          {issue.documents.length} documents on this issue
        </div>
      )}
    </div>
  );
}

// ── Review history ────────────────────────────────────────────────────────

function ReviewHistory({ reviews }: { reviews: ReviewEntry[] }) {
  if (!reviews.length) return null;
  return (
    <>
      <hr style={s.divider} />
      <div style={s.mLabel}>Review History</div>
      {reviews.slice().reverse().map(r => (
        <div key={r.id} style={{ fontSize: 12, background: "var(--muted, #1a1a1a)", borderRadius: 6, padding: "6px 8px" }}>
          <StatusBadge status={r.action === "request_changes" ? "changes_requested" : r.action === "approve" ? "approved" : r.action === "dismiss" ? "dismissed" : r.action} />
          {r.note && <div style={{ marginTop: 4, fontStyle: "italic", color: "var(--muted-foreground, #888)" }}>"{r.note}"</div>}
          <div style={{ marginTop: 2, color: "var(--muted-foreground, #888)" }}>{new Date(r.reviewedAt).toLocaleString()}</div>
        </div>
      ))}
    </>
  );
}

// ── Main page component ───────────────────────────────────────────────────

export function FileViewerPage({ context }: PluginPageProps) {
  const [tab, setTab] = useState<TabId>("inbox");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{ issueId: string; docKey: string; companyId: string; companyPrefix: string } | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [wakeAgent, setWakeAgent] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const companyPrefix = context?.companyPrefix ?? "";
  const activeTab = TABS.find(t => t.id === tab)!;

  const listParams: Record<string, string> = { companyPrefix };
  if (activeTab.statusFilter) listParams.status = activeTab.statusFilter;
  if (search) listParams.q = search;

  const { data: docsData, loading: listLoading, error: listError, refresh: refreshList } =
    usePluginData<DocumentsData>("documents", listParams);

  const { data: fullDoc, loading: docLoading, refresh: refreshDoc } =
    usePluginData<DocumentRecord>("document", selected ? { issueId: selected.issueId, docKey: selected.docKey, companyId: selected.companyId } : undefined);

  const reviewAction = usePluginAction("review");
  const dismissAction = usePluginAction("dismiss");
  const resetAction = usePluginAction("reset-review");

  const docs = docsData?.documents ?? [];

  const showToast = useCallback((msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }, []);

  async function submitReview() {
    if (!selected || !pendingAction) return;
    setSubmitting(true);
    try {
      if (pendingAction === "dismiss") {
        await dismissAction({ issueId: selected.issueId, docKey: selected.docKey, note: note || undefined });
      } else {
        await reviewAction({
          issueId: selected.issueId,
          docKey: selected.docKey,
          companyId: selected.companyId,
          action: pendingAction,
          note: note || undefined,
          wakeAgent: wakeAgent && (pendingAction === "request_changes" || pendingAction === "reject"),
        });
      }
      setPendingAction(null);
      setNote("");
      await Promise.all([refreshList(), refreshDoc()]);
      const label = pendingAction.replace(/_/g, " ");
      showToast(`Review: ${label}`, true);
    } catch {
      showToast("Failed to submit review", false);
    } finally {
      setSubmitting(false);
    }
  }

  async function resetReview() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await resetAction({ issueId: selected.issueId, docKey: selected.docKey });
      await Promise.all([refreshList(), refreshDoc()]);
      showToast("Reset to pending", true);
    } catch {
      showToast("Failed to reset", false);
    } finally {
      setSubmitting(false);
    }
  }

  function selectDoc(doc: DocumentRecord) {
    setSelected({ issueId: doc.issueId, docKey: doc.docKey, companyId: doc.companyId, companyPrefix: doc.companyPrefix });
    setPendingAction(null);
    setNote("");
  }

  return (
    <div style={s.root}>
      {/* Topbar */}
      <div style={s.topbar}>
        <span style={s.title}>Document Review</span>
        <div style={s.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...s.tab, ...(tab === t.id ? s.tabActive : {}) }}
              onClick={() => { setTab(t.id); setSelected(null); }}
            >
              {t.label}
              {tab === t.id && docsData ? ` (${docsData.total})` : ""}
            </button>
          ))}
        </div>
      </div>

      <div style={s.body}>
        {/* Document list sidebar */}
        <div style={s.sidebar}>
          <div style={s.sHead}>
            <input
              style={s.search}
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={s.list}>
            {listLoading && <div style={s.empty}>Loading...</div>}
            {listError && <div style={s.empty}>Error loading documents</div>}
            {!listLoading && !listError && docs.length === 0 && (
              <div style={s.empty}>
                {tab === "inbox" ? "No documents pending review" : "No documents found"}
              </div>
            )}
            {docs.map(d => (
              <DocItem
                key={d.id}
                doc={d}
                selected={selected?.issueId === d.issueId && selected?.docKey === d.docKey}
                onClick={() => selectDoc(d)}
              />
            ))}
          </div>
        </div>

        {/* Content area */}
        <div style={s.content}>
          {!selected ? (
            <div style={s.placeholder}>Select a document to review</div>
          ) : docLoading ? (
            <div style={s.placeholder}>Loading...</div>
          ) : !fullDoc ? (
            <div style={s.placeholder}>Document not found</div>
          ) : (
            <div style={s.docView}>
              {/* Document content */}
              <div style={s.docBody}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{fullDoc.name}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                    <a
                      href={`/${fullDoc.companyPrefix}/issues/${fullDoc.issueIdentifier}#document-${fullDoc.docKey}`}
                      style={s.issueLink}
                    >
                      {fullDoc.issueIdentifier}
                    </a>
                    <StatusBadge status={fullDoc.reviewStatus} />
                    {fullDoc.revisionNumber > 1 && (
                      <span style={{ fontSize: 11, color: "var(--muted-foreground, #888)" }}>
                        v{fullDoc.revisionNumber}
                      </span>
                    )}
                  </div>
                </div>
                <pre style={s.pre}>{fullDoc.content ?? "(empty)"}</pre>
              </div>

              {/* Metadata + review sidebar */}
              <div style={s.docSide}>
                {/* Issue context */}
                <IssueContextPanel
                  issueId={fullDoc.issueId}
                  companyId={fullDoc.companyId}
                  companyPrefix={fullDoc.companyPrefix}
                />

                <hr style={s.divider} />

                {/* Document metadata */}
                <div>
                  <div style={s.mLabel}>Review Status</div>
                  <StatusBadge status={fullDoc.reviewStatus} />
                </div>

                {fullDoc.createdByAgentId && (
                  <div>
                    <div style={s.mLabel}>Created by</div>
                    <div style={s.mValue}>{fullDoc.createdByAgentId}</div>
                  </div>
                )}

                {fullDoc.revisionNumber > 0 && (
                  <div>
                    <div style={s.mLabel}>Revision</div>
                    <div style={s.mValue}>v{fullDoc.revisionNumber}</div>
                  </div>
                )}

                <hr style={s.divider} />

                {/* Review actions */}
                {pendingAction ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={s.mLabel}>
                      {pendingAction === "dismiss" ? "Dismiss note (optional)" : "Review note (optional)"}
                    </div>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={3}
                      placeholder={pendingAction === "request_changes" ? "What needs to change..." : "Add a note..."}
                      style={{
                        resize: "vertical", padding: "6px 8px",
                        border: "1px solid var(--border, #333)", borderRadius: 6,
                        fontSize: 13, fontFamily: "inherit",
                        background: "transparent", color: "inherit",
                      }}
                    />
                    {(pendingAction === "request_changes" || pendingAction === "reject") && (
                      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={wakeAgent}
                          onChange={e => setWakeAgent(e.target.checked)}
                          style={{ accentColor: "var(--primary, #818cf8)" }}
                        />
                        Wake agent to revise
                      </label>
                    )}
                    <button
                      style={{
                        ...s.btn,
                        background: pendingAction === "approve" ? "#16a34a"
                          : pendingAction === "reject" ? "#dc2626"
                          : pendingAction === "dismiss" ? "#6b7280"
                          : "#ea580c",
                        color: "#fff",
                      }}
                      onClick={submitReview}
                      disabled={submitting}
                    >
                      {submitting ? "Submitting..." : `Confirm ${pendingAction.replace(/_/g, " ")}`}
                    </button>
                    <button
                      style={{ ...s.btn, background: "var(--muted, #1a1a1a)", color: "inherit" }}
                      onClick={() => { setPendingAction(null); setNote(""); }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={s.mLabel}>Actions</div>
                    {fullDoc.reviewStatus === "approved" ? (
                      <>
                        <div style={{ fontSize: 13, color: "#16a34a", fontWeight: 600 }}>Approved</div>
                        <button style={{ ...s.btn, background: "var(--muted, #1a1a1a)", color: "inherit", fontSize: 12 }} onClick={resetReview} disabled={submitting}>
                          Reset to pending
                        </button>
                      </>
                    ) : fullDoc.reviewStatus === "dismissed" ? (
                      <>
                        <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Dismissed</div>
                        <button style={{ ...s.btn, background: "var(--muted, #1a1a1a)", color: "inherit", fontSize: 12 }} onClick={resetReview} disabled={submitting}>
                          Move back to inbox
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={{ ...s.btn, background: "#16a34a", color: "#fff" }} onClick={() => setPendingAction("approve")}>Approve</button>
                        <button style={{ ...s.btn, background: "#ea580c", color: "#fff" }} onClick={() => setPendingAction("request_changes")}>Request Changes</button>
                        <button style={{ ...s.btn, background: "#dc2626", color: "#fff" }} onClick={() => setPendingAction("reject")}>Reject</button>
                        <hr style={s.divider} />
                        <button style={{ ...s.btn, background: "var(--muted, #1a1a1a)", color: "var(--muted-foreground, #888)" }} onClick={() => setPendingAction("dismiss")}>
                          Dismiss (no review needed)
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Review history */}
                <ReviewHistory reviews={fullDoc.reviews} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, padding: "10px 16px",
          borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: toast.ok ? "#16a34a" : "#dc2626", color: "#fff",
          zIndex: 9999, boxShadow: "0 4px 12px rgba(0,0,0,.3)",
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
