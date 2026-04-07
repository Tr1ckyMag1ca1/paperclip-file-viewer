import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Review status tracked in plugin state (overlay on native documents). */
type ReviewStatus = "pending" | "approved" | "changes_requested" | "rejected" | "dismissed";

/** A single review entry in the history. */
type ReviewEntry = {
  id: string;
  action: "approve" | "request_changes" | "reject" | "dismiss";
  note: string | null;
  reviewedAt: string;
};

/** Per-document review state stored in plugin state. */
type DocReviewState = {
  reviewStatus: ReviewStatus;
  reviews: ReviewEntry[];
  updatedAt: string;
};

/** Plugin config schema. */
interface PluginConfig {
  autoIndexDocuments?: boolean;
  maxFilesPerPage?: number;
}

/** Unified document record returned to the UI. */
interface DocumentRecord {
  /** Composite key: `{issueIdentifier}/{docKey}` */
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
}

// ---------------------------------------------------------------------------
// State helpers — review state is stored per-document in plugin state
// ---------------------------------------------------------------------------

const REVIEW_STATE_NS = "doc-reviews";

function reviewScopeKey(issueId: string, docKey: string) {
  return {
    scopeKind: "issue" as const,
    scopeId: issueId,
    namespace: REVIEW_STATE_NS,
    stateKey: docKey,
  };
}

async function getReviewState(ctx: PluginContext, issueId: string, docKey: string): Promise<DocReviewState | null> {
  const raw = await ctx.state.get(reviewScopeKey(issueId, docKey));
  if (raw && typeof raw === "object" && "reviewStatus" in (raw as Record<string, unknown>)) {
    return raw as DocReviewState;
  }
  return null;
}

async function setReviewState(ctx: PluginContext, issueId: string, docKey: string, state: DocReviewState): Promise<void> {
  await ctx.state.set(reviewScopeKey(issueId, docKey), state);
}

// ---------------------------------------------------------------------------
// Document indexing — pull from native Paperclip documents
// ---------------------------------------------------------------------------

async function indexDocuments(ctx: PluginContext, params: {
  companyPrefix?: string;
  status?: string;
  q?: string;
  issueIdentifier?: string;
  agentId?: string;
  limit?: number;
}): Promise<{ documents: DocumentRecord[]; total: number }> {
  const limit = params.limit ?? 100;
  const documents: DocumentRecord[] = [];

  try {
    const companies = await ctx.companies.list();

    for (const company of companies) {
      // Skip companies that don't match filter
      if (params.companyPrefix) {
        // Company prefix is usually the first few chars of identifier
        // We filter by checking issue identifiers later
      }

      const issues = await ctx.issues.list({ companyId: company.id, limit: 500 });

      for (const issue of issues) {
        if (!issue.identifier) continue;

        // Filter by company prefix
        if (params.companyPrefix) {
          const prefix = params.companyPrefix + "-";
          if (!issue.identifier.startsWith(prefix)) continue;
        }

        // Filter by specific issue
        if (params.issueIdentifier && issue.identifier !== params.issueIdentifier) continue;

        // Filter by agent
        if (params.agentId && issue.assigneeAgentId !== params.agentId) continue;

        let docSummaries;
        try {
          docSummaries = await ctx.issues.documents.list(issue.id, company.id);
        } catch {
          continue;
        }

        for (const docSummary of docSummaries) {
          const compositeId = `${issue.identifier}/${docSummary.key}`;

          // Get review state from plugin state
          const reviewState = await getReviewState(ctx, issue.id, docSummary.key);
          const reviewStatus: ReviewStatus = reviewState?.reviewStatus ?? "pending";

          // Filter by status
          if (params.status && reviewStatus !== params.status) continue;

          // Filter by search query
          if (params.q) {
            const q = params.q.toLowerCase();
            const searchable = [
              docSummary.title ?? "",
              docSummary.key,
              issue.identifier,
              issue.title,
            ].join(" ").toLowerCase();
            if (!searchable.includes(q)) continue;
          }

          // Derive company prefix from issue identifier
          const prefixMatch = issue.identifier.match(/^([A-Z]+)-/);
          const derivedPrefix = prefixMatch ? prefixMatch[1] : "";

          documents.push({
            id: compositeId,
            name: docSummary.title || docSummary.key,
            docKey: docSummary.key,
            issueId: issue.id,
            issueIdentifier: issue.identifier,
            issueTitle: issue.title,
            issueStatus: issue.status,
            issuePriority: issue.priority,
            assigneeAgentId: issue.assigneeAgentId,
            companyId: company.id,
            companyPrefix: derivedPrefix,
            projectId: issue.projectId,
            content: null, // Fetched on demand via "document" data handler
            format: docSummary.format,
            revisionNumber: docSummary.latestRevisionNumber,
            createdByAgentId: docSummary.createdByAgentId,
            updatedByAgentId: docSummary.updatedByAgentId,
            reviewStatus,
            reviews: reviewState?.reviews ?? [],
            createdAt: String(docSummary.createdAt),
            updatedAt: String(docSummary.updatedAt),
          });
        }
      }
    }
  } catch (err) {
    ctx.logger.warn("Document indexing failed: " + String(err));
  }

  // Sort: pending first, then by updated date descending
  const statusOrder: Record<string, number> = {
    pending: 0,
    changes_requested: 1,
    approved: 2,
    rejected: 3,
    dismissed: 4,
  };
  documents.sort((a, b) => {
    const sa = statusOrder[a.reviewStatus] ?? 5;
    const sb = statusOrder[b.reviewStatus] ?? 5;
    if (sa !== sb) return sa - sb;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return { documents: documents.slice(0, limit), total: documents.length };
}

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(ctx) {
    const config = (await ctx.config.get() ?? {}) as PluginConfig;

    // ------------------------------------------------------------------
    // Data: list documents (drives the main list view)
    // ------------------------------------------------------------------
    ctx.data.register("documents", async (params) => {
      return indexDocuments(ctx, {
        companyPrefix: typeof params.companyPrefix === "string" ? params.companyPrefix : undefined,
        status: typeof params.status === "string" ? params.status : undefined,
        q: typeof params.q === "string" ? params.q : undefined,
        issueIdentifier: typeof params.issueIdentifier === "string" ? params.issueIdentifier : undefined,
        agentId: typeof params.agentId === "string" ? params.agentId : undefined,
        limit: config.maxFilesPerPage ?? 100,
      });
    });

    // ------------------------------------------------------------------
    // Data: get single document with full content
    // ------------------------------------------------------------------
    ctx.data.register("document", async (params) => {
      if (!params.issueId || !params.docKey || !params.companyId) {
        throw new Error("issueId, docKey, and companyId required");
      }

      const issueId = String(params.issueId);
      const docKey = String(params.docKey);
      const companyId = String(params.companyId);

      const [doc, issue] = await Promise.all([
        ctx.issues.documents.get(issueId, docKey, companyId),
        ctx.issues.get(issueId, companyId),
      ]);

      if (!doc) throw new Error(`Document not found: ${docKey} on issue ${issueId}`);

      const reviewState = await getReviewState(ctx, issueId, docKey);
      const prefixMatch = issue?.identifier?.match(/^([A-Z]+)-/);

      return {
        id: `${issue?.identifier ?? issueId}/${docKey}`,
        name: doc.title || doc.key,
        docKey: doc.key,
        issueId,
        issueIdentifier: issue?.identifier ?? issueId,
        issueTitle: issue?.title ?? "",
        issueStatus: issue?.status ?? "unknown",
        issuePriority: issue?.priority ?? "medium",
        assigneeAgentId: issue?.assigneeAgentId ?? null,
        companyId,
        companyPrefix: prefixMatch ? prefixMatch[1] : "",
        projectId: issue?.projectId ?? null,
        content: doc.body,
        format: doc.format,
        revisionNumber: doc.latestRevisionNumber,
        createdByAgentId: doc.createdByAgentId,
        updatedByAgentId: doc.updatedByAgentId,
        reviewStatus: reviewState?.reviewStatus ?? "pending",
        reviews: reviewState?.reviews ?? [],
        createdAt: String(doc.createdAt),
        updatedAt: String(doc.updatedAt),
      } satisfies DocumentRecord;
    });

    // ------------------------------------------------------------------
    // Data: get issue context (for the sidebar panel)
    // ------------------------------------------------------------------
    ctx.data.register("issue-context", async (params) => {
      if (!params.issueId || !params.companyId) {
        throw new Error("issueId and companyId required");
      }
      const issue = await ctx.issues.get(String(params.issueId), String(params.companyId));
      if (!issue) throw new Error("Issue not found");

      // Also list all documents on this issue for context
      let docSummaries: Awaited<ReturnType<typeof ctx.issues.documents.list>> = [];
      try {
        docSummaries = await ctx.issues.documents.list(issue.id, String(params.companyId));
      } catch {
        // leave empty
      }

      return {
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        status: issue.status,
        priority: issue.priority,
        assigneeAgentId: issue.assigneeAgentId,
        projectId: issue.projectId,
        documents: docSummaries.map(d => ({
          key: d.key,
          title: d.title,
          revisionNumber: d.latestRevisionNumber,
          updatedAt: String(d.updatedAt),
        })),
        createdAt: String(issue.createdAt),
        updatedAt: String(issue.updatedAt),
      };
    });

    // ------------------------------------------------------------------
    // Action: review a document (approve / request_changes / reject)
    // ------------------------------------------------------------------
    ctx.actions.register("review", async (params) => {
      const issueId = String(params.issueId ?? "");
      const docKey = String(params.docKey ?? "");
      const companyId = String(params.companyId ?? "");
      const action = String(params.action ?? "") as "approve" | "request_changes" | "reject";
      const note = typeof params.note === "string" && params.note ? params.note : null;
      const wakeAgent = params.wakeAgent === true;

      if (!issueId || !docKey || !action) throw new Error("issueId, docKey, and action required");

      // Map action to review status
      const statusMap: Record<string, ReviewStatus> = {
        approve: "approved",
        request_changes: "changes_requested",
        reject: "rejected",
      };
      const newStatus = statusMap[action];
      if (!newStatus) throw new Error("Invalid action: " + action);

      // Update plugin review state
      const now = new Date().toISOString();
      const existing = await getReviewState(ctx, issueId, docKey);
      const review: ReviewEntry = {
        id: "rev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        action,
        note,
        reviewedAt: now,
      };
      const updated: DocReviewState = {
        reviewStatus: newStatus,
        reviews: [...(existing?.reviews ?? []), review],
        updatedAt: now,
      };
      await setReviewState(ctx, issueId, docKey, updated);

      // Post comment on the issue
      try {
        const actionLabel = action === "approve" ? "approved" : action === "request_changes" ? "requested changes on" : "rejected";
        let commentBody = `**Document Review**: ${actionLabel} document \`${docKey}\``;
        if (note) commentBody += `\n\n> ${note}`;
        await ctx.issues.createComment(issueId, commentBody, companyId);
        ctx.logger.info(`Posted review comment on issue ${issueId} for document ${docKey}`);
      } catch (err) {
        ctx.logger.warn(`Failed to post comment on issue ${issueId}: ${String(err)}`);
      }

      // Wake agent if revisions requested and wakeAgent is true
      if (wakeAgent && (action === "request_changes" || action === "reject")) {
        try {
          const issue = await ctx.issues.get(issueId, companyId);
          if (issue?.assigneeAgentId) {
            const prompt = action === "request_changes"
              ? `Revisions requested on document "${docKey}" for issue ${issue.identifier}. Review note: ${note ?? "No specific notes provided."} Please revise the document.`
              : `Document "${docKey}" for issue ${issue.identifier} was rejected. Review note: ${note ?? "No specific notes provided."} Please review and address the feedback.`;

            await ctx.agents.invoke(issue.assigneeAgentId, companyId, {
              prompt,
              reason: `Document review: ${action} on ${docKey}`,
            });
            ctx.logger.info(`Woke agent ${issue.assigneeAgentId} for document revision on ${docKey}`);
          }
        } catch (err) {
          ctx.logger.warn(`Failed to wake agent for issue ${issueId}: ${String(err)}`);
        }
      }

      return { reviewStatus: newStatus, review };
    });

    // ------------------------------------------------------------------
    // Action: dismiss a document (remove from review queue)
    // ------------------------------------------------------------------
    ctx.actions.register("dismiss", async (params) => {
      const issueId = String(params.issueId ?? "");
      const docKey = String(params.docKey ?? "");
      if (!issueId || !docKey) throw new Error("issueId and docKey required");

      const now = new Date().toISOString();
      const existing = await getReviewState(ctx, issueId, docKey);
      const review: ReviewEntry = {
        id: "rev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        action: "dismiss",
        note: typeof params.note === "string" ? params.note : null,
        reviewedAt: now,
      };
      const updated: DocReviewState = {
        reviewStatus: "dismissed",
        reviews: [...(existing?.reviews ?? []), review],
        updatedAt: now,
      };
      await setReviewState(ctx, issueId, docKey, updated);
      return { reviewStatus: "dismissed" };
    });

    // ------------------------------------------------------------------
    // Action: reset a document back to pending (undo dismiss/review)
    // ------------------------------------------------------------------
    ctx.actions.register("reset-review", async (params) => {
      const issueId = String(params.issueId ?? "");
      const docKey = String(params.docKey ?? "");
      if (!issueId || !docKey) throw new Error("issueId and docKey required");

      const now = new Date().toISOString();
      const existing = await getReviewState(ctx, issueId, docKey);
      const updated: DocReviewState = {
        reviewStatus: "pending",
        reviews: existing?.reviews ?? [],
        updatedAt: now,
      };
      await setReviewState(ctx, issueId, docKey, updated);
      return { reviewStatus: "pending" };
    });
  },

  async onHealth() {
    return { status: "ok", message: "File Viewer v0.4.0 — native document review" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
