# Changelog

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
