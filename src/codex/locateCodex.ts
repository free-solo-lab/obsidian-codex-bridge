import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Where the Codex CLI usually lives when it is not on Obsidian's PATH. */
const KNOWN_LOCATIONS = [
  join(homedir(), ".local/bin/codex"),
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
  "/Applications/Codex.app/Contents/Resources/codex",
  "/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex",
];

/** Whether the resolved path points at a real file; a bare `codex` may still be found on PATH. */
export function isResolvedOnDisk(path: string): boolean {
  return path.includes("/") || path.includes("\\") ? existsSync(path) : false;
}

/** An explicit path wins; the bare name `codex` is resolved through the known locations, then PATH. */
export function locateCodex(configured: string): string {
  const explicit = configured.trim();
  if (explicit && explicit !== "codex") return explicit;
  return KNOWN_LOCATIONS.find(existsSync) ?? "codex";
}
