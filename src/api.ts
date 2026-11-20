/**
 * The contract other plugins receive through `app.plugins.plugins["free-solo-codex-bridge"].api`.
 * Shapes here are public: additions are fine, renames and removals are breaking.
 */

export interface CodexModel {
  id: string;
  model: string;
  displayName: string;
  inputModalities: string[];
}

export interface BridgeStatus {
  state: "stopped" | "starting" | "ready" | "error";
  queued: number;
  busy: boolean;
  message?: string;
  /** Codex CLI version once the server has started. */
  codexVersion?: string;
}

export interface BridgeCapabilities {
  fullAccess: boolean;
  mcpServers: string[];
  /** Names of the Codex apps (connectors such as Readwise) allowed for full access. */
  apps: string[];
}

export interface CodexTask {
  /** Your plugin id (`manifest.id`). Used only for the usage count in diagnostics; it is not a permission check. */
  caller?: string;
  prompt: string;
  instructions?: string;
  model?: string;
  images?: { url: string }[];
  outputSchema?: Record<string, unknown>;
  /**
   * "full" adds web search, the MCP servers and the Codex apps the user allowed in Bridge
   * settings (never shell or files). Rejected unless the user enabled it.
   */
  access?: "text" | "full";
  signal?: AbortSignal;
  onProgress?: (message: string) => void;
  /** The response so far (not a delta), at most about ten times a second and once more with the final text. */
  onText?: (text: string) => void;
}

/** A task that continues one persistent Codex conversation (a thread kept in the Codex history). */
export interface CodexThreadTask extends CodexTask {
  /** Thread to continue; omit to start a new one. */
  threadId?: string;
  /** Name given to a new thread in the Codex history. */
  title?: string;
}

export interface CodexThreadResult {
  text: string;
  threadId: string;
}

/** Stable identifiers for failures a plugin may want to handle; the message text is localized and may change. */
export type BridgeErrorCode =
  | "cancelled"
  | "sign_in_required"
  | "model_unavailable"
  | "choose_model"
  | "full_access_off"
  | "tool_blocked"
  | "timeout"
  | "server_stopped"
  | "no_text";

/** Thrown for the failures in `BridgeErrorCode`; check `code`, never the message. */
export class BridgeError extends Error {
  constructor(
    readonly code: BridgeErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown by `runInThread` when `threadId` no longer exists (deleted, other Codex home). */
export class ThreadMissingError extends Error {
  readonly code = "thread_missing";

  constructor() {
    super("Codex thread not found.");
  }
}

export interface CodexBridgeApi {
  readonly version: 1;
  getStatus(): BridgeStatus;
  /** What `access: "full"` would allow right now, as set by the user in Bridge settings. */
  getCapabilities(): BridgeCapabilities;
  onStatus(listener: (status: BridgeStatus) => void): () => void;
  start(): Promise<void>;
  stop(): void;
  listModels(): Promise<CodexModel[]>;
  readAccount(): Promise<{ account: { type: string; planType?: string } | null }>;
  login(): Promise<{ authUrl: string; loginId: string }>;
  run(task: CodexTask): Promise<string>;
  /** Like `run`, but in a persistent thread: later calls with the returned `threadId` see everything said before. */
  runInThread(task: CodexThreadTask): Promise<CodexThreadResult>;
}

/*
 * The entries below are shown in Bridge settings only; deliberately not part of the API
 * other plugins receive.
 */

/** A Codex app (ChatGPT connector) as the settings tab lists it. */
export interface CodexAppEntry {
  id: string;
  name: string;
  allowed: boolean;
}

export interface McpServerEntry {
  name: string;
  origin?: string;
  runtime: string;
  auth: string;
  allowed: boolean;
}
