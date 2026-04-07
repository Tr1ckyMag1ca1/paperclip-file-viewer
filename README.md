# paperclip-file-viewer

A [Paperclip](https://github.com/paperclipai/paperclip) plugin for reviewing agent-produced documents linked to issues.

## What it does

- **Document inbox** -- all agent-produced documents start as "pending" for your review
- **Review workflow** -- approve, request changes, reject, or dismiss documents
- **Issue integration** -- reviews post comments back to the linked issue
- **Agent wake-up** -- optionally wake the assigned agent when revisions are requested
- **Issue context** -- see the linked issue's details without leaving the review UI
- **Filtering** -- filter by review status, search across document names and issue identifiers

The plugin adds a **Document Review** page to your Paperclip sidebar at `/{companyPrefix}/file-viewer`.

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Worker | `src/worker.ts` | Reads native Paperclip issue documents via the SDK. Review state stored in plugin state (scoped per-issue). Actions: review, dismiss, reset-review. |
| UI | `src/ui/index.tsx` | Inbox/Approved/Dismissed/All tabs, document content preview, issue context panel, inline review actions with optional agent wake-up. |
| Manifest | `src/manifest.ts` | Plugin metadata, capabilities, and UI slot declarations. |

### How it works

Unlike v0.3 which maintained a separate file store, v0.4 reads documents directly from Paperclip's native issue document system via `ctx.issues.documents`. Review state (pending/approved/changes_requested/rejected/dismissed) is stored as a plugin state overlay scoped to each issue+document.

When you review a document:
1. The review status is saved in plugin state
2. A comment is posted on the linked issue (e.g. "Document Review: approved document `post`")
3. If you request changes or reject, you can optionally wake the assigned agent with your feedback

### Capabilities

- `plugin.state.read` / `plugin.state.write` -- review state storage
- `companies.read` / `issues.read` / `issue.documents.read` -- read documents
- `issue.comments.create` -- post review comments on issues
- `agents.read` / `agents.invoke` -- wake agents for revisions
- `ui.page.register` / `ui.sidebar.register` -- UI slots

## Install

```bash
npx paperclipai plugin install ./paperclip-file-viewer --local
```

## Build

```bash
npm install
npm run build
```

## Review Statuses

| Status | Meaning |
|--------|---------|
| **pending** | Needs review (default for all documents) |
| **approved** | Content approved |
| **changes_requested** | Revisions needed (agent can be woken) |
| **rejected** | Content rejected (agent can be woken) |
| **dismissed** | No review needed (removed from inbox) |

## Built by AI

This plugin was designed, coded, and debugged entirely by Paperclip AI agents running on a self-hosted Paperclip instance. v0.4 upgrade designed by Claude.

## License

MIT
