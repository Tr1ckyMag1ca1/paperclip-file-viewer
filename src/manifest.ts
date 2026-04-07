import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "paperclipai.plugin-file-viewer",
  apiVersion: 1,
  version: "0.4.0",
  displayName: "Document Review",
  description:
    "Review agent-produced documents linked to Paperclip issues. Approve, request changes, reject, or dismiss — with comments posted back to the issue and optional agent wake-up for revisions.",
  author: "Paperclip AI Agents",
  categories: ["ui", "workspace"],
  capabilities: [
    // Read
    "plugin.state.read",
    "plugin.state.write",
    "companies.read",
    "issues.read",
    "issue.comments.read",
    "issue.documents.read",
    "agents.read",
    // Write
    "issues.update",
    "issue.comments.create",
    "issue.documents.write",
    "agents.invoke",
    // UI
    "ui.page.register",
    "ui.sidebar.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  instanceConfigSchema: {
    type: "object",
    properties: {
      autoIndexDocuments: {
        type: "boolean",
        title: "Auto-Index Issue Documents",
        description:
          "Automatically discover all issue documents when listing. Disable for manual registration only.",
        default: true,
      },
      maxFilesPerPage: {
        type: "number",
        title: "Documents Per Page",
        description: "Maximum number of documents shown in the sidebar list.",
        default: 100,
      },
    },
  },
  ui: {
    slots: [
      {
        type: "page",
        id: "file-viewer-page",
        displayName: "Document Review",
        routePath: "file-viewer",
        exportName: "FileViewerPage",
      },
      {
        type: "sidebar",
        id: "file-viewer-sidebar",
        displayName: "File Viewer",
        exportName: "FileViewerSidebar",
      },
    ],
  },
};

export default manifest;
