export interface AllowedAppSetting {
  id: string;
  name: string;
}

export interface BridgeSettings {
  /** `codex`, or a full path to the executable. */
  executable: string;
  /** Model used when a task does not name one; empty means the first model the account offers. */
  model: string;
  autoStart: boolean;
  /** Whether tasks may ask for web search, MCP servers and Codex apps. */
  allowFullAccess: boolean;
  /** Comma- or space-separated MCP server names usable with full access. */
  mcpAllowlist: string;
  /** MCP servers this plugin wrote into the Codex configuration, so it may remove them again. */
  managedMcp: string[];
  allowedApps: AllowedAppSetting[];
}

export const DEFAULT_SETTINGS: BridgeSettings = {
  executable: "codex",
  model: "",
  autoStart: false,
  allowFullAccess: false,
  mcpAllowlist: "",
  managedMcp: [],
  allowedApps: [],
};

export const DEFAULT_EXECUTABLE = DEFAULT_SETTINGS.executable;
