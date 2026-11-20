/**
 * Timers of the window Obsidian is running in (popout windows have their own timers); Node's
 * timers when there is no window, as in the unit tests.
 */
export type TimerHandle = ReturnType<typeof setTimeout>;

const host = (): Pick<typeof globalThis, "setTimeout" | "clearTimeout"> =>
  typeof window === "undefined" ? globalThis : window;

export function startTimer(callback: () => void, delay: number): TimerHandle {
  return host().setTimeout(callback, delay) as unknown as TimerHandle;
}

export function stopTimer(handle: TimerHandle | undefined): void {
  if (handle !== undefined) host().clearTimeout(handle);
}

/** Lets Node exit while the timer is pending; browser timers are plain numbers and need no such call. */
export function unrefTimer(handle: TimerHandle): void {
  (handle as { unref?: () => void }).unref?.();
}
