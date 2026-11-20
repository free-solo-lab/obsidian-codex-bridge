import test from "node:test";
import assert from "node:assert/strict";
import { startTimer, stopTimer, unrefTimer } from "../../src/utils/timers";

test("timers start, stop and tolerate handles without unref (browser timers are numbers)", async () => {
  let fired = 0;
  stopTimer(startTimer(() => fired++, 5));
  startTimer(() => fired++, 5);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(fired, 1);
  assert.doesNotThrow(() => unrefTimer(7 as unknown as ReturnType<typeof setTimeout>));
  assert.doesNotThrow(() => unrefTimer(startTimer(() => undefined, 1)));
});
