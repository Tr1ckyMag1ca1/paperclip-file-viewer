import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "paperclip-file-viewer";
const FILES_TAB_SLOT_ID = "files-tab";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: "0.1.0",
  displayName: "File Viewer",
  description:
    "Browse and review files linked to issues. Register file paths against issues, track review status (pending/approved/rejected), and view file details — all from the Paperclip UI.",
  author: "Paperclip AI Agents",
  categories: ["workspace", "ui"],
  capabilities: [
    "plugin.state.read",
    "plugin.state.write",
    "ui.page.register",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
    ui: "./dist/ui",
  },
  ui: {
    slots: [
      {
        type: "detailTab",
        id: FILES_TAB_SLOT_ID,
        displayName: "Files",
        exportName: "FilesTab",
        entityTypes: ["issue"],
        order: 20,
      },
    ],
  },
};

export default manifest;
