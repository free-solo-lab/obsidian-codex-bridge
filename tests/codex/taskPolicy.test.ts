import test from "node:test";
import assert from "node:assert/strict";
import {
  allowedToolProgress,
  appsConfig,
  developerInstructions,
  findModel,
  isPassiveItem,
  isSupportedImage,
  isThreadMissingMessage,
  mcpOverrides,
  parseMcpServerUrl,
  threadConfig,
} from "../../src/codex/taskPolicy";

test("developer instructions put the bridge's rules before the caller's", () => {
  const text = developerInstructions(false, "Return JSON");
  assert.ok(text.startsWith("You process only the supplied text and images."));
  assert.ok(text.endsWith("\nReturn JSON"));
  assert.ok(developerInstructions(true).startsWith("You may search the web"));
  assert.ok(!developerInstructions(true).includes("undefined"));
});

test("apps config switches everything off unless some apps are allowed, and never destructive tools", () => {
  assert.deepEqual(appsConfig([]), { "features.apps": false });
  const config = appsConfig([
    { id: "asdk_app_rw", name: "Readwise" },
    { id: "bad id", name: "Ignored" },
  ]);
  assert.deepEqual(config, {
    "features.apps": true,
    "apps._default.enabled": false,
    "apps._default.destructive_enabled": false,
    "apps.asdk_app_rw.enabled": true,
    "apps.asdk_app_rw.destructive_enabled": false,
    "apps.asdk_app_rw.default_tools_approval_mode": "approve",
  });
});

test("MCP overrides disable configured servers except allowed ones, matching names without case", () => {
  assert.deepEqual(mcpOverrides(["alpha", "Readwise", "weird.name"], ["readwise"]), {
    "mcp_servers.alpha.enabled": false,
  });
  assert.deepEqual(mcpOverrides([], ["anything"]), {});
});

test("thread config ignores the MCP allowlist in text mode", () => {
  const text = threadConfig({
    fullAccess: false,
    apps: [],
    configuredMcpServers: ["alpha"],
    allowedMcpServers: ["alpha"],
  });
  assert.equal(text.web_search, "disabled");
  assert.equal(text["mcp_servers.alpha.enabled"], false);
  const full = threadConfig({
    fullAccess: true,
    apps: [],
    configuredMcpServers: ["alpha"],
    allowedMcpServers: ["alpha"],
  });
  assert.equal(full.web_search, "live");
  assert.equal(full["features.shell_tool"], false);
  assert.ok(!("mcp_servers.alpha.enabled" in full));
});

test("models are found by model name or id", () => {
  const models = [{ id: "m-1", model: "vision", displayName: "Vision", inputModalities: ["text"] }];
  assert.equal(findModel(models, "vision"), models[0]);
  assert.equal(findModel(models, "m-1"), models[0]);
  assert.equal(findModel(models, "other"), undefined);
});

test("only inline PNG, JPEG and WebP data within the size limit is accepted", () => {
  assert.ok(isSupportedImage("data:image/png;base64,YQ=="));
  assert.ok(isSupportedImage("data:image/webp;base64,YQ=="));
  assert.ok(!isSupportedImage("data:image/gif;base64,YQ=="));
  assert.ok(!isSupportedImage("https://example.com/a.png"));
  assert.ok(!isSupportedImage("data:image/png;base64," + "A".repeat(29 * 1024 * 1024)));
});

test("thread/resume failures that mean a deleted thread are recognised", () => {
  assert.ok(isThreadMissingMessage("no rollout found for thread id x"));
  assert.ok(isThreadMissingMessage("Thread does not exist"));
  assert.ok(!isThreadMissingMessage("connection reset"));
});

test("the tool guard allows web search, allowed MCP servers and allowed apps only", () => {
  const allow = { mcp: ["Readwise"], apps: ["asdk_app_rw"] };
  assert.equal(allowedToolProgress({ type: "webSearch" }, allow), "Codex is searching the web");
  assert.equal(allowedToolProgress({ type: "webSearch" }), undefined);
  assert.equal(
    allowedToolProgress({ type: "mcpToolCall", server: "readwise", tool: "search" }, allow),
    "Codex is using readwise · search",
  );
  assert.equal(allowedToolProgress({ type: "mcpToolCall", server: "alpha", tool: "x" }, allow), undefined);
  assert.equal(allowedToolProgress({ type: "mcpToolCall" }, allow), undefined);
  assert.equal(
    allowedToolProgress(
      {
        type: "mcpToolCall",
        server: "codex_apps",
        tool: "readwise.search",
        appContext: { connectorId: "asdk_app_rw", appName: "Readwise", actionName: "search" },
      },
      allow,
    ),
    "Codex is using Readwise · search",
  );
  assert.equal(
    allowedToolProgress(
      { type: "mcpToolCall", server: "codex_apps", appContext: { connectorId: "connector_mail" } },
      allow,
    ),
    undefined,
  );
  assert.ok(isPassiveItem({ type: "reasoning" }));
  assert.ok(isPassiveItem({ type: "plan" }));
  assert.ok(isPassiveItem({ type: "contextCompaction" }));
  assert.ok(isPassiveItem({ type: "sleep" }));
  assert.ok(!isPassiveItem({ type: "commandExecution" }));
});

test("MCP server addresses must be https without credentials", () => {
  assert.equal(parseMcpServerUrl("https://mcp2.readwise.io/mcp").href, "https://mcp2.readwise.io/mcp");
  assert.throws(() => parseMcpServerUrl("not a url"), /valid server URL/);
  assert.throws(() => parseMcpServerUrl("http://x.example/mcp"), /https/);
  assert.throws(() => parseMcpServerUrl("https://user:pw@x.example/mcp"), /credentials/);
});
