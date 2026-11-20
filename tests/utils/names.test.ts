import test from "node:test";
import assert from "node:assert/strict";
import {
  isConfigName,
  isMcpServerName,
  parseNameList,
  sameName,
  toggleNameInList,
} from "../../src/utils/names";

test("config names are restricted to what Codex key paths accept", () => {
  assert.ok(isConfigName("read_wise-2"));
  assert.ok(!isConfigName("weird.name"));
  assert.ok(!isConfigName(""));
  assert.ok(isMcpServerName("a".repeat(40)));
  assert.ok(!isMcpServerName("a".repeat(41)));
});

test("names compare without case", () => {
  assert.ok(sameName("Readwise", "readwise"));
  assert.ok(!sameName("alpha", "beta"));
  assert.ok(!sameName("alpha", undefined));
});

test("the allowlist is parsed on commas and whitespace", () => {
  assert.deepEqual(parseNameList(" readwise, alpha  beta,,"), ["readwise", "alpha", "beta"]);
  assert.deepEqual(parseNameList(""), []);
});

test("toggling a name keeps the other entries and removes case variants", () => {
  assert.equal(toggleNameInList("alpha, Readwise", "readwise", false), "alpha");
  assert.equal(toggleNameInList("alpha", "readwise", true), "alpha, readwise");
  assert.equal(toggleNameInList("alpha, readwise", "readwise", true), "alpha, readwise");
  assert.equal(toggleNameInList("", "readwise", false), "");
});
