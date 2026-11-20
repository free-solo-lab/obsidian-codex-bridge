# Security policy

## What Codex Bridge does and does not do

- The plugin itself makes **no network requests** and opens **no listening port**. It talks to a local `codex app-server` child process over stdio (`shell: false`, fixed arguments).
- Network traffic is made by the Codex CLI you installed, to the service your Codex account uses. Task text and images leave your machine through Codex only, never through this plugin.
- No account tokens, API keys or task content are stored in Obsidian settings or logged. Sign-in is handled by Codex; the plugin only opens the sign-in address the server returns, and only for `https:` (the ChatGPT sign-in is further limited to OpenAI hosts).
- Each task runs in a fresh empty temporary directory, never in your vault. Shell tools are off, apps and MCP servers are off unless you allowed them, and any unexpected tool call stops the task and the server. Requests for approvals from the server are always refused.
- Images are accepted only as inline PNG/JPEG/WebP data (up to 20 MB); nothing is fetched or written to disk.

## Things to be aware of

- **Plugins share one process.** Codex Bridge keeps its settings and server administration out of the object other plugins receive, and the public API only exposes tasks, but Obsidian has no isolation between plugins. A malicious plugin can still read or edit this plugin's `data.json`, or call Codex itself. Treat every plugin you install, and any full-access switch you enable, as trusted code. The `caller` field on a task is a label for usage counts, not an identity or permission.
- **Conversation threads stay on disk.** `runInThread` conversations are stored in your Codex history (`~/.codex`), like any Codex chat. Plain `run` tasks use ephemeral threads.

- The **Codex executable** setting is run as a program. Only point it at a binary you trust, and do not open vaults whose `.obsidian/plugins/free-solo-codex-bridge/data.json` you did not create.
- **Full access** (off by default) lets a plugin that asks use web search and the MCP servers and Codex apps you allowed. Page and tool content can try to steer the model; enable it only for plugins you trust.
- The Codex read-only sandbox is not a strict filesystem-read isolation boundary.

## Reporting a vulnerability

Please report it privately through GitHub's **Report a vulnerability** (Security tab) on this repository instead of a public issue. Include the plugin version, Codex CLI version and steps to reproduce.
