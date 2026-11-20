/** One JSON-RPC line exchanged with `codex app-server`. */
export interface RpcMessage {
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { message?: string };
}

/** What the bridge needs from the server connection; tests substitute a fake. */
export interface RpcTransport {
  start(): Promise<void>;
  stop(): void;
  request<T>(method: string, params?: unknown, timeout?: number): Promise<T>;
  onMessage(listener: (message: RpcMessage) => void): () => void;
  /** Codex CLI version reported during the handshake, when known. */
  serverVersion?(): string | undefined;
}

/** Synthetic notification the transport sends to its listeners when the server goes away. */
export const BRIDGE_STOPPED = "bridge/stopped";
