# paperclip-file-viewer

A [Paperclip](https://github.com/paperclipai/paperclip) plugin for browsing and reviewing files linked to issues -- built entirely by AI agents.

## What it does

- **File registry** -- agents register files they create or modify, linking them to issues
- **Review workflow** -- board users can approve, reject, or request changes on flagged files
- **Review Queue** -- a dedicated page showing all files pending review
- **Browse all files** -- search and filter across every registered file
- **Seed data** -- 3 example files are created automatically on first load

The plugin adds a **File Viewer** page to your Paperclip sidebar at `/{companyPrefix}/file-viewer`.

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Worker | `src/worker.ts` | Data handlers (`files`, `file`) and action handlers (`review`, `register-file`). State stored at instance scope via the plugin state API -- no external server required. |
| UI | `src/ui/index.tsx` | Full-page React component with Review Queue / All Files tabs, file content preview, and inline review actions. |
| Manifest | `src/manifest.ts` | Plugin metadata, capabilities, and UI slot declarations. |

### Capabilities

- `plugin.state.read` -- read file registry from plugin state
- `plugin.state.write` -- write file registry to plugin state
- `ui.page.register` -- register the File Viewer page in the sidebar

## Install

Requires board-level authentication:

```bash
npx paperclipai plugin install ./paperclip-file-viewer --local
```

Or from GitHub:

```bash
git clone https://github.com/Tr1ckyMag1ca1/paperclip-file-viewer.git
npx paperclipai plugin install ./paperclip-file-viewer --local
```

## Build

```bash
npm install
npm run build
```

## How to Register Files

### From Agent Code (via Paperclip API)

Agents register files using the plugin's `register-file` action through the bridge endpoint. This requires board-level auth or must be called from the plugin UI context.

```
POST /api/plugins/{pluginId}/actions/register-file
Content-Type: application/json
```

The params go inside a `params` wrapper:

```json
{
  "companyId": "your-company-uuid",
  "params": {
    "name": "AGENTS.md",
    "path": "/agents/founding-engineer/AGENTS.md",
    "content": "# Founding Engineer\n\nFull file content here...",
    "file_type": "text",
    "linked_issue_id": "ALE-85",
    "creating_agent_id": "founding-engineer",
    "flagged_for_review": true
  }
}
```

**Required fields:** `name`, `path`

**Optional fields:**
- `content` -- full file content (string, defaults to null)
- `file_type` -- `"text"` (default) or `"image"`
- `linked_issue_id` -- Paperclip issue identifier (e.g. `"ALE-85"`)
- `linked_task_id` -- task UUID
- `creating_agent_id` -- agent URL key or ID
- `flagged_for_review` -- `true` to put the file in the Review Queue

### From the Plugin UI

The UI's "Review Queue" and "All Files" tabs let board users browse files. Review actions (approve / request changes / reject) are available inline for each file.

### Via Plugin SDK (inside another plugin worker)

```typescript
await ctx.actions.invoke("register-file", {
  name: "deploy.sh",
  path: "/scripts/deploy.sh",
  content: "#!/bin/bash\necho 'deploying...'",
  creating_agent_id: "founding-engineer",
  flagged_for_review: true,
});
```

## Reviewing Files

From the UI, select a file and choose:

- **Approve** -- sets `review_status: "approved"`
- **Request Changes** -- sets `review_status: "changes_requested"` (add a note)
- **Reject** -- sets `review_status: "rejected"`

Or via API:

```
POST /api/plugins/{pluginId}/actions/review
```

```json
{
  "companyId": "your-company-uuid",
  "params": {
    "id": "file-001",
    "action": "approve",
    "note": "Looks good."
  }
}
```

## Finding the Plugin ID

```
GET /api/plugins
```

Look for `pluginKey: "paperclipai.plugin-file-viewer"` and copy its `id`.

## What Documents Should Agents Register

- **AGENTS.md** -- agent instructions / role definitions
- **Planning documents** from completed issues
- **SOPs or reference guides** agents maintain
- **Output artifacts** that need board review (set `flagged_for_review: true`)

## Data Model

Files are stored in Paperclip plugin state under key `file-store` with `scopeKind: "instance"`:

```typescript
{
  id: string;                    // auto-generated (e.g. "file-1712234567890")
  name: string;                  // display name (e.g. "AGENTS.md")
  path: string;                  // logical path (e.g. "/agents/ceo/AGENTS.md")
  file_type: "text" | "image";
  content: string | null;        // full file content
  linked_issue_id: string | null;   // e.g. "ALE-85"
  linked_task_id: string | null;
  creating_agent_id: string | null; // e.g. "founding-engineer"
  flagged_for_review: boolean;
  review_status: "pending" | "approved" | "changes_requested" | "rejected";
  created_at: string;            // ISO timestamp
  updated_at: string;
  reviews: ReviewRecord[];       // append-only review history
}
```

## Built by AI

This plugin was designed, coded, and debugged entirely by Paperclip AI agents running on a self-hosted Paperclip instance. The human operator installed it and filed bug reports -- the agents did the rest.

## License

MIT
