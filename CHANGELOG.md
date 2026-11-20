# Changelog

## 1.0.2

- Release assets carry GitHub build-provenance attestations (`gh attestation verify main.js --repo free-solo-lab/obsidian-codex-bridge`).
- Settings headings use Obsidian's heading API; timers work in popout windows; no `localStorage` use (minimum Obsidian version is now 1.8.0); stricter typing of messages from the Codex server.
- Fixed a crash when stopping the server: `unref` was called on a browser timer handle.

## 1.0.1

- The plugin id is now `free-solo-codex-bridge` and the name **Free Solo Codex Bridge**, because `codex-bridge` is taken in the Obsidian community catalog. Other plugins must read `app.plugins.plugins["free-solo-codex-bridge"].api`. If you installed 1.0.0 by hand, enable the plugin again after updating.

## 1.0.0

First public release.

- Shared, versioned API (`run`, `runInThread`, status, capabilities) for other Obsidian plugins.
- One local `codex app-server` over stdio; no network access of its own, no listening port.
- Text and image tasks in a read-only, tool-free session; opt-in full access (web search, allowed MCP servers and Codex apps).
- All user-visible messages, errors and progress lines are localized (English, Russian).
- Codex CLI version check with a warning for versions older than the tested one.
- Empty default model uses the first model the account offers.
- Optional `caller` on tasks (usage counts); **Copy diagnostics** in settings; a hint when Codex cannot be found.
- Stable `BridgeError.code` for handled failures; settings and administration kept private to the plugin.
- Security policy and CI.
