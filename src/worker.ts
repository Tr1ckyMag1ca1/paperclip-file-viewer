import { definePlugin, runWorker, type PluginContext } from "@paperclipai/plugin-sdk";

type FileRecord = {
  id: string;
  name: string;
  path: string;
  file_type: "text" | "image";
  content: string | null;
  linked_issue_id: string | null;
  linked_task_id: string | null;
  review_status: "pending" | "approved" | "changes_requested" | "rejected";
  flagged_for_review: boolean;
  creating_agent_id: string | null;
  created_at: string;
  updated_at: string;
  reviews: ReviewRecord[];
};

type ReviewRecord = {
  id: string;
  file_id: string;
  action: "approve" | "request_changes" | "reject";
  note: string | null;
  created_at: string;
};

type FileStore = { files: FileRecord[]; indexed?: boolean };

interface PluginConfig {
  seedExampleFiles?: boolean;
  defaultFlagForReview?: boolean;
  maxFilesPerPage?: number;
  autoIndexDocuments?: boolean;
}

const STATE_KEY = "file-store";

async function loadStore(ctx: PluginContext): Promise<FileStore> {
  const stored = await ctx.state.get({ scopeKind: "instance", stateKey: STATE_KEY });
  if (stored && typeof stored === "object" && Array.isArray((stored as FileStore).files)) {
    return stored as FileStore;
  }
  return { files: [] };
}

async function saveStore(ctx: PluginContext, store: FileStore): Promise<void> {
  await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEY }, store);
}

/** Index all issue documents from all companies, including content */
async function indexAllDocuments(ctx: PluginContext, store: FileStore): Promise<number> {
  const existingPaths = new Set(store.files.map(f => f.path));
  let added = 0;
  const now = new Date().toISOString();

  try {
    const companies = await ctx.companies.list();
    for (const company of companies) {
      const issues = await ctx.issues.list({ companyId: company.id, limit: 500 });
      for (const issue of issues) {
        let docs;
        try {
          docs = await ctx.issues.documents.list(issue.id, company.id);
        } catch {
          continue;
        }
        for (const docSummary of docs) {
          const path = `${issue.identifier}/documents/${docSummary.key}`;
          if (existingPaths.has(path)) continue;

          // Fetch full document content
          let content: string | null = null;
          try {
            const fullDoc = await ctx.issues.documents.get(issue.id, docSummary.key, company.id);
            content = fullDoc?.body ?? null;
          } catch {
            // content stays null
          }

          store.files.push({
            id: `file-auto-${docSummary.key}-${issue.identifier}`,
            name: docSummary.title || docSummary.key,
            path,
            file_type: "text",
            content,
            linked_issue_id: issue.identifier,
            linked_task_id: null,
            review_status: "pending",
            flagged_for_review: false,
            creating_agent_id: null,
            created_at: now,
            updated_at: now,
            reviews: [],
          });
          existingPaths.add(path);
          added++;
        }
      }
    }
  } catch (err) {
    ctx.logger.warn("Auto-index failed: " + String(err));
  }

  return added;
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = (ctx.config.get() ?? {}) as PluginConfig;

    // Auto-index on startup
    if (config.autoIndexDocuments !== false) {
      const store = await loadStore(ctx);
      const added = await indexAllDocuments(ctx, store);
      if (added > 0) {
        store.indexed = true;
        await saveStore(ctx, store);
        ctx.logger.info(`Auto-indexed ${added} issue documents`);
      }
    }

    ctx.data.register("files", async (params) => {
      const store = await loadStore(ctx);
      let files = store.files;

      // Filter by company prefix (e.g. "ALE", "PIC")
      if (typeof params.companyPrefix === "string" && params.companyPrefix) {
        const prefix = params.companyPrefix + "-";
        files = files.filter(f =>
          f.linked_issue_id?.startsWith(prefix) || !f.linked_issue_id
        );
      }
      if (params.flagged === true || params.flagged === "true") {
        files = files.filter(f => f.flagged_for_review && f.review_status === "pending");
      }
      if (typeof params.status === "string" && params.status) {
        files = files.filter(f => f.review_status === params.status);
      }
      if (typeof params.linked_issue_id === "string" && params.linked_issue_id) {
        files = files.filter(f => f.linked_issue_id === params.linked_issue_id);
      }
      if (typeof params.q === "string" && params.q) {
        const q = params.q.toLowerCase();
        files = files.filter(f =>
          f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q) ||
          (f.linked_issue_id ?? "").toLowerCase().includes(q)
        );
      }
      const limit = config.maxFilesPerPage ?? 100;
      return { files: files.slice(0, limit), total: files.length };
    });

    ctx.data.register("file", async (params) => {
      if (!params.id) throw new Error("id required");
      const store = await loadStore(ctx);
      const file = store.files.find(f => f.id === params.id);
      if (!file) throw new Error("File not found: " + params.id);
      return file;
    });

    ctx.actions.register("review", async (params) => {
      if (!params.id || !params.action) throw new Error("id and action required");
      const store = await loadStore(ctx);
      const file = store.files.find(f => f.id === params.id);
      if (!file) throw new Error("File not found: " + params.id);
      const action = params.action as "approve" | "request_changes" | "reject";
      const review: ReviewRecord = {
        id: "rev_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
        file_id: file.id, action,
        note: typeof params.note === "string" && params.note ? params.note : null,
        created_at: new Date().toISOString(),
      };
      file.review_status = action === "approve" ? "approved" : action === "request_changes" ? "changes_requested" : "rejected";
      file.updated_at = new Date().toISOString();
      file.reviews = [...(file.reviews ?? []), review];
      await saveStore(ctx, store);
      return { file, review };
    });

    ctx.actions.register("register-file", async (params) => {
      if (!params.name || !params.path) throw new Error("name and path required");
      const store = await loadStore(ctx);

      const existing = store.files.find(f => f.path === params.path && f.linked_issue_id === (params.linked_issue_id ?? null));
      if (existing) return { file: existing, duplicate: true };

      const flagged = params.flagged_for_review === true || params.flagged_for_review === "true"
        || (config.defaultFlagForReview === true && params.flagged_for_review !== false && params.flagged_for_review !== "false");

      const file: FileRecord = {
        id: "file-" + Date.now(), name: String(params.name), path: String(params.path),
        file_type: params.file_type === "image" ? "image" : "text",
        content: typeof params.content === "string" ? params.content : null,
        linked_issue_id: typeof params.linked_issue_id === "string" ? params.linked_issue_id : null,
        linked_task_id: typeof params.linked_task_id === "string" ? params.linked_task_id : null,
        review_status: "pending",
        flagged_for_review: flagged,
        creating_agent_id: typeof params.creating_agent_id === "string" ? params.creating_agent_id : null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reviews: [],
      };
      store.files.unshift(file);
      await saveStore(ctx, store);
      return { file, duplicate: false };
    });

    ctx.actions.register("sync-documents", async () => {
      const store = await loadStore(ctx);
      const added = await indexAllDocuments(ctx, store);
      if (added > 0) await saveStore(ctx, store);
      return { added, total: store.files.length };
    });
  },
  async onHealth() {
    return { status: "ok", message: "File Viewer plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
