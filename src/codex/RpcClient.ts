import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { t } from "../i18n/messages";
import manifest from "../../manifest.json";
import { Listeners } from "../utils/listeners";
import { BridgeError } from "../api";
import { parseCodexVersion } from "./version";
import { locateCodex } from "./locateCodex";
import { BRIDGE_STOPPED, type RpcMessage, type RpcTransport } from "./transport";

export type SpawnProcess = (
  executable: string,
  args: string[],
  cwd: string,
) => ChildProcessWithoutNullStreams;

const defaultSpawn: SpawnProcess = (executable, args, cwd) =>
  spawn(executable, args, { cwd, stdio: "pipe", shell: false });

/** Process-wide defaults; every thread repeats the tool switches in its own config as well. */
const SERVER_ARGS = [
  "app-server",
  "--listen",
  "stdio://",
  "-c",
  "features.shell_tool=false",
  "-c",
  'web_search="disabled"',
  "-c",
  "features.apps=false",
];

const DEFAULT_REQUEST_TIMEOUT = 30_000;
const KILL_GRACE_PERIOD = 2_000;

interface PendingRequest {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timer: ReturnType<typeof setTimeout>;
}

/** Owns one `codex app-server` child process and speaks line-delimited JSON-RPC with it over stdio. */
export class RpcClient implements RpcTransport {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 0;
  private readonly pending = new Map<number, PendingRequest>();
  private readonly listeners = new Listeners<RpcMessage>();
  private starting: Promise<void> | null = null;
  private ready = false;
  private version: string | undefined;

  constructor(
    private readonly executable: () => string,
    private readonly factory: SpawnProcess = defaultSpawn,
    private readonly onExit: (error: Error) => void = () => undefined,
  ) {}

  serverVersion(): string | undefined {
    return this.version;
  }

  onMessage(listener: (message: RpcMessage) => void): () => void {
    return this.listeners.subscribe(listener);
  }

  /** Concurrent callers share one handshake. */
  start(): Promise<void> {
    if (this.ready) return Promise.resolve();
    if (this.starting) return this.starting;
    this.starting = this.open().finally(() => {
      this.starting = null;
    });
    return this.starting;
  }

  private async open(): Promise<void> {
    const child = this.factory(locateCodex(this.executable()), SERVER_ARGS, tmpdir());
    this.child = child;
    const lines = createInterface({ input: child.stdout });
    lines.on("line", (line) => {
      if (this.child === child) this.receive(line);
    });
    child.stderr.on("data", () => {
      /* Drain diagnostics without logging credentials or task content. */
    });
    child.once("error", () => {
      if (this.child === child) {
        this.fail(
          new Error(t("error.startFailed")),
        );
      }
    });
    child.once("exit", () => {
      lines.close();
      if (this.child === child) this.fail(new BridgeError("server_stopped", t("error.serverExited")));
    });
    try {
      const handshake = await this.request<{ userAgent?: string }>("initialize", {
        clientInfo: {
          name: "obsidian_codex_bridge",
          title: "Obsidian Codex Bridge",
          version: manifest.version,
        },
      });
      this.version = parseCodexVersion(handshake?.userAgent);
      this.send({ method: "initialized", params: {} });
      this.ready = true;
    } catch (error) {
      this.stop();
      throw error;
    }
  }

  private receive(line: string): void {
    let message: RpcMessage;
    try {
      message = JSON.parse(line);
    } catch {
      this.fail(new Error(t("error.invalidMessage")));
      return;
    }
    if (message.method && message.id != null) {
      // A request from the server: this bridge never grants approvals or runs client tools.
      this.send({
        id: message.id,
        error: { code: -32601, message: "This bridge does not allow tool calls or approvals." },
      });
      return;
    }
    if (typeof message.id === "number") {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      clearTimeout(pending.timer);
      if (message.error) pending.reject(new Error(message.error.message ?? t("error.requestFailed")));
      else pending.resolve(message.result);
      return;
    }
    this.listeners.notify(message);
  }

  private send(message: unknown): void {
    if (!this.child) throw new Error(t("error.serverNotRunning"));
    this.child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  request<T = unknown>(method: string, params: unknown = {}, timeout = DEFAULT_REQUEST_TIMEOUT): Promise<T> {
    const id = ++this.nextId;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(t("error.requestTimedOut", { method })));
      }, timeout);
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  private fail(error: Error): void {
    this.stop(error);
    this.onExit(error);
  }

  /** Rejects pending requests, tells listeners, then terminates the child (SIGKILL after a grace period). */
  stop(error: Error = new BridgeError("server_stopped", t("error.serverStopped"))): void {
    this.ready = false;
    const child = this.child;
    this.child = null;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
    this.listeners.notify({ method: BRIDGE_STOPPED, params: { message: error.message } });
    if (!child) return;
    child.stdin.end();
    child.kill("SIGTERM");
    const timer = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }, KILL_GRACE_PERIOD);
    timer.unref();
  }
}
