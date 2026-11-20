import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  BridgeError,
  ThreadMissingError,
  type BridgeCapabilities,
  type BridgeStatus,
  type CodexAppEntry,
  type CodexBridgeApi,
  type CodexModel,
  type CodexTask,
  type CodexThreadResult,
  type CodexThreadTask,
  type McpServerEntry,
} from "../api";
import { t } from "../i18n/messages";
import { errorMessage } from "../utils/errors";
import { Listeners } from "../utils/listeners";
import { isOlderThanTested, TESTED_CODEX_VERSION } from "./version";
import { CodexAdmin } from "./CodexAdmin";
import { RpcClient } from "./RpcClient";
import { cancelledError, runTurn } from "./runTurn";
import {
  developerInstructions,
  findModel,
  isSupportedImage,
  isThreadMissingMessage,
  threadConfig,
  type BridgePolicy,
} from "./taskPolicy";
import type { RpcTransport } from "./transport";

export type { AllowedApp, BridgePolicy } from "./taskPolicy";
export type { RpcTransport } from "./transport";

/** Signed-in state and model list are reused this long between tasks. */
const CATALOG_TTL = 60_000;
const CONFIG_READ_TIMEOUT = 10_000;
/** Naming and unsubscribing a thread are best effort. */
const HOUSEKEEPING_TIMEOUT = 5_000;
const THREAD_NAME_LIMIT = 120;
const NO_POLICY: () => BridgePolicy = () => ({ fullAccess: false, mcpServers: [], apps: [] });

interface ThreadOptions {
  threadId?: string;
  title?: string;
}

interface Catalog {
  models: CodexModel[];
  cached: boolean;
}

/**
 * The bridge itself: one server connection, one task queue shared by every consumer, and the
 * settings-only administration. `publicApi` narrows it to what other plugins may call.
 */
export class BridgeService implements CodexBridgeApi {
  readonly version = 1 as const;
  private readonly state: BridgeStatus = { state: "stopped", queued: 0, busy: false };
  private readonly listeners = new Listeners<BridgeStatus>();
  private queue: Promise<unknown> = Promise.resolve();
  /** Bumped on every stop or crash: queued work and caches from an older epoch are discarded. */
  private epoch = 0;
  private mcpNamesCache: { epoch: number; names: string[] } | undefined;
  private catalogCache: { epoch: number; at: number; models: CodexModel[] } | undefined;
  private readonly transport: RpcTransport;
  private readonly admin: CodexAdmin;
  private readonly usageByCaller = new Map<string, number>();

  constructor(
    executable: () => string,
    private readonly defaultModel: () => string,
    transport?: RpcTransport,
    private readonly policy: () => BridgePolicy = NO_POLICY,
  ) {
    this.transport =
      transport ??
      new RpcClient(executable, undefined, (error) => {
        this.epoch++;
        this.setStatus({ state: "error", message: error.message });
      });
    this.admin = new CodexAdmin(
      this.transport,
      this.policy,
      () => this.start(),
      () => {
        this.mcpNamesCache = undefined;
      },
    );
    this.transport.onMessage((message) => {
      const params = message.params ?? {};
      if (message.method === "mcpServer/oauthLogin/completed") {
        this.mcpNamesCache = undefined;
        this.setStatus({
          message: params.success
            ? t("status.mcpSignedIn", { name: String(params.name) })
            : params.error
              ? t("status.mcpSignInFailedWith", { error: String(params.error) })
              : t("status.mcpSignInFailed"),
        });
      }
      if (message.method === "account/login/completed") {
        this.catalogCache = undefined;
        this.setStatus({ message: params.success ? t("status.signedIn") : t("status.signInFailed") });
      }
    });
  }

  getStatus(): BridgeStatus {
    return { ...this.state };
  }

  getCapabilities(): BridgeCapabilities {
    const { fullAccess, mcpServers, apps } = this.policy();
    return { fullAccess, mcpServers: [...mcpServers], apps: apps.map((app) => app.name) };
  }

  onStatus(listener: (status: BridgeStatus) => void): () => void {
    return this.listeners.subscribe(listener);
  }

  private setStatus(changes: Partial<BridgeStatus>): void {
    Object.assign(this.state, changes);
    this.listeners.notify(this.getStatus());
  }

  async start(): Promise<void> {
    if (this.state.state === "ready") return;
    this.setStatus({ state: "starting", message: undefined });
    try {
      await this.transport.start();
      const codexVersion = this.transport.serverVersion?.();
      this.setStatus({
        state: "ready",
        codexVersion,
        message:
          codexVersion && isOlderThanTested(codexVersion)
            ? t("warning.codexOld", { version: codexVersion, tested: TESTED_CODEX_VERSION })
            : undefined,
      });
    } catch (error) {
      this.setStatus({ state: "error", message: errorMessage(error) });
      throw error;
    }
  }

  stop(): void {
    this.epoch++;
    this.transport.stop();
    this.setStatus({ state: "stopped", message: undefined });
  }

  async readAccount(): Promise<{ account: { type: string; planType?: string } | null }> {
    await this.start();
    return this.transport.request("account/read", { refreshToken: false });
  }

  async login(): Promise<{ authUrl: string; loginId: string }> {
    await this.start();
    return this.transport.request("account/login/start", { type: "chatgpt" });
  }

  async listModels(): Promise<CodexModel[]> {
    await this.start();
    const models: CodexModel[] = [];
    let cursor: string | null = null;
    do {
      const page: { data: CodexModel[]; nextCursor: string | null } = await this.transport.request(
        "model/list",
        { cursor, limit: 100 },
      );
      models.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);
    return models;
  }

  run(task: CodexTask): Promise<string> {
    return this.schedule(task, async () => (await this.execute(task)).text);
  }

  runInThread(task: CodexThreadTask): Promise<CodexThreadResult> {
    return this.schedule(task, () =>
      this.execute(task, { threadId: task.threadId?.trim() || undefined, title: task.title }),
    );
  }

  // Settings-only administration, delegated so other plugins never see it.

  /** Task counts per declared caller since Obsidian started. */
  usage(): Record<string, number> {
    return Object.fromEntries(this.usageByCaller);
  }

  mcpServers(): Promise<McpServerEntry[]> {
    return this.admin.mcpServers();
  }

  apps(): Promise<CodexAppEntry[]> {
    return this.admin.apps();
  }

  addMcpServer(name: string, url: string): Promise<void> {
    return this.admin.addMcpServer(name, url);
  }

  removeMcpServer(name: string): Promise<void> {
    return this.admin.removeMcpServer(name);
  }

  loginMcpServer(name: string): Promise<{ authorizationUrl: string }> {
    return this.admin.loginMcpServer(name);
  }

  /**
   * One queue for every consumer. A task that is cancelled while waiting leaves the queue at
   * once; a stop of the server discards everything queued before it.
   */
  private schedule<T>(task: CodexTask, work: () => Promise<T>): Promise<T> {
    const epoch = this.epoch;
    const caller = task.caller?.trim() || "unknown";
    this.usageByCaller.set(caller, (this.usageByCaller.get(caller) ?? 0) + 1);
    if (task.signal?.aborted) return Promise.reject(cancelledError());
    let waiting = true;
    let counted = true;
    let resolveResult!: (value: T) => void;
    let rejectResult!: (error: unknown) => void;
    const result = new Promise<T>((resolve, reject) => {
      resolveResult = resolve;
      rejectResult = reject;
    });
    const leaveQueue = () => {
      if (!counted) return;
      counted = false;
      this.setStatus({ queued: this.state.queued - 1 });
    };
    const cancelWaiting = () => {
      if (!waiting) return;
      leaveQueue();
      rejectResult(cancelledError());
    };
    this.setStatus({ queued: this.state.queued + 1 });
    task.signal?.addEventListener("abort", cancelWaiting, { once: true });
    task.onProgress?.(t("progress.queued"));
    this.queue = this.queue
      .catch(() => undefined)
      .then(async () => {
        waiting = false;
        task.signal?.removeEventListener("abort", cancelWaiting);
        leaveQueue();
        if (epoch !== this.epoch || task.signal?.aborted) throw cancelledError();
        this.setStatus({ busy: true });
        try {
          return await work();
        } finally {
          this.setStatus({ busy: false });
        }
      })
      .then(resolveResult, rejectResult);
    return result;
  }

  /** Signed-in state and models, reused for a minute so each message does not repeat both lookups. */
  private async catalog(fresh = false): Promise<Catalog> {
    const cache = this.catalogCache;
    if (!fresh && cache && cache.epoch === this.epoch && Date.now() - cache.at < CATALOG_TTL) {
      return { models: cache.models, cached: true };
    }
    this.catalogCache = undefined;
    const account = await this.readAccount();
    if (!account.account) throw new BridgeError("sign_in_required", t("error.signInFirst"));
    const models = await this.listModels();
    this.catalogCache = { epoch: this.epoch, at: Date.now(), models };
    return { models, cached: false };
  }

  /** The model the task asked for, checked against what the account can use. */
  private async resolveModel(task: CodexTask): Promise<CodexModel> {
    let catalog = await this.catalog();
    // Nothing chosen anywhere: use the first model this account offers.
    const wanted = task.model?.trim() || this.defaultModel().trim() || catalog.models[0]?.model;
    if (!wanted) throw new BridgeError("choose_model", t("error.chooseModel"));
    let selected = findModel(catalog.models, wanted);
    // A cached list can be stale (new model, changed plan): look once more before refusing.
    if (!selected && catalog.cached) {
      catalog = await this.catalog(true);
      selected = findModel(catalog.models, wanted);
    }
    if (!selected) throw new BridgeError("model_unavailable", t("error.modelUnavailable", { model: wanted }));
    if (task.images?.length && !selected.inputModalities.includes("image")) {
      throw new Error(t("error.modelNoImages", { model: wanted }));
    }
    for (const image of task.images ?? []) {
      if (!isSupportedImage(image.url)) throw new Error(t("error.unsupportedImage"));
    }
    return selected;
  }

  /**
   * MCP servers from the user's own Codex configuration. Servers that Codex plugins provide are
   * not listed there, and writing an override for them makes Codex reject the whole config
   * ("invalid transport"); the tool guard in `runTurn` covers those.
   */
  private async configuredMcpServers(): Promise<string[]> {
    if (this.mcpNamesCache && this.mcpNamesCache.epoch === this.epoch) return this.mcpNamesCache.names;
    let names: string[] = [];
    try {
      const result = await this.transport.request<{ config?: { mcp_servers?: Record<string, unknown> } }>(
        "config/read",
        { includeLayers: false },
        CONFIG_READ_TIMEOUT,
      );
      names = Object.keys(result.config?.mcp_servers ?? {});
    } catch {
      /* The tool guard in runTurn still applies. */
    }
    this.mcpNamesCache = { epoch: this.epoch, names };
    return names;
  }

  private async execute(task: CodexTask, thread?: ThreadOptions): Promise<CodexThreadResult> {
    task.onProgress?.(t("progress.connecting"));
    await this.start();
    if (task.signal?.aborted) throw cancelledError();
    task.onProgress?.(t("progress.checking"));
    const model = await this.resolveModel(task);

    const fullAccess = task.access === "full";
    const capabilities = this.getCapabilities();
    if (fullAccess && !capabilities.fullAccess) {
      throw new BridgeError("full_access_off", t("error.fullAccessOff"));
    }
    const apps = fullAccess ? this.policy().apps : [];
    const session = {
      model: model.model,
      cwd: await mkdtemp(join(tmpdir(), "obsidian-codex-task-")),
      approvalPolicy: "never",
      sandbox: "read-only",
      developerInstructions: developerInstructions(fullAccess, task.instructions),
      config: threadConfig({
        fullAccess,
        apps,
        configuredMcpServers: await this.configuredMcpServers(),
        allowedMcpServers: capabilities.mcpServers,
      }),
    };

    const persistent = !!thread;
    let threadId: string | undefined;
    try {
      if (thread?.threadId) {
        task.onProgress?.(t("progress.continuing", { model: model.model }));
        threadId = await this.resumeThread(thread.threadId, session);
      } else {
        task.onProgress?.(
          persistent
            ? t("progress.startingConversation", { model: model.model })
            : t("progress.temporary", { model: model.model }),
        );
        threadId = await this.startThread(session, persistent, thread?.title);
      }
      if (task.signal?.aborted) throw cancelledError();
      task.onProgress?.(t("progress.waiting"));
      const text = await runTurn(this.transport, {
        threadId,
        model: model.model,
        task,
        allow: fullAccess ? { mcp: capabilities.mcpServers, apps: apps.map((app) => app.id) } : undefined,
        stopServer: () => this.stop(),
      });
      return { text, threadId };
    } finally {
      if (threadId) {
        await this.transport.request("thread/unsubscribe", { threadId }, HOUSEKEEPING_TIMEOUT).catch(() => undefined);
      }
      await rm(session.cwd, { recursive: true, force: true });
    }
  }

  private async resumeThread(threadId: string, session: Record<string, unknown>): Promise<string> {
    try {
      const resumed = await this.transport.request<{ thread: { id: string } }>("thread/resume", {
        threadId,
        ...session,
        excludeTurns: true,
      });
      return resumed.thread.id;
    } catch (error) {
      if (isThreadMissingMessage(errorMessage(error))) throw new ThreadMissingError();
      throw error;
    }
  }

  private async startThread(
    session: Record<string, unknown>,
    persistent: boolean,
    title: string | undefined,
  ): Promise<string> {
    const started = await this.transport.request<{ thread: { id: string } }>("thread/start", {
      ...session,
      ephemeral: !persistent,
    });
    const threadId = started.thread.id;
    const name = title?.trim();
    if (persistent && name) {
      await this.transport
        .request("thread/name/set", { threadId, name: name.slice(0, THREAD_NAME_LIMIT) }, HOUSEKEEPING_TIMEOUT)
        .catch(() => undefined);
    }
    return threadId;
  }
}

/** What other plugins receive: task methods only, never server administration. */
export function publicApi(service: BridgeService): CodexBridgeApi {
  return Object.freeze({
    version: 1 as const,
    getStatus: () => service.getStatus(),
    getCapabilities: () => service.getCapabilities(),
    onStatus: (listener: (status: BridgeStatus) => void) => service.onStatus(listener),
    start: () => service.start(),
    stop: () => service.stop(),
    listModels: () => service.listModels(),
    readAccount: () => service.readAccount(),
    login: () => service.login(),
    run: (task: CodexTask) => service.run(task),
    runInThread: (task: CodexThreadTask) => service.runInThread(task),
  });
}
