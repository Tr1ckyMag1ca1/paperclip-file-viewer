import { definePlugin, runWorker } from "@paperclipai/plugin-sdk";

const PLUGIN_NAME = "file-viewer";
const STATE_KEY = "registered-files";

// ---------------------------------------------------------------------------
// Types
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

interface FileRegistry {
  files: RegisteredFile[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeId(): string {
  return `fv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getRegistry(ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0]): Promise<FileRegistry> {
  const raw = await ctx.state.get({ scopeKind: "instance", stateKey: STATE_KEY });
  if (raw && typeof raw === "object" && "files" in (raw as Record<string, unknown>)) {
    return raw as FileRegistry;
  }
  return { files: [] };
}

async function saveRegistry(
  ctx: Parameters<Parameters<typeof definePlugin>[0]["setup"]>[0],
  registry: FileRegistry,
): Promise<void> {
  await ctx.state.set({ scopeKind: "instance", stateKey: STATE_KEY }, registry);
}

// ---------------------------------------------------------------------------
// Plugin
// ---------------------------------------------------------------------------

const plugin = definePlugin({
  async setup(ctx) {
    ctx.logger.info(`${PLUGIN_NAME} plugin setup`);

    // -----------------------------------------------------------------------
    // "files" — list all registered files, optionally filtered by issueId
    // -----------------------------------------------------------------------
    ctx.data.register("files", async (params: Record<string, unknown>) => {
      const registry = await getRegistry(ctx);
      const issueId = typeof params.issueId === "string" ? params.issueId : undefined;
      const files = issueId
        ? registry.files.filter((f) => f.issueId === issueId)
        : registry.files;
      return { files };
    });

    // -----------------------------------------------------------------------
    // "file" — get a single file by id
    // -----------------------------------------------------------------------
    ctx.data.register("file", async (params: Record<string, unknown>) => {
      const fileId = typeof params.fileId === "string" ? params.fileId : "";
      if (!fileId) return { file: null, error: "fileId required" };
      const registry = await getRegistry(ctx);
      const file = registry.files.find((f) => f.id === fileId) ?? null;
      return { file };
    });

    // -----------------------------------------------------------------------
    // "review" — update the review status of a file
    // -----------------------------------------------------------------------
    ctx.data.register("review", async (params: Record<string, unknown>) => {
      const fileId = typeof params.fileId === "string" ? params.fileId : "";
      const status = typeof params.status === "string" ? params.status : "";
      const reviewedBy = typeof params.reviewedBy === "string" ? params.reviewedBy : "unknown";
      const reviewNote = typeof params.reviewNote === "string" ? params.reviewNote : undefined;

      if (!fileId) return { ok: false, error: "fileId required" };
      if (!["approved", "rejected", "pending"].includes(status)) {
        return { ok: false, error: "status must be approved, rejected, or pending" };
      }

      const registry = await getRegistry(ctx);
      const file = registry.files.find((f) => f.id === fileId);
      if (!file) return { ok: false, error: "file not found" };

      file.reviewStatus = status as RegisteredFile["reviewStatus"];
      file.reviewedAt = new Date().toISOString();
      file.reviewedBy = reviewedBy;
      if (reviewNote !== undefined) file.reviewNote = reviewNote;

      await saveRegistry(ctx, registry);
      return { ok: true, file };
    });

    // -----------------------------------------------------------------------
    // "register-file" — link a file path to an issue
    // -----------------------------------------------------------------------
    ctx.actions.register("register-file", async (params: Record<string, unknown>) => {
      const filePath = typeof params.path === "string" ? params.path.trim() : "";
      const issueId = typeof params.issueId === "string" ? params.issueId : "";
      const addedBy = typeof params.addedBy === "string" ? params.addedBy : "unknown";

      if (!filePath) throw new Error("path is required");
      if (!issueId) throw new Error("issueId is required");

      const registry = await getRegistry(ctx);

      // Prevent duplicates
      const existing = registry.files.find(
        (f) => f.path === filePath && f.issueId === issueId,
      );
      if (existing) {
        return { ok: true, file: existing, duplicate: true };
      }

      const newFile: RegisteredFile = {
        id: makeId(),
        path: filePath,
        issueId,
        addedAt: new Date().toISOString(),
        addedBy,
        reviewStatus: "pending",
      };
      registry.files.push(newFile);
      await saveRegistry(ctx, registry);
      return { ok: true, file: newFile, duplicate: false };
    });
  },

  async onHealth() {
    return { status: "ok", message: `${PLUGIN_NAME} ready` };
  },
});

export default plugin;
runWorker(plugin, import.meta.url);
