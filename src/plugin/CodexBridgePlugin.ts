import { Notice, Plugin } from "obsidian";
import type { CodexBridgeApi } from "../api";
import { BridgeService, publicApi } from "../codex/BridgeService";
import { t } from "../i18n";
import { BridgeSettingsTab } from "../settings/BridgeSettingsTab";
import { DEFAULT_SETTINGS, type BridgeSettings } from "../settings/types";
import { errorMessage } from "../utils/errors";
import { parseNameList } from "../utils/names";

export function showError(error: unknown): void {
  new Notice(errorMessage(error));
}

export default class CodexBridgePlugin extends Plugin {
  /** The narrowed API other plugins receive. */
  api!: CodexBridgeApi;
  // ES private fields: not enumerable from `app.plugins.plugins["free-solo-codex-bridge"]`, so a neighbouring
  // plugin cannot reach settings or server administration by accident. This is not a security
  // boundary (all plugins share one process); see SECURITY.md.
  #settings: BridgeSettings = { ...DEFAULT_SETTINGS };
  #service!: BridgeService;

  async onload(): Promise<void> {
    const saved = (await this.loadData()) as Partial<BridgeSettings> | null;
    this.#settings = { ...DEFAULT_SETTINGS, ...saved };
    this.#service = new BridgeService(
      () => this.#settings.executable,
      () => this.#settings.model,
      undefined,
      () => ({
        fullAccess: this.#settings.allowFullAccess,
        mcpServers: parseNameList(this.#settings.mcpAllowlist),
        apps: this.#settings.allowedApps,
      }),
    );
    this.api = publicApi(this.#service);
    this.addSettingTab(
      new BridgeSettingsTab(this, {
        settings: this.#settings,
        service: this.#service,
        api: this.api,
        save: () => this.saveData(this.#settings),
      }),
    );
    this.addCommand({
      id: "start-server",
      name: t("command.startServer"),
      callback: () => {
        void this.api.start().catch(showError);
      },
    });
    this.addCommand({
      id: "stop-server",
      name: t("command.stopServer"),
      callback: () => this.api.stop(),
    });
    if (this.#settings.autoStart) void this.api.start().catch(showError);
  }

  onunload(): void {
    this.#service?.stop();
  }
}
