/** The oldest Codex CLI release this bridge was verified against. */
export const TESTED_CODEX_VERSION = "0.162.0";

/** Pulls `0.162.0` (or `0.162.0-alpha.2`) out of the server's `userAgent` string. */
export function parseCodexVersion(userAgent: unknown): string | undefined {
  if (typeof userAgent !== "string") return undefined;
  return /(\d+\.\d+\.\d+(?:[-+][\w.]+)?)/.exec(userAgent)?.[1];
}

function numbers(version: string): number[] {
  return version
    .split(/[-+]/)[0]
    .split(".")
    .map((part) => Number(part));
}

/** Compares the numeric part only; a pre-release of the tested version counts as tested. */
export function isOlderThanTested(version: string): boolean {
  const have = numbers(version);
  const want = numbers(TESTED_CODEX_VERSION);
  for (let index = 0; index < want.length; index++) {
    if ((have[index] ?? 0) !== want[index]) return (have[index] ?? 0) < want[index];
  }
  return false;
}
