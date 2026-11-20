import test from "node:test";
import assert from "node:assert/strict";
import { BridgeService, publicApi, type BridgePolicy } from "../../src/codex/BridgeService";
import { FakeTransport, waitFor } from "./fakeTransport";

const ANSWER = '{"text":"recognized"}';
const PNG = { url: "data:image/png;base64,YQ==" };

function bridgeWith(rpc: FakeTransport, policy?: () => BridgePolicy): BridgeService {
  return new BridgeService(() => "codex", () => "vision", rpc, policy);
}

const fullAccess =
  (mcpServers: string[], apps: { id: string; name: string }[] = []): (() => BridgePolicy) =>
  () => ({ fullAccess: true, mcpServers, apps });

test("tasks use separate ephemeral threads and return final JSON with schema, model and images", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  const schema = { type: "object" };
  const answer = await bridge.run({
    prompt: "Read handwriting",
    instructions: "Return JSON",
    images: [PNG],
    outputSchema: schema,
  });
  assert.equal(answer, ANSWER);
  const thread = rpc.first("thread/start");
  assert.equal(thread.ephemeral, true);
  assert.equal(thread.sandbox, "read-only");
  assert.equal(thread.approvalPolicy, "never");
  assert.ok(String(thread.cwd).includes("obsidian-codex-task-"));
  const turn = rpc.first("turn/start");
  assert.deepEqual(turn.outputSchema, schema);
  assert.deepEqual(turn.sandboxPolicy, { type: "readOnly", networkAccess: false });
  assert.ok(rpc.count("thread/unsubscribe") > 0);
  assert.equal(bridge.getStatus().busy, false);
  assert.equal(bridge.getStatus().queued, 0);
});

test("one queue serializes consumers; cancelled waiting tasks never start a turn", async () => {
  const rpc = new FakeTransport();
  rpc.hold = true;
  const bridge = bridgeWith(rpc);
  const first = bridge.run({ prompt: "First" });
  await waitFor(() => !!rpc.release);
  const controller = new AbortController();
  const second = bridge.run({ prompt: "Second", signal: controller.signal });
  const secondCheck = assert.rejects(second, /cancelled/);
  controller.abort();
  const third = bridge.run({ prompt: "Third" });
  assert.equal(bridge.getStatus().queued, 1);
  await secondCheck;
  rpc.hold = false;
  rpc.release!();
  await first;
  await third;
  assert.equal(rpc.count("turn/start"), 2);
  assert.equal(bridge.getStatus().queued, 0);
});

test("active cancellation interrupts the correct turn and failures do not poison the queue", async () => {
  const rpc = new FakeTransport();
  rpc.hold = true;
  const bridge = bridgeWith(rpc);
  const controller = new AbortController();
  const job = bridge.run({ prompt: "First", signal: controller.signal });
  const check = assert.rejects(job, /cancelled/);
  await waitFor(() => !!rpc.release);
  controller.abort();
  await check;
  assert.deepEqual(rpc.first("turn/interrupt"), { threadId: "thread-1", turnId: "turn" });
  rpc.hold = false;
  assert.equal(await bridge.run({ prompt: "Next" }), ANSWER);
});

test("sign-in, model capability, tool attempts and server stop are enforced", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  rpc.account = false;
  await assert.rejects(bridge.run({ prompt: "test" }), /Sign in/);
  rpc.account = true;
  await assert.rejects(bridge.run({ prompt: "test", model: "missing" }), /not available/);
  rpc.models[0].inputModalities = ["text"];
  await assert.rejects(bridge.run({ prompt: "test", images: [PNG] }), /does not support images/);

  rpc.hold = true;
  const job = bridge.run({ prompt: "test" });
  const check = assert.rejects(job);
  await waitFor(() => !!rpc.release);
  rpc.emit("item/started", { threadId: "thread-1", item: { type: "commandExecution" } });
  await check;

  const queued = bridge.run({ prompt: "queue" });
  const stopped = assert.rejects(queued, /cancelled/);
  bridge.stop();
  await stopped;
});

test("live activity follows the task's own server events without exposing reasoning text", async () => {
  const rpc = new FakeTransport();
  rpc.hold = true;
  const bridge = bridgeWith(rpc);
  const events: string[] = [];
  const job = bridge.run({ prompt: "test", onProgress: (message) => events.push(message) });
  await waitFor(() => !!rpc.release);
  rpc.emit("item/started", { threadId: "other-thread", item: { type: "reasoning" } });
  rpc.emit("item/started", { threadId: "thread-1", item: { type: "reasoning" } });
  rpc.emit("item/reasoning/textDelta", { threadId: "thread-1", delta: "private reasoning" });
  rpc.emit("item/agentMessage/delta", { threadId: "thread-1", itemId: "answer", delta: "output" });
  rpc.release!();
  await job;
  assert.ok(events.includes("Codex started processing"));
  assert.equal(events.filter((message) => message === "Codex is processing the supplied material").length, 1);
  assert.ok(events.includes("Receiving Codex response · 6 characters"));
  assert.ok(events.includes("Codex: Working…"));
  assert.ok(events.includes("Codex finished processing"));
  assert.ok(!events.join(" ").includes("private reasoning"));
});

test("account and model lookups are reused for a minute, refreshed on a miss and after sign-in", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  await bridge.run({ prompt: "one" });
  await bridge.run({ prompt: "two" });
  assert.equal(rpc.count("account/read"), 1);
  assert.equal(rpc.count("model/list"), 1);
  rpc.models.push({ id: "new", model: "new", displayName: "New", inputModalities: ["text"] });
  await bridge.run({ prompt: "three", model: "new" });
  assert.equal(rpc.count("model/list"), 2);
  rpc.emit("account/login/completed", { success: true });
  await bridge.run({ prompt: "four" });
  assert.equal(rpc.count("account/read"), 3);
});

test("response text is streamed as the text so far and ends with the final answer", async () => {
  const rpc = new FakeTransport();
  rpc.hold = true;
  const bridge = bridgeWith(rpc);
  const seen: string[] = [];
  const job = bridge.run({ prompt: "test", onText: (text) => seen.push(text) });
  await waitFor(() => !!rpc.release);
  const threadId = "thread-1";
  rpc.emit("item/started", { threadId, item: { type: "agentMessage", id: "note", phase: "commentary" } });
  rpc.emit("item/agentMessage/delta", { threadId, itemId: "note", delta: "thinking aloud" });
  rpc.emit("item/started", { threadId, item: { type: "agentMessage", id: "answer", phase: "final_answer" } });
  rpc.emit("item/agentMessage/delta", { threadId, itemId: "answer", delta: "Hel" });
  rpc.emit("item/agentMessage/delta", { threadId, itemId: "answer", delta: "lo" });
  await waitFor(() => seen.includes("Hello"));
  rpc.release!();
  await job;
  assert.ok(!seen.join("|").includes("thinking"));
  assert.equal(seen[seen.length - 1], ANSWER);
});

test("a thread is kept between messages: started once, then resumed with the saved id", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  const first = await bridge.runInThread({ prompt: "one", title: "Book chat" });
  assert.equal(first.threadId, "thread-1");
  assert.equal(rpc.first("thread/start").ephemeral, false);
  assert.deepEqual(rpc.first("thread/name/set"), { threadId: "thread-1", name: "Book chat" });

  const second = await bridge.runInThread({ prompt: "two", threadId: first.threadId });
  assert.equal(second.threadId, "thread-1");
  assert.equal(rpc.count("thread/start"), 1);
  const resume = rpc.first("thread/resume");
  assert.equal(resume.threadId, "thread-1");
  assert.equal(resume.sandbox, "read-only");
  assert.equal(resume.approvalPolicy, "never");
  assert.ok(String(resume.cwd).includes("obsidian-codex-task-"));
  assert.equal(rpc.count("turn/start"), 2);
});

test("a missing thread is reported with a code so the caller can start a new one; plain run stays ephemeral", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  rpc.missing = true;
  await assert.rejects(
    bridge.runInThread({ prompt: "x", threadId: "gone" }),
    (error: Error & { code?: string }) => error.code === "thread_missing",
  );
  assert.equal(rpc.count("turn/start"), 0);
  await bridge.run({ prompt: "plain" });
  assert.equal(rpc.last("thread/start").ephemeral, true);
});

test("MCP servers stay off in text mode; full access needs the user's setting, adds web search and only allowed MCP servers", async () => {
  const rpc = new FakeTransport();
  const text = bridgeWith(rpc);
  await text.run({ prompt: "plain" });
  const plain = rpc.first("thread/start").config as Record<string, unknown>;
  assert.equal(plain.web_search, "disabled");
  assert.equal(plain["mcp_servers.alpha.enabled"], false);
  assert.equal(plain["mcp_servers.readwise.enabled"], false);
  assert.ok(
    !("mcp_servers.beta.enabled" in plain),
    "plugin servers are not in config.toml; overriding them breaks thread/start",
  );
  assert.equal(plain["features.apps"], false);
  await assert.rejects(text.run({ prompt: "x", access: "full" }), /turned off/);
  assert.equal(text.getCapabilities().fullAccess, false);

  const rpc2 = new FakeTransport();
  rpc2.hold = true;
  const full = bridgeWith(rpc2, fullAccess(["Readwise"]));
  const events: string[] = [];
  const job = full.run({ prompt: "x", access: "full", onProgress: (message) => events.push(message) });
  await waitFor(() => !!rpc2.release);
  const config = rpc2.first("thread/start").config as Record<string, unknown>;
  assert.equal(config.web_search, "live");
  assert.equal(config["features.shell_tool"], false);
  assert.ok(!("mcp_servers.readwise.enabled" in config));
  assert.equal(config["mcp_servers.alpha.enabled"], false);
  rpc2.emit("item/started", { threadId: "thread-1", item: { type: "webSearch", id: "w" } });
  rpc2.emit("item/started", {
    threadId: "thread-1",
    item: { type: "mcpToolCall", id: "m", server: "readwise", tool: "search" },
  });
  rpc2.release!();
  await job;
  assert.ok(events.includes("Codex is searching the web"));
  assert.ok(events.includes("Codex is using readwise · search"));

  const rpc3 = new FakeTransport();
  rpc3.hold = true;
  const strict = bridgeWith(rpc3, fullAccess(["readwise"]));
  const blocked = strict.run({ prompt: "x", access: "full" });
  const check = assert.rejects(blocked, /tool operation/);
  await waitFor(() => !!rpc3.release);
  rpc3.emit("item/started", {
    threadId: "thread-1",
    item: { type: "mcpToolCall", id: "m", server: "alpha", tool: "danger" },
  });
  await check;

  const shell = bridgeWith(new FakeTransport(), fullAccess([]));
  assert.equal(shell.getCapabilities().fullAccess, true);
});

test("Codex apps: off in text mode, only the allowed ones callable in full mode, never destructive", async () => {
  const allowed = [{ id: "asdk_app_rw", name: "Readwise" }];
  const rpc = new FakeTransport();
  rpc.hold = true;
  const bridge = bridgeWith(rpc, fullAccess([], allowed));
  assert.deepEqual(bridge.getCapabilities().apps, ["Readwise"]);
  assert.deepEqual(
    (await bridge.apps()).map((app) => [app.name, app.allowed]),
    [["Readwise", true], ["Mail", false]],
  );
  const events: string[] = [];
  const job = bridge.run({ prompt: "x", access: "full", onProgress: (message) => events.push(message) });
  await waitFor(() => !!rpc.release);
  const config = rpc.first("thread/start").config as Record<string, unknown>;
  assert.equal(config["features.apps"], true);
  assert.equal(config["apps._default.enabled"], false);
  assert.equal(config["apps._default.destructive_enabled"], false);
  assert.equal(config["apps.asdk_app_rw.default_tools_approval_mode"], "approve");
  assert.equal(config["apps.asdk_app_rw.enabled"], true);
  assert.equal(config["apps.asdk_app_rw.destructive_enabled"], false);
  rpc.emit("item/started", {
    threadId: "thread-1",
    item: {
      type: "mcpToolCall",
      id: "a",
      server: "codex_apps",
      tool: "readwise.reader_search_documents",
      appContext: { connectorId: "asdk_app_rw", appName: "Readwise", actionName: "reader_search_documents" },
    },
  });
  rpc.release!();
  await job;
  assert.ok(events.includes("Codex is using Readwise · reader_search_documents"));

  const rpc2 = new FakeTransport();
  rpc2.hold = true;
  const strict = bridgeWith(rpc2, fullAccess([], allowed));
  const blocked = strict.run({ prompt: "x", access: "full" });
  const check = assert.rejects(blocked, /tool operation/);
  await waitFor(() => !!rpc2.release);
  rpc2.emit("item/started", {
    threadId: "thread-1",
    item: {
      type: "mcpToolCall",
      id: "b",
      server: "codex_apps",
      tool: "mail.send",
      appContext: { connectorId: "connector_mail", appName: "Mail" },
    },
  });
  await check;

  const rpc3 = new FakeTransport();
  const plainBridge = bridgeWith(rpc3, () => ({ fullAccess: false, mcpServers: [], apps: allowed }));
  await plainBridge.run({ prompt: "x" });
  assert.equal((rpc3.first("thread/start").config as Record<string, unknown>)["features.apps"], false);
});

test("MCP servers are added, signed in and removed through Codex's own configuration API, with validation", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc, fullAccess(["beta"]));
  const listed = await bridge.mcpServers();
  assert.deepEqual(
    listed.map((server) => [server.name, server.allowed]),
    [["beta", true], ["weird.name", false]],
  );
  await assert.rejects(bridge.addMcpServer("bad name", "https://x.example/mcp"), /letters/);
  await assert.rejects(bridge.addMcpServer("ok", "http://x.example/mcp"), /https/);
  await assert.rejects(bridge.addMcpServer("ok", "https://user:pw@x.example/mcp"), /https/);
  await assert.rejects(bridge.addMcpServer("BETA", "https://x.example/mcp"), /already exists/);
  await bridge.addMcpServer("readwise", "https://mcp2.readwise.io/mcp");
  assert.deepEqual(rpc.first("config/value/write"), {
    keyPath: "mcp_servers.readwise",
    mergeStrategy: "replace",
    value: { url: "https://mcp2.readwise.io/mcp" },
  });
  assert.ok(rpc.count("config/mcpServer/reload") > 0);
  assert.equal((await bridge.loginMcpServer("readwise")).authorizationUrl, "https://auth.example/authorize?x=1");
  await bridge.removeMcpServer("readwise");
  assert.equal(rpc.last("config/value/write").value, null);
  await assert.rejects(bridge.removeMcpServer("a.b"), /Unsupported/);
});

test("the API given to other plugins cannot administer MCP servers", () => {
  const api = publicApi(bridgeWith(new FakeTransport())) as unknown as Record<string, unknown>;
  for (const name of ["addMcpServer", "removeMcpServer", "loginMcpServer", "mcpServers", "apps"]) {
    assert.equal(api[name], undefined);
  }
  assert.equal(typeof api.run, "function");
  assert.equal(typeof api.runInThread, "function");
  assert.equal(api.version, 1);
  assert.throws(() => {
    (api as { run: unknown }).run = 1;
  });
});

test("an empty default model falls back to the first model of the account; callers are counted", async () => {
  const rpc = new FakeTransport();
  const bridge = new BridgeService(() => "codex", () => "", rpc);
  await bridge.run({ prompt: "Hi", caller: "reader" });
  await bridge.run({ prompt: "Again", caller: "reader" });
  await bridge.run({ prompt: "Anon" });
  assert.equal(rpc.first("thread/start").model, "vision");
  assert.deepEqual(bridge.usage(), { reader: 2, unknown: 1 });
});

test("failures carry stable codes, so callers never parse localized messages", async () => {
  const rpc = new FakeTransport();
  const bridge = bridgeWith(rpc);
  await assert.rejects(bridge.run({ prompt: "x", model: "nope" }), { code: "model_unavailable" });
  await assert.rejects(bridge.run({ prompt: "x", access: "full" }), { code: "full_access_off" });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(bridge.run({ prompt: "x", signal: controller.signal }), { code: "cancelled" });
  const signedOut = new FakeTransport();
  signedOut.account = false;
  await assert.rejects(bridgeWith(signedOut).run({ prompt: "x" }), { code: "sign_in_required" });
});
