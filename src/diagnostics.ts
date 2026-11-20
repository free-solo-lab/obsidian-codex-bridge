export interface DiagnosticsInfo {
  pluginVersion: string;
  obsidianVersion: string;
  platform: string;
  codexVersion?: string;
  configuredExecutable: string;
  resolvedExecutable: string;
  state: string;
  message?: string;
  fullAccessAllowed: boolean;
  /** Task counts per declared caller since Obsidian started. */
  usage: Record<string, number>;
}

/**
 * Plain text for a bug report. It never contains task content, account details or tokens; the
 * executable paths are the only user-specific values, and the user sees the text before sharing it.
 */
export function buildDiagnostics(info: DiagnosticsInfo): string {
  const usage = Object.entries(info.usage)
    .sort(([, left], [, right]) => right - left)
    .map(([caller, count]) => `${caller}: ${count}`)
    .join(", ");
  return [
    `Codex Bridge ${info.pluginVersion}`,
    `Obsidian ${info.obsidianVersion} · ${info.platform}`,
    `Codex CLI: ${info.codexVersion ?? "unknown"}`,
    `Executable: ${info.configuredExecutable} → ${info.resolvedExecutable}`,
    `State: ${info.state}${info.message ? ` (${info.message})` : ""}`,
    `Full access allowed: ${info.fullAccessAllowed ? "yes" : "no"}`,
    `Tasks since start: ${usage || "none"}`,
  ].join("\n");
}
