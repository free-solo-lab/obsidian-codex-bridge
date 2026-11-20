import type { RpcMessage, RpcTransport } from "../../src/codex/transport";

/**
 * A scripted `codex app-server`: records every request and answers the handful of methods the
 * bridge uses. `hold` keeps a turn open until the test calls `release`.
 */
export class FakeTransport implements RpcTransport {
  calls: { method: string; params: Record<string, unknown> }[] = [];
  listeners = new Set<(message: RpcMessage) => void>();
  release: (() => void) | undefined;
  hold = false;
  account = true;
  models = [{ id: "vision", model: "vision", displayName: "Vision", inputModalities: ["image", "text"] }];
  counter = 0;
  missing = false;

  start(): Promise<void> {
    return Promise.resolve();
  }

  stop(): void {
    this.emit("bridge/stopped", {});
  }

  onMessage(listener: (message: RpcMessage) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(method: string, params: Record<string, unknown>): void {
    for (const listener of this.listeners) listener({ method, params });
  }

  count(method: string): number {
    return this.calls.filter((call) => call.method === method).length;
  }

  first(method: string): Record<string, unknown> {
    const call = this.calls.find((item) => item.method === method);
    if (!call) throw new Error(`No ${method} call was made.`);
    return call.params;
  }

  last(method: string): Record<string, unknown> {
    const call = [...this.calls].reverse().find((item) => item.method === method);
    if (!call) throw new Error(`No ${method} call was made.`);
    return call.params;
  }

  async request<T>(method: string, value: unknown = {}): Promise<T> {
    const params = value as Record<string, unknown>;
    this.calls.push({ method, params });
    let result: unknown = {};
    if (method === "account/read") result = { account: this.account ? { type: "chatgpt" } : null };
    if (method === "model/list") result = { data: this.models, nextCursor: null };
    if (method === "thread/start") result = { thread: { id: `thread-${++this.counter}` } };
    if (method === "config/read") result = { config: { mcp_servers: { alpha: {}, readwise: {} } } };
    if (method === "mcpServerStatus/list") result = { data: [{ name: "beta" }, { name: "weird.name" }] };
    if (method === "app/installed") {
      result = {
        apps: [
          { id: "asdk_app_rw", runtimeName: "Readwise", enabled: false },
          { id: "connector_mail", runtimeName: "Mail", enabled: false },
        ],
      };
    }
    if (method === "mcpServer/oauth/login") result = { authorizationUrl: "https://auth.example/authorize?x=1" };
    if (method === "thread/resume") {
      if (this.missing) throw new Error("no rollout found for thread id " + String(params.threadId));
      result = { thread: { id: String(params.threadId) } };
    }
    if (method === "turn/start") {
      const threadId = String(params.threadId);
      this.emit("turn/started", { threadId, turn: { id: "turn" } });
      const complete = () => {
        this.emit("item/completed", {
          threadId,
          item: { type: "agentMessage", phase: "commentary", text: "Working…" },
        });
        this.emit("item/completed", {
          threadId,
          item: { type: "agentMessage", phase: "final_answer", text: '{"text":"recognized"}' },
        });
        this.emit("turn/completed", { threadId, turn: { id: "turn", status: "completed" } });
      };
      this.release = complete;
      if (!this.hold) queueMicrotask(complete);
      result = { turn: { id: "turn" } };
    }
    if (method === "turn/interrupt") {
      this.emit("turn/completed", { threadId: params.threadId, turn: { status: "interrupted" } });
    }
    return result as T;
  }
}

/** Polls `predicate` briefly; fails the test when it never becomes true. */
export async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100 && !predicate(); attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  if (!predicate()) throw new Error("Condition was not met in time.");
}
