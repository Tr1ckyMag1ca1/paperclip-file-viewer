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

type FileStore = { files: FileRecord[]; seeded?: boolean };

interface PluginConfig {
  seedExampleFiles?: boolean;
  defaultFlagForReview?: boolean;
  maxFilesPerPage?: number;
}

const STATE_KEY = "file-store";

const SEED_FILES: FileRecord[] = [
  {
    id: "file-001", name: "deploy.sh", path: "/scripts/deploy.sh", file_type: "text",
    content: "#!/bin/bash\nset -e\necho \"Deploying...\"\nnpm run build\ncp -r dist/ /var/www/app/\necho \"Done.\"",
    linked_issue_id: "ALE-85", linked_task_id: null, review_status: "pending",
    flagged_for_review: true, creating_agent_id: "founding-engineer",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reviews: [],
  },
  {
    id: "file-002", name: "config.yml", path: "/config/config.yml", file_type: "text",
    content: "server:\n  host: 0.0.0.0\n  port: 3201\ndatabase:\n  path: ./file-viewer.db",
    linked_issue_id: "ALE-83", linked_task_id: null, review_status: "pending",
    flagged_for_review: true, creating_agent_id: "founding-engineer",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reviews: [],
  },
  {
    id: "file-003", name: "README.md", path: "/README.md", file_type: "text",
    content: "# File Viewer\n\nBrowse and review files linked to Paperclip issues.\n\n## Setup\n\n```bash\nnpm install && npm start\n```",
    linked_issue_id: null, linked_task_id: null, review_status: "approved",
    flagged_for_review: false, creating_agent_id: "ceo",
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reviews: [],
  },
];

async function loadStore(ctx: PluginContext, config: PluginConfig): Promise<FileStore> {
  const stored = await ctx.state.get({ scopeKind: "instance", stateKey: STATE_KEY });
  if (stored && typeof stored === "object" && Array.isArray((stored as FileStore).files)) {
    return stored as FileStore;
  }
  // First load — seed if configured
  const seed: FileStore = {
    files: config.seedExampleFiles !== false ? [...SEED_FILES] : [],
    seeded: true,
  };
  await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEY }, seed);
  return seed;
}

async function saveStore(ctx: PluginContext, store: FileStore): Promise<void> {
  await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEY }, store);
}

const plugin = definePlugin({
  async setup(ctx) {
    const config = (ctx.config.get() ?? {}) as PluginConfig;

    ctx.data.register("files", async (params) => {
      const store = await loadStore(ctx, config);
      let files = store.files;
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
      const store = await loadStore(ctx, config);
      const file = store.files.find(f => f.id === params.id);
      if (!file) throw new Error("File not found: " + params.id);
      return file;
    });

    ctx.actions.register("review", async (params) => {
      if (!params.id || !params.action) throw new Error("id and action required");
      const store = await loadStore(ctx, config);
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
      const store = await loadStore(ctx, config);

      // Duplicate check
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
  },
  async onHealth() {
    return { status: "ok", message: "File Viewer plugin running" };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
