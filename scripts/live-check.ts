/**
 * Manual contract check against a real Codex CLI: `npm run test:live`.
 * Starts the server, reads version/account/models and runs one tiny synthetic task. It uses the
 * Codex sign-in on this machine and sends only the text below.
 */
import { BridgeService } from "../src/codex/BridgeService";

const executable = process.env.CODEX_BIN ?? "codex";
const bridge = new BridgeService(() => executable, () => "");
bridge.onStatus((status) => console.log("status:", status.state, status.codexVersion ?? "", status.message ?? ""));

try {
  await bridge.start();
  const account = await bridge.readAccount();
  console.log("account:", account.account ? `${account.account.type} ${account.account.planType ?? ""}` : "not signed in");
  const models = await bridge.listModels();
  console.log("models:", models.map((model) => model.model).join(", ") || "none");
  if (account.account && models.length) {
    const answer = await bridge.run({ prompt: "Reply with the single word OK.", caller: "live-check" });
    console.log("answer:", answer.trim());
    if (!/ok/i.test(answer)) throw new Error("Unexpected answer.");
  }
  console.log("live check passed");
} finally {
  bridge.stop();
}
