/**
 * Server administration shown in the settings tab only: which MCP servers and Codex apps exist,
 * and adding, signing in to or removing MCP servers through Codex's own configuration API.
 * None of this is part of the API other plugins receive.
 */
import type { CodexAppEntry, McpServerEntry } from "../api";
import { t } from "../i18n/messages";
import { isMcpServerName, sameName } from "../utils/names";
import { parseMcpServerUrl, type BridgePolicy } from "./taskPolicy";
import type { RpcTransport } from "./transport";

const ADMIN_TIMEOUT = 15_000;
const LOGIN_TIMEOUT = 30_000;

interface McpServerStatus {
  name?: string;
  authStatus?: string;
  runtimeStatus?: string | null;
  httpOrigin?: string | null;
}

interface InstalledApp {
  id?: string;
  runtimeName?: string;
}

export class CodexAdmin {
  constructor(
    private readonly transport: RpcTransport,
    private readonly policy: () => BridgePolicy,
    /** Starts the server when needed. */
    private readonly ensureStarted: () => Promise<void>,
    /** Called after the Codex configuration changed, so cached server names are re-read. */
    private readonly onConfigChanged: () => void,
  ) {}

  /** MCP servers as Codex sees them, with whether full access may use each. */
  async mcpServers(): Promise<McpServerEntry[]> {
    await this.ensureStarted();
    const status = await this.transport.request<{ data?: McpServerStatus[] }>(
      "mcpServerStatus/list",
      {},
      ADMIN_TIMEOUT,
    );
    const allowed = this.policy().mcpServers;
    return (status.data ?? []).flatMap((item) =>
      item.name
        ? [
            {
              name: item.name,
              origin: item.httpOrigin ?? undefined,
              runtime: item.runtimeStatus ?? "unknown",
              auth: item.authStatus ?? "unknown",
              allowed: allowed.some((name) => sameName(name, item.name)),
            },
          ]
        : [],
    );
  }

  /** Codex apps (connectors) installed for this account. */
  async apps(): Promise<CodexAppEntry[]> {
    await this.ensureStarted();
    const result = await this.transport.request<{ apps?: InstalledApp[] }>(
      "app/installed",
      {},
      ADMIN_TIMEOUT,
    );
    const allowed = new Set(this.policy().apps.map((app) => app.id));
    return (result.apps ?? []).flatMap((app) =>
      app.id && app.runtimeName
        ? [{ id: app.id, name: app.runtimeName, allowed: allowed.has(app.id) }]
        : [],
    );
  }

  /** Add an HTTPS MCP server to the user's Codex configuration (the file keeps its comments and other entries). */
  async addMcpServer(name: string, url: string): Promise<void> {
    if (!isMcpServerName(name)) throw new Error(t("error.serverNameInvalid"));
    const parsed = parseMcpServerUrl(url);
    const existing = await this.mcpServers();
    if (existing.some((server) => sameName(server.name, name))) {
      throw new Error(t("error.serverExists", { name }));
    }
    await this.writeServer(name, { url: parsed.href });
  }

  async removeMcpServer(name: string): Promise<void> {
    if (!isMcpServerName(name)) throw new Error(t("error.serverNameUnsupported"));
    await this.writeServer(name, null);
  }

  /** Starts the OAuth flow; the caller opens the returned address in the browser. */
  async loginMcpServer(name: string): Promise<{ authorizationUrl: string }> {
    await this.ensureStarted();
    return this.transport.request("mcpServer/oauth/login", { name }, LOGIN_TIMEOUT);
  }

  private async writeServer(name: string, value: Record<string, unknown> | null): Promise<void> {
    await this.transport.request(
      "config/value/write",
      { keyPath: `mcp_servers.${name}`, mergeStrategy: "replace", value },
      ADMIN_TIMEOUT,
    );
    await this.transport.request("config/mcpServer/reload", {}, ADMIN_TIMEOUT).catch(() => undefined);
    this.onConfigChanged();
  }
}
