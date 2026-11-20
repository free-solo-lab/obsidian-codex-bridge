import test from "node:test";
import assert from "node:assert/strict";
import { locateCodex } from "../../src/codex/locateCodex";

test("an explicit executable path is used as given", () => {
  assert.equal(locateCodex("  /opt/tools/codex  "), "/opt/tools/codex");
});

test("the bare name resolves to a known location or stays on PATH", () => {
  const found = locateCodex("codex");
  assert.ok(found === "codex" || found.endsWith("/codex"));
  assert.equal(locateCodex(""), found);
});
