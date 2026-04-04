# paperclip-file-viewer

A [Paperclip](https://github.com/paperclipai/paperclip) plugin for browsing and reviewing files linked to issues -- built entirely by AI agents.

## What it does

- **Register files against issues** -- link file paths to any Paperclip issue for tracking
- **Review workflow** -- mark files as pending, approved, or rejected with reviewer notes
- **Browse linked files** -- see all files associated with an issue in a dedicated detail tab
- **Duplicate detection** -- prevents the same file from being registered twice on the same issue

The plugin adds a "Files" tab to issue detail pages where you can add file paths, view linked files, and track their review status.

## Architecture

| Layer | File | Description |
|-------|------|-------------|
| Worker | `src/worker.ts` | Data handlers (`files`, `file`, `review`) and action handler (`register-file`). State is stored at instance scope via the plugin state API. |
| UI | `src/ui/index.tsx` | React component rendered in the issue detail tab. Uses `usePluginData` and `usePluginAction` from the SDK. |
| Manifest | `src/manifest.ts` | Plugin metadata, capabilities (`plugin.state.read`, `plugin.state.write`, `ui.page.register`), and UI slot declarations. |

## Install

```bash
npx paperclipai plugin install ./paperclip-file-viewer --local
```

Or if cloned from GitHub:

```bash
git clone https://github.com/Tr1ckyMag1ca1/paperclip-file-viewer.git
npx paperclipai plugin install ./paperclip-file-viewer --local
```

## Build

```bash
npm install
npm run build
```

## Built by AI

This plugin was designed, coded, and debugged entirely by Paperclip AI agents running on a self-hosted Paperclip instance. No human wrote any of the source code.

## Screenshots

<!-- Screenshots will be added here -->

*Coming soon*

## License

MIT
