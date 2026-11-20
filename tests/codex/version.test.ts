import test from "node:test";
import assert from "node:assert/strict";
import { isOlderThanTested, parseCodexVersion } from "../../src/codex/version";
import { buildDiagnostics } from "../../src/diagnostics";

test("the version is read from the server user agent and compared with the tested one", () => {
  assert.equal(parseCodexVersion("codex_cli_rs/0.162.0-alpha.2 (Mac OS 15)"), "0.162.0-alpha.2");
  assert.equal(parseCodexVersion("test"), undefined);
  assert.equal(parseCodexVersion(undefined), undefined);
  assert.equal(isOlderThanTested("0.161.9"), true);
  assert.equal(isOlderThanTested("0.162.0-alpha.2"), false);
  assert.equal(isOlderThanTested("0.170.1"), false);
  assert.equal(isOlderThanTested("1.0.0"), false);
});

test("diagnostics list versions and task counts and nothing about task content", () => {
  const text = buildDiagnostics({
    pluginVersion: "1.0.0",
    obsidianVersion: "1.8.0",
    platform: "darwin",
    codexVersion: "0.162.0",
    configuredExecutable: "codex",
    resolvedExecutable: "/opt/homebrew/bin/codex",
    state: "error",
    message: "boom",
    fullAccessAllowed: false,
    usage: { a: 1, b: 3 },
  });
  assert.match(text, /Codex CLI: 0\.162\.0/);
  assert.match(text, /State: error \(boom\)/);
  assert.match(text, /Tasks since start: b: 3, a: 1/);
});
