/** Names Codex accepts inside configuration key paths such as `mcp_servers.<name>`. */
const CONFIG_NAME = /^[A-Za-z0-9_-]+$/;
/** Server names this plugin is willing to write into the Codex configuration. */
const MCP_SERVER_NAME = /^[A-Za-z0-9_-]{1,40}$/;

export function isConfigName(name: string): boolean {
  return CONFIG_NAME.test(name);
}

export function isMcpServerName(name: string): boolean {
  return MCP_SERVER_NAME.test(name);
}

/** Codex matches server and app names without regard to case; so does the bridge. */
export function sameName(left: string, right: string | undefined): boolean {
  return right !== undefined && left.toLowerCase() === right.toLowerCase();
}

/** "a, b c" → ["a", "b", "c"]: the allowlist as the user types it in settings. */
export function parseNameList(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

/** The allowlist with `name` switched on or off, keeping the other entries. */
export function toggleNameInList(text: string, name: string, enabled: boolean): string {
  const names = parseNameList(text).filter((item) => !sameName(item, name));
  if (enabled) names.push(name);
  return names.join(", ");
}
