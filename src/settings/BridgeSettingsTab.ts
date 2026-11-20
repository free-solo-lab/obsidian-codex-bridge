import { apiVersion, Notice, PluginSettingTab, Setting } from "obsidian";
import type { CodexAppEntry, CodexBridgeApi, CodexModel, McpServerEntry } from "../api";
import type { BridgeService } from "../codex/BridgeService";
import { locateCodex } from "../codex/locateCodex";
import { buildDiagnostics } from "../diagnostics";
import { t } from "../i18n";
import type CodexBridgePlugin from "../plugin/CodexBridgePlugin";
import { showError } from "../plugin/CodexBridgePlugin";
import { errorMessage } from "../utils/errors";
import { toggleNameInList } from "../utils/names";
import { DEFAULT_EXECUTABLE, type BridgeSettings } from "./types";

/** Only these hosts may be opened for the ChatGPT sign-in the server hands back. */
const SIGN_IN_HOSTS = ["auth.openai.com", "chatgpt.com", "auth0.openai.com"];
const READWISE_MCP = { name: "readwise", url: "https://mcp2.readwise.io/mcp" };

/** What the settings tab may touch; handed over by the plugin so those objects stay private to it. */
export interface SettingsHost {
  settings: BridgeSettings;
  service: BridgeService;
  api: CodexBridgeApi;
  save(): Promise<void>;
}

export class BridgeSettingsTab extends PluginSettingTab {
  private models: CodexModel[] = [];
  private mcp: McpServerEntry[] | undefined;
  private mcpError = "";
  private apps: CodexAppEntry[] | undefined;
  private appsError = "";
  private account = "";
  private unsubscribe: (() => void) | undefined;

  constructor(
    private readonly plugin: CodexBridgePlugin,
    private readonly host: SettingsHost,
  ) {
    super(plugin.app, plugin);
  }

  display(): void {
    this.unsubscribe?.();
    this.render();
    this.unsubscribe = this.host.api.onStatus(() => {
      this.updateStatus();
    });
  }

  hide(): void {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }

  private get settings() {
    return this.host.settings;
  }

  private async save(): Promise<void> {
    await this.host.save();
  }

  private updateStatus(): void {
    const status = this.host.api.getStatus();
    const el = this.containerEl.querySelector(".codex-bridge-status");
    if (!el) return;
    const parts = [t(`status.state.${status.state}`)];
    if (status.busy) parts.push(t("status.processing"));
    parts.push(t("status.queue", { count: status.queued }));
    if (status.message) parts.push(status.message);
    el.textContent = parts.join(" · ");
    const hint = this.containerEl.querySelector(".codex-bridge-hint");
    if (hint) hint.textContent = status.state === "error" && status.message === t("error.startFailed") ? t("settings.codexMissing") : "";
  }

  /** Start the server, then re-read account, models, MCP servers and apps. */
  private async refresh(): Promise<void> {
    try {
      const result = await this.host.api.readAccount();
      if (result.account) {
        const plan = result.account.planType ? ` · ${result.account.planType}` : "";
        this.account = `${result.account.type}${plan}`;
        this.models = await this.host.api.listModels();
      } else {
        this.account = t("settings.accountSignInToRun");
        this.models = [];
      }
      await this.loadMcp();
      await this.loadApps();
      this.render();
    } catch (error) {
      showError(error);
    }
  }

  private async loadMcp(): Promise<void> {
    try {
      this.mcp = await this.host.service.mcpServers();
      this.mcpError = "";
    } catch (error) {
      this.mcp = undefined;
      this.mcpError = errorMessage(error);
    }
  }

  private async loadApps(): Promise<void> {
    try {
      this.apps = await this.host.service.apps();
      this.appsError = "";
    } catch (error) {
      this.apps = undefined;
      this.appsError = errorMessage(error);
    }
  }

  /** Opens a sign-in address the server returned, after checking it is one we expect. */
  private openSignIn(href: string, hosts: string[] | undefined, failure: string, next: string): void {
    const url = new URL(href);
    if (url.protocol !== "https:" || (hosts && !hosts.includes(url.hostname))) {
      throw new Error(failure);
    }
    window.open(url.href);
    new Notice(next);
  }

  private render(): void {
    const el = this.containerEl;
    el.empty();
    el.addClass("codex-bridge-settings");
    el.createEl("h3", { text: t("settings.title") });
    el.createEl("p", { text: t("settings.intro") });
    el.createDiv({ cls: "codex-bridge-status" });
    el.createDiv({ cls: "codex-bridge-hint" });
    this.updateStatus();
    this.renderServer(el);
    this.renderAccess(el);
    this.renderMcp(el);
    this.renderApps(el);
    this.renderModels(el);
    this.renderDiagnostics(el);
  }

  private renderDiagnostics(el: HTMLElement): void {
    new Setting(el)
      .setName(t("settings.diagnosticsName"))
      .setDesc(t("settings.diagnosticsDesc"))
      .addButton((button) =>
        button.setButtonText(t("settings.copyDiagnostics")).onClick(() => {
          const status = this.host.api.getStatus();
          const text = buildDiagnostics({
            pluginVersion: this.plugin.manifest.version,
            obsidianVersion: apiVersion,
            platform: process.platform,
            codexVersion: status.codexVersion,
            configuredExecutable: this.settings.executable,
            resolvedExecutable: locateCodex(this.settings.executable),
            state: status.state,
            message: status.message,
            fullAccessAllowed: this.settings.allowFullAccess,
            usage: this.host.service.usage(),
          });
          void navigator.clipboard.writeText(text).then(() => new Notice(t("notice.diagnosticsCopied")));
        }),
      );
  }

  private renderServer(el: HTMLElement): void {
    new Setting(el)
      .setName(t("settings.server"))
      .addButton((button) =>
        button.setButtonText(t("settings.start")).onClick(() => {
          void this.refresh();
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("settings.stop")).onClick(() => this.host.api.stop()),
      )
      .addButton((button) =>
        button.setButtonText(t("settings.restart")).onClick(() => {
          this.host.api.stop();
          void this.refresh();
        }),
      );
    new Setting(el)
      .setName(t("settings.executableName"))
      .setDesc(t("settings.executableDesc"))
      .addText((text) =>
        text.setValue(this.settings.executable).onChange(async (value) => {
          this.settings.executable = value.trim() || DEFAULT_EXECUTABLE;
          await this.save();
        }),
      );
    new Setting(el).setName(t("settings.autoStart")).addToggle((toggle) =>
      toggle.setValue(this.settings.autoStart).onChange(async (value) => {
        this.settings.autoStart = value;
        await this.save();
      }),
    );
    new Setting(el)
      .setName(t("settings.account"))
      .setDesc(this.account || t("settings.accountNotChecked"))
      .addButton((button) =>
        button.setButtonText(t("settings.signInWithChatGpt")).onClick(() => {
          void this.host.api
            .login()
            .then((result) =>
              this.openSignIn(
                result.authUrl,
                SIGN_IN_HOSTS,
                t("notice.signInUrlUnexpected"),
                t("notice.completeSignInThenCheck"),
              ),
            )
            .catch(showError);
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("settings.checkAccount")).onClick(() => {
          void this.refresh();
        }),
      );
  }

  private renderAccess(el: HTMLElement): void {
    new Setting(el)
      .setName(t("settings.fullAccessName"))
      .setDesc(t("settings.fullAccessDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.settings.allowFullAccess).onChange(async (value) => {
          this.settings.allowFullAccess = value;
          await this.save();
        }),
      );
    new Setting(el)
      .setName(t("settings.mcpAllowlistName"))
      .setDesc(t("settings.mcpAllowlistDesc"))
      .addText((text) =>
        text
          .setValue(this.settings.mcpAllowlist)
          .setPlaceholder(READWISE_MCP.name)
          .onChange(async (value) => {
            this.settings.mcpAllowlist = value.trim();
            await this.save();
          }),
      );
  }

  private setMcpAllowed(name: string, allowed: boolean): void {
    this.settings.mcpAllowlist = toggleNameInList(this.settings.mcpAllowlist, name, allowed);
  }

  private renderMcp(el: HTMLElement): void {
    el.createEl("h4", { text: t("settings.mcpTitle") });
    el.createEl("p", { text: t("settings.mcpIntro") });
    const summary = this.mcp
      ? this.mcp.length
        ? ""
        : t("settings.mcpNone")
      : this.mcpError || t("settings.notLoaded");
    new Setting(el)
      .setName(t("settings.mcpServers"))
      .setDesc(summary)
      .addButton((button) =>
        button.setButtonText(t("settings.refresh")).onClick(() => {
          void this.loadMcp().then(() => this.render());
        }),
      );
    for (const server of this.mcp ?? []) this.renderMcpServer(el, server);
    this.renderAddMcp(el);
  }

  private renderMcpServer(el: HTMLElement, server: McpServerEntry): void {
    const signedIn = server.auth === "oAuth" || server.auth === "bearerToken";
    const noSignIn = server.auth === "unsupported";
    const authText = signedIn
      ? t("settings.signedIn")
      : noSignIn
        ? t("settings.noSignInNeeded")
        : t("settings.notSignedIn");
    const setting = new Setting(el)
      .setName(server.name)
      .setDesc(`${server.origin ?? t("settings.localCommand")} · ${authText}`);
    setting.addToggle((toggle) =>
      toggle
        .setTooltip(t("settings.usableWithFullAccess"))
        .setValue(server.allowed)
        .onChange(async (value) => {
          this.setMcpAllowed(server.name, value);
          await this.save();
          this.render();
        }),
    );
    if (!signedIn && !noSignIn && server.origin) {
      setting.addButton((button) =>
        button.setButtonText(t("settings.signIn")).onClick(() => {
          void this.host.service
            .loginMcpServer(server.name)
            .then((result) =>
              this.openSignIn(
                result.authorizationUrl,
                undefined,
                t("notice.signInAddressUnexpected"),
                t("notice.completeSignInThenRefresh"),
              ),
            )
            .catch(showError);
        }),
      );
    }
    if (this.settings.managedMcp.includes(server.name)) {
      setting.addButton((button) =>
        button.setButtonText(t("settings.remove")).onClick(() => {
          void this.removeMcp(server.name).catch(showError);
        }),
      );
    }
  }

  private async removeMcp(name: string): Promise<void> {
    await this.host.service.removeMcpServer(name);
    this.settings.managedMcp = this.settings.managedMcp.filter((item) => item !== name);
    this.setMcpAllowed(name, false);
    await this.save();
    await this.loadMcp();
    this.render();
  }

  private async addMcp(name: string, url: string): Promise<void> {
    await this.host.service.addMcpServer(name, url);
    this.settings.managedMcp = [...new Set([...this.settings.managedMcp, name])];
    this.setMcpAllowed(name, true);
    await this.save();
    await this.loadMcp();
    this.render();
    new Notice(t("notice.serverAdded", { name }));
  }

  private renderAddMcp(el: HTMLElement): void {
    let name = "";
    let url = "";
    new Setting(el)
      .setName(t("settings.addServerName"))
      .setDesc(t("settings.addServerDesc"))
      .addText((text) =>
        text.setPlaceholder(t("settings.serverNamePlaceholder")).onChange((value) => {
          name = value.trim();
        }),
      )
      .addText((text) =>
        text.setPlaceholder(t("settings.serverUrlPlaceholder")).onChange((value) => {
          url = value.trim();
        }),
      )
      .addButton((button) =>
        button.setButtonText(t("settings.add")).onClick(() => {
          void this.addMcp(name, url).catch(showError);
        }),
      );
    new Setting(el)
      .setName(t("settings.readwiseName"))
      .setDesc(t("settings.readwiseDesc"))
      .addButton((button) =>
        button.setButtonText(t("settings.addReadwise")).onClick(() => {
          void this.addMcp(READWISE_MCP.name, READWISE_MCP.url).catch(showError);
        }),
      );
  }

  private renderApps(el: HTMLElement): void {
    el.createEl("h4", { text: t("settings.appsTitle") });
    el.createEl("p", { text: t("settings.appsIntro") });
    const summary = this.apps
      ? this.apps.length
        ? ""
        : t("settings.appsNone")
      : this.appsError || t("settings.notLoaded");
    new Setting(el)
      .setName(t("settings.apps"))
      .setDesc(summary)
      .addButton((button) =>
        button.setButtonText(t("settings.refresh")).onClick(() => {
          void this.loadApps().then(() => this.render());
        }),
      );
    for (const app of this.apps ?? []) {
      new Setting(el).setName(app.name).addToggle((toggle) =>
        toggle
          .setTooltip(t("settings.usableWithFullAccess"))
          .setValue(app.allowed)
          .onChange(async (value) => {
            const rest = this.settings.allowedApps.filter((item) => item.id !== app.id);
            this.settings.allowedApps = value ? [...rest, { id: app.id, name: app.name }] : rest;
            await this.save();
            await this.loadApps();
            this.render();
          }),
      );
    }
  }

  private renderModels(el: HTMLElement): void {
    new Setting(el)
      .setName(t("settings.defaultModelName"))
      .setDesc(t("settings.defaultModelDesc"))
      .addText((text) =>
        text
          .setValue(this.settings.model)
          .setPlaceholder(t("settings.modelAutoPlaceholder"))
          .onChange(async (value) => {
            this.settings.model = value.trim();
            await this.save();
          }),
      );
    if (!this.models.length) return;
    new Setting(el).setName(t("settings.availableModels")).addDropdown((dropdown) => {
      dropdown.addOption("", t("settings.selectModel"));
      for (const model of this.models) {
        const images = model.inputModalities.includes("image") ? t("settings.imagesSuffix") : "";
        dropdown.addOption(model.model, `${model.displayName}${images}`);
      }
      dropdown.setValue(this.settings.model).onChange(async (value) => {
        if (!value) return;
        this.settings.model = value;
        await this.save();
        this.render();
      });
    });
  }
}
