import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough, Writable } from "node:stream";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { RpcClient } from "../../src/codex/RpcClient";

type FakeProcess = EventEmitter & {
  stdout: PassThrough;
  stderr: PassThrough;
  stdin: Writable;
  kill(): boolean;
  exitCode: number;
  signalCode: null;
};

/** A child process whose stdin answers the handshake and records everything written to it. */
function fakeProcess(writes: Record<string, unknown>[]): FakeProcess {
  const fake = new EventEmitter() as FakeProcess;
  fake.stdout = new PassThrough();
  fake.stderr = new PassThrough();
  fake.exitCode = 0;
  fake.signalCode = null;
  fake.kill = () => true;
  fake.stdin = new Writable({
    write(chunk, _encoding, callback) {
      const message = JSON.parse(String(chunk));
      writes.push(message);
      if (message.method === "initialize") {
        fake.stdout.write(JSON.stringify({ id: message.id, result: { userAgent: "codex_cli_rs/0.162.0 (test)" } }) + "\n");
      }
      callback();
    },
  });
  return fake;
}

test("stdio handshake is shared, server requests are refused and stop rejects pending work", async () => {
  let spawns = 0;
  const writes: Record<string, unknown>[] = [];
  const fake = fakeProcess(writes);
  const client = new RpcClient(
    () => "test-codex",
    (_executable, args) => {
      spawns++;
      assert.ok(args.includes("stdio://"));
      return fake as unknown as ChildProcessWithoutNullStreams;
    },
  );

  await Promise.all([client.start(), client.start()]);
  assert.equal(client.serverVersion(), "0.162.0");
  assert.equal(spawns, 1);
  assert.equal(writes.filter((value) => value.method === "initialized").length, 1);

  fake.stdout.write(
    JSON.stringify({ id: "approval", method: "item/commandExecution/requestApproval", params: {} }) + "\n",
  );
  assert.ok(writes.some((value) => value.id === "approval" && value.error));

  const pending = client.request("model/list");
  const check = assert.rejects(pending, /stopped/);
  client.stop();
  await check;
});
