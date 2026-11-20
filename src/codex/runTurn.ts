import { BridgeError, type CodexTask } from "../api";
import { t } from "../i18n/messages";
import { allowedToolProgress, isPassiveItem, type StartedItem, type ToolAllowance } from "./taskPolicy";
import { BRIDGE_STOPPED, type RpcMessage, type RpcTransport } from "./transport";

export const cancelledError = (): Error => new BridgeError("cancelled", t("error.cancelled"));

export interface TurnOptions {
  threadId: string;
  model: string;
  task: CodexTask;
  /** Present only for full access. */
  allow?: ToolAllowance;
  /** Called when the server must not be trusted any further (forbidden tool, hang, failed interrupt). */
  stopServer: () => void;
}

const TURN_TIMEOUT = 10 * 60 * 1000;
const INTERRUPT_TIMEOUT = 5_000;
/** `onText` fires at most this often while deltas stream in. */
const TEXT_THROTTLE = 100;
/** The character counter in `onProgress` is updated at most this often. */
const PROGRESS_THROTTLE = 750;
const COMMENTARY_LIMIT = 2_000;

interface CompletedItem {
  type: string;
  text?: string;
  phase?: string;
}

interface CompletedTurn {
  status: string;
  error?: { message: string };
}

/**
 * Sends one `turn/start` and follows the thread's events until the turn completes.
 * Resolves with the final answer text; rejects on cancellation, failure, timeout or a tool the
 * task was not allowed to use.
 */
export function runTurn(transport: RpcTransport, options: TurnOptions): Promise<string> {
  const { threadId, model, task, allow, stopServer } = options;
  return new Promise((resolve, reject) => {
    let turnId: string | undefined;
    let finalText = "";
    let settled = false;
    let interruptSent = false;
    let receivedCharacters = 0;
    let lastProgressAt = 0;
    let lastEmittedText = "";
    let textTimer: ReturnType<typeof setTimeout> | undefined;
    /** Commentary items are progress for the user, never part of the streamed answer. */
    const commentaryItems = new Set<string>();
    const answers = new Map<string, string>();
    let answerId: string | undefined;

    const emitText = (value?: string) => {
      if (textTimer) {
        clearTimeout(textTimer);
        textTimer = undefined;
      }
      const current = value ?? (answerId ? (answers.get(answerId) ?? "") : "");
      if (current && current !== lastEmittedText) {
        lastEmittedText = current;
        task.onText?.(current);
      }
    };

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutTimer);
      if (textTimer) clearTimeout(textTimer);
      unsubscribe();
      task.signal?.removeEventListener("abort", interrupt);
      if (error) reject(error);
      else resolve(finalText);
    };

    const interrupt = () => {
      if (!turnId || interruptSent || settled) return;
      interruptSent = true;
      void transport
        .request("turn/interrupt", { threadId, turnId }, INTERRUPT_TIMEOUT)
        .catch(() => {
          stopServer();
          finish(cancelledError());
        });
    };

    const onTurnStarted = (params: Record<string, unknown>) => {
      task.onProgress?.(t("progress.started"));
      turnId = (params.turn as { id: string }).id;
      if (task.signal?.aborted) interrupt();
    };

    const onItemStarted = (item: StartedItem) => {
      if (item.type === "agentMessage" && item.phase === "commentary" && item.id) {
        commentaryItems.add(item.id);
      }
      if (item.type === "reasoning") task.onProgress?.(t("progress.reasoning"));
      if (item.type === "agentMessage") {
        task.onProgress?.(t("progress.composing"));
        if (item.phase !== "commentary" && item.id) answerId = item.id;
      }
      const toolProgress = allowedToolProgress(item, allow);
      if (toolProgress) {
        task.onProgress?.(toolProgress);
      } else if (!isPassiveItem(item)) {
        const what = [item.type, item.server, item.tool, item.appContext?.appName].filter(Boolean).join(" · ");
        finish(new BridgeError("tool_blocked", t("error.toolAttempt", { what })));
        stopServer();
      }
    };

    const onItemCompleted = (item: CompletedItem) => {
      if (item.type !== "agentMessage") return;
      if (item.phase === "commentary") {
        if (item.text?.trim()) task.onProgress?.(t("progress.commentary", { text: item.text.slice(0, COMMENTARY_LIMIT) }));
        return;
      }
      finalText = item.text ?? "";
      emitText(finalText);
    };

    const onAnswerDelta = (params: Record<string, unknown>) => {
      const itemId = String(params.itemId);
      if (commentaryItems.has(itemId)) return;
      const delta = typeof params.delta === "string" ? params.delta : "";
      receivedCharacters += delta.length;
      if (task.onText && delta) {
        answerId = itemId;
        answers.set(itemId, (answers.get(itemId) ?? "") + delta);
        if (!textTimer) {
          textTimer = setTimeout(() => {
            textTimer = undefined;
            emitText();
          }, TEXT_THROTTLE);
        }
      }
      if (Date.now() - lastProgressAt >= PROGRESS_THROTTLE) {
        lastProgressAt = Date.now();
        task.onProgress?.(t("progress.receiving", { count: receivedCharacters }));
      }
    };

    const onTurnCompleted = (turn: CompletedTurn) => {
      task.onProgress?.(
        turn.status === "completed"
          ? t("progress.finished")
          : turn.status === "interrupted"
            ? t("progress.cancelled")
            : t("progress.failed"),
      );
      if (task.signal?.aborted || turn.status === "interrupted") finish(cancelledError());
      else if (turn.status !== "completed") finish(new Error(turn.error?.message ?? t("error.taskFailed")));
      else if (!finalText.trim()) finish(new BridgeError("no_text", t("error.noText")));
      else finish();
    };

    const unsubscribe = transport.onMessage((message: RpcMessage) => {
      if (message.method === BRIDGE_STOPPED) {
        finish(new BridgeError("server_stopped", t("error.serverStopped")));
        return;
      }
      const params = message.params;
      if (!params || params.threadId !== threadId) return;
      switch (message.method) {
        case "turn/started":
          onTurnStarted(params);
          break;
        case "item/started":
          onItemStarted(params.item as StartedItem);
          break;
        case "item/completed":
          onItemCompleted(params.item as CompletedItem);
          break;
        case "item/agentMessage/delta":
          onAnswerDelta(params);
          break;
        case "turn/completed":
          onTurnCompleted(params.turn as CompletedTurn);
          break;
      }
    });

    const timeoutTimer = setTimeout(() => {
      finish(new BridgeError("timeout", t("error.timedOut")));
      stopServer();
    }, TURN_TIMEOUT);
    task.signal?.addEventListener("abort", interrupt, { once: true });

    const input = [
      { type: "text", text: task.prompt, text_elements: [] },
      ...(task.images ?? []).map((image) => ({ type: "image", url: image.url })),
    ];
    void transport
      .request<{ turn: { id: string } }>("turn/start", {
        threadId,
        model,
        approvalPolicy: "never",
        sandboxPolicy: { type: "readOnly", networkAccess: false },
        input,
        ...(task.outputSchema ? { outputSchema: task.outputSchema } : {}),
      })
      .then((result) => {
        turnId = result.turn.id;
        if (task.signal?.aborted) interrupt();
      })
      .catch((error: Error) => finish(error));
  });
}
