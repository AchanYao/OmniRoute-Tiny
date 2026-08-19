import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import http, { type ServerResponse } from "node:http";
import path from "node:path";

import { getLookupEnv } from "@/shared/services/cliRuntime";
import {
  getQoderCliConfigDir,
  getQoderCliWorkspace,
  parseQoderCliResult,
  resolveQoderCliModel,
} from "./qoderCli.ts";
import { resolveQoderCliInvocation } from "./qoderCliResolve.ts";

type JsonRecord = Record<string, unknown>;

export type QoderOpenAIToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type QoderToolDefinition = {
  name: string;
  description?: string;
  inputSchema: JsonRecord;
};

export type QoderToolRequest = {
  prompt: string;
  systemPrompt: string;
  tools: QoderToolDefinition[];
  conversationId?: string;
  toolResults: Array<{ id: string; content: string }>;
  unsupportedToolChoice?: string;
};

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function contentText(value: unknown): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value
    .map((part) => {
      const record = asRecord(part);
      return record.type === "text" && typeof record.text === "string" ? record.text : "";
    })
    .filter(Boolean)
    .join("\n");
}

function formatTranscriptMessage(value: unknown): string {
  const message = asRecord(value);
  const role = typeof message.role === "string" ? message.role : "user";
  if (role === "system" || role === "developer" || role === "tool") return "";
  const text = contentText(message.content);
  const calls = Array.isArray(message.tool_calls)
    ? message.tool_calls
        .map((call) => {
          const fn = asRecord(asRecord(call).function);
          const name = typeof fn.name === "string" ? fn.name : "";
          const args =
            typeof fn.arguments === "string" ? fn.arguments : JSON.stringify(fn.arguments ?? {});
          return name ? `TOOL_CALL ${name}: ${args}` : "";
        })
        .filter(Boolean)
        .join("\n")
    : "";
  const body = [text, calls].filter(Boolean).join("\n");
  return body ? `${role.toUpperCase()}:\n${body}` : "";
}

/** Split protocol-privileged instructions from the user transcript and validate OpenAI tools. */
export function parseQoderToolRequest(body: unknown): QoderToolRequest {
  const request = asRecord(body);
  const messages = Array.isArray(request.messages) ? request.messages : [];
  const privileged = messages
    .map(asRecord)
    .filter((message) => message.role === "system" || message.role === "developer")
    .map((message) => contentText(message.content))
    .filter(Boolean);
  const transcript = messages.map(formatTranscriptMessage).filter(Boolean);
  const tools = (
    request.tool_choice === "none" ? [] : Array.isArray(request.tools) ? request.tools : []
  )
    .map((value): QoderToolDefinition | null => {
      const tool = asRecord(value);
      if (tool.type !== "function") return null;
      const fn = asRecord(tool.function);
      const name = typeof fn.name === "string" ? fn.name.trim() : "";
      if (!name) return null;
      return {
        name,
        ...(typeof fn.description === "string" ? { description: fn.description } : {}),
        inputSchema: asRecord(fn.parameters),
      };
    })
    .filter((tool): tool is QoderToolDefinition => tool !== null);
  const toolResults = messages
    .map(asRecord)
    .filter((message) => message.role === "tool" && typeof message.tool_call_id === "string")
    .map((message) => ({
      id: String(message.tool_call_id),
      content: contentText(message.content),
    }));

  return {
    prompt: transcript.length ? `Conversation transcript:\n\n${transcript.join("\n\n")}` : "",
    systemPrompt: privileged.join("\n\n"),
    tools,
    conversationId:
      typeof request.conversation_id === "string" && request.conversation_id
        ? request.conversation_id
        : undefined,
    toolResults,
    unsupportedToolChoice:
      request.tool_choice === "required" ||
      (request.tool_choice && typeof request.tool_choice === "object")
        ? "Qoder PAT tool mode supports tool_choice=auto or none only"
        : undefined,
  };
}

export function buildQoderToolCompletionPayload({
  model,
  toolCalls,
}: {
  model: string;
  toolCalls: QoderOpenAIToolCall[];
}) {
  return {
    id: `chatcmpl-${randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: null, tool_calls: toolCalls },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

export function buildQoderToolSseStream(
  model: string,
  toolCalls: QoderOpenAIToolCall[]
): ReadableStream<Uint8Array> {
  const id = `chatcmpl-${randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const event = (value: unknown) => encoder.encode(`data: ${JSON.stringify(value)}\n\n`);
  return new ReadableStream({
    start(controller) {
      controller.enqueue(
        event({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { role: "assistant", content: null }, finish_reason: null }],
        })
      );
      toolCalls.forEach((call, index) => {
        controller.enqueue(
          event({
            id,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [
              {
                index: 0,
                delta: { tool_calls: [{ index, ...call }] },
                finish_reason: null,
              },
            ],
          })
        );
      });
      controller.enqueue(
        event({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
        })
      );
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });
}

type SessionRuntime = {
  close(): void;
  resolveToolResult(id: string, content: string, isError?: boolean): boolean;
};

export type QoderToolSession = {
  conversationId: string;
  runtime: SessionRuntime;
  pendingToolCallIds: Set<string>;
  state: "running" | "awaiting_tool_result" | "closed";
  lastActivityTs: number;
  idleTimer?: ReturnType<typeof setTimeout>;
};

export class QoderToolSessionManager {
  private sessions = new Map<string, QoderToolSession>();
  private idleTtlMs: number;

  constructor(options: { idleTtlMs?: number } = {}) {
    this.idleTtlMs = options.idleTtlMs ?? 5 * 60 * 1000;
  }

  open(conversationId: string, runtime: SessionRuntime): QoderToolSession {
    const old = this.sessions.get(conversationId);
    if (old) this.close(old);
    const session: QoderToolSession = {
      conversationId,
      runtime,
      pendingToolCallIds: new Set(),
      state: "running",
      lastActivityTs: Date.now(),
    };
    this.sessions.set(conversationId, session);
    return session;
  }

  release(session: QoderToolSession, state: "awaiting_tool_result" | "closed"): void {
    if (state === "closed") return this.close(session);
    session.state = state;
    session.lastActivityTs = Date.now();
    session.idleTimer = setTimeout(() => this.close(session), this.idleTtlMs);
    session.idleTimer.unref?.();
  }

  findByToolCallIds(ids: string[]): QoderToolSession | undefined {
    for (const id of ids) {
      for (const session of this.sessions.values()) {
        if (session.state === "awaiting_tool_result" && session.pendingToolCallIds.has(id)) {
          if (session.idleTimer) clearTimeout(session.idleTimer);
          session.idleTimer = undefined;
          session.state = "running";
          session.lastActivityTs = Date.now();
          return session;
        }
      }
    }
    return undefined;
  }

  sendToolResult(session: QoderToolSession, id: string, content: string, isError = false): boolean {
    if (!session.pendingToolCallIds.has(id)) return false;
    const sent = session.runtime.resolveToolResult(id, content, isError);
    if (sent) session.pendingToolCallIds.delete(id);
    return sent;
  }

  close(session: QoderToolSession): void {
    if (session.state === "closed") return;
    session.state = "closed";
    if (session.idleTimer) clearTimeout(session.idleTimer);
    session.runtime.close();
    this.sessions.delete(session.conversationId);
  }
}

export const qoderToolSessionManager = new QoderToolSessionManager();

type ToolOutcome =
  | { type: "tool_calls"; toolCalls: QoderOpenAIToolCall[] }
  | { type: "result"; stdout: string; stderr: string; code: number | null; error?: string };

type PendingHttpCall = { response: ServerResponse; requestId: unknown };

class QoderMcpRuntime implements SessionRuntime {
  readonly pendingToolCallIds = new Set<string>();
  private pendingResponses = new Map<string, PendingHttpCall>();
  private queuedCalls: QoderOpenAIToolCall[] = [];
  private outcomeResolve?: (outcome: ToolOutcome) => void;
  private outcomePromise?: Promise<ToolOutcome>;
  private readyOutcome?: ToolOutcome;
  private child?: ChildProcessWithoutNullStreams;
  private server?: http.Server;
  private configPath = "";
  private stdout = "";
  private stderr = "";
  private closed = false;
  private abortSignal?: AbortSignal | null;
  private abortListener?: () => void;
  private turnTimer?: ReturnType<typeof setTimeout>;

  constructor(private tools: QoderToolDefinition[]) {}

  async start(options: {
    token: string;
    prompt: string;
    systemPrompt: string;
    model: string;
    signal?: AbortSignal | null;
  }): Promise<void> {
    this.abortSignal = options.signal;
    this.abortListener = () => this.close("Qoder tool request aborted");
    if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
    options.signal?.addEventListener("abort", this.abortListener, { once: true });
    this.server = http.createServer((request, response) => void this.handleMcp(request, response));
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    if (!address || typeof address === "string") throw new Error("Failed to bind Qoder MCP bridge");

    const configDir = getQoderCliConfigDir();
    fs.mkdirSync(configDir, { recursive: true });
    this.configPath = path.join(configDir, `omniroute-mcp-${randomUUID()}.json`);
    fs.writeFileSync(
      this.configPath,
      JSON.stringify({
        mcpServers: {
          omniroute: {
            type: "http",
            url: `http://127.0.0.1:${address.port}/mcp`,
            trust: true,
            alwaysAllow: this.tools.map((tool) => tool.name),
          },
        },
      }),
      { mode: 0o600 }
    );

    const level = await resolveQoderCliModel(options.model, options.token, {
      signal: options.signal,
    });
    const { command, useShell } = await resolveQoderCliInvocation();
    const args = [
      "--print",
      "--output-format",
      "json",
      "--model",
      level,
      "--tools",
      "",
      "--mcp-config",
      this.configPath,
      "--strict-mcp-config",
      "--allowed-mcp-server-names",
      "omniroute",
      "--permission-mode",
      "bypass_permissions",
      "--config-dir",
      configDir,
    ];
    if (options.systemPrompt) args.push("--system-prompt", options.systemPrompt);
    const env = { ...getLookupEnv(), QODER_PERSONAL_ACCESS_TOKEN: options.token };
    this.child = spawn(command, args, {
      cwd: getQoderCliWorkspace(),
      env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      ...(useShell ? { shell: true } : {}),
    });
    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => (this.stdout += chunk));
    this.child.stderr.on("data", (chunk: string) => (this.stderr += chunk));
    this.child.once("error", (error) =>
      this.finish({
        type: "result",
        stdout: this.stdout,
        stderr: this.stderr,
        code: null,
        error: error.message,
      })
    );
    this.child.once("close", (code) =>
      this.finish({ type: "result", stdout: this.stdout, stderr: this.stderr, code })
    );
    this.child.stdin.on("error", () => {});
    this.child.stdin.end(options.prompt);
    this.armTurnTimeout();
  }

  waitForOutcome(): Promise<ToolOutcome> {
    if (this.readyOutcome) {
      const outcome = this.readyOutcome;
      this.readyOutcome = undefined;
      return Promise.resolve(outcome);
    }
    if (!this.outcomePromise) {
      this.outcomePromise = new Promise<ToolOutcome>((resolve) => (this.outcomeResolve = resolve));
    }
    return this.outcomePromise;
  }

  resolveToolResult(id: string, content: string, isError = false): boolean {
    const pending = this.pendingResponses.get(id);
    if (!pending) return false;
    this.pendingResponses.delete(id);
    this.pendingToolCallIds.delete(id);
    this.writeJson(pending.response, 200, {
      jsonrpc: "2.0",
      id: pending.requestId,
      result: { content: [{ type: "text", text: content }], isError },
    });
    this.armTurnTimeout();
    return true;
  }

  close(errorMessage = "Qoder tool session closed"): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.turnTimer);
    if (this.abortListener) {
      this.abortSignal?.removeEventListener("abort", this.abortListener);
      this.abortListener = undefined;
    }
    try {
      this.child?.kill("SIGKILL");
    } catch {}
    for (const pending of this.pendingResponses.values()) pending.response.destroy();
    this.pendingResponses.clear();
    this.server?.close();
    if (this.configPath) {
      try {
        fs.unlinkSync(this.configPath);
      } catch {}
    }
    const resolve = this.outcomeResolve;
    this.outcomePromise = undefined;
    this.outcomeResolve = undefined;
    resolve?.({
      type: "result",
      stdout: "",
      stderr: errorMessage,
      code: null,
      error: errorMessage,
    });
  }

  private finish(outcome: ToolOutcome): void {
    if (this.closed) return;
    if (outcome.type === "result") {
      clearTimeout(this.turnTimer);
      if (this.abortListener) {
        this.abortSignal?.removeEventListener("abort", this.abortListener);
        this.abortListener = undefined;
      }
      this.server?.close();
      if (this.configPath) {
        try {
          fs.unlinkSync(this.configPath);
        } catch {}
        this.configPath = "";
      }
    }
    const resolve = this.outcomeResolve;
    this.outcomePromise = undefined;
    this.outcomeResolve = undefined;
    if (resolve) resolve(outcome);
    else this.readyOutcome = outcome;
  }

  private enqueueToolCall(call: QoderOpenAIToolCall): void {
    this.queuedCalls.push(call);
    queueMicrotask(() => {
      if (!this.queuedCalls.length) return;
      clearTimeout(this.turnTimer);
      const calls = this.queuedCalls.splice(0);
      this.finish({ type: "tool_calls", toolCalls: calls });
    });
  }

  private armTurnTimeout(): void {
    clearTimeout(this.turnTimer);
    this.turnTimer = setTimeout(() => this.close("Qoder tool request timed out"), 45_000);
    this.turnTimer.unref?.();
  }

  private async handleMcp(request: http.IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.method !== "POST")
      return this.writeJson(response, 405, { error: "Method not allowed" });
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of request) {
      const buffer = Buffer.from(chunk);
      size += buffer.length;
      if (size > 1024 * 1024) return this.writeJson(response, 413, { error: "Request too large" });
      chunks.push(buffer);
    }
    let message: JsonRecord;
    try {
      message = asRecord(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    } catch {
      return this.writeJson(response, 400, { error: "Invalid JSON" });
    }
    const id = message.id ?? null;
    const method = String(message.method || "");
    if (method === "initialize") {
      return this.writeJson(response, 200, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "omniroute", version: "1.0.0" },
        },
      });
    }
    if (method === "notifications/initialized") {
      response.writeHead(202).end();
      return;
    }
    if (method === "tools/list") {
      return this.writeJson(response, 200, { jsonrpc: "2.0", id, result: { tools: this.tools } });
    }
    if (method === "tools/call") {
      const params = asRecord(message.params);
      const name = String(params.name || "");
      if (!this.tools.some((tool) => tool.name === name)) {
        return this.writeJson(response, 200, {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Unknown tool" },
        });
      }
      const callId = `call_${randomUUID().replaceAll("-", "")}`;
      this.pendingResponses.set(callId, { response, requestId: id });
      this.pendingToolCallIds.add(callId);
      this.enqueueToolCall({
        id: callId,
        type: "function",
        function: { name, arguments: JSON.stringify(params.arguments ?? {}) },
      });
      return;
    }
    this.writeJson(response, 200, {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: "Method not found" },
    });
  }

  private writeJson(response: ServerResponse, status: number, value: unknown): void {
    if (response.destroyed || response.writableEnded) return;
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Mcp-Session-Id": "omniroute",
    });
    response.end(JSON.stringify(value));
  }
}

export type QoderToolRunResult =
  | { type: "tool_calls"; toolCalls: QoderOpenAIToolCall[]; session: QoderToolSession }
  | {
      type: "result";
      text: string;
      isError: boolean;
      errorMessage: string;
      stderr: string;
      code: number | null;
    };

async function nextSessionOutcome(
  session: QoderToolSession,
  runtime: QoderMcpRuntime
): Promise<QoderToolRunResult> {
  const outcome = await runtime.waitForOutcome();
  if (outcome.type === "tool_calls") {
    for (const call of outcome.toolCalls) session.pendingToolCallIds.add(call.id);
    qoderToolSessionManager.release(session, "awaiting_tool_result");
    return { ...outcome, session };
  }
  qoderToolSessionManager.release(session, "closed");
  const parsed = parseQoderCliResult(outcome.stdout);
  return {
    type: "result",
    ...parsed,
    errorMessage: outcome.error || parsed.errorMessage,
    stderr: outcome.stderr,
    code: outcome.code,
  };
}

export async function runQoderToolRequest(options: {
  token: string;
  model: string;
  body: unknown;
  signal?: AbortSignal | null;
}): Promise<QoderToolRunResult> {
  const parsed = parseQoderToolRequest(options.body);
  if (parsed.unsupportedToolChoice) {
    return {
      type: "result",
      text: "",
      isError: true,
      errorMessage: parsed.unsupportedToolChoice,
      stderr: "",
      code: null,
    };
  }
  if (parsed.toolResults.length) {
    const session = qoderToolSessionManager.findByToolCallIds(
      parsed.toolResults.map((result) => result.id)
    );
    if (!session || !(session.runtime instanceof QoderMcpRuntime)) {
      return {
        type: "result",
        text: "",
        isError: true,
        errorMessage: "Qoder tool session expired or was not found",
        stderr: "",
        code: null,
      };
    }
    const pendingResults = parsed.toolResults.filter((result) =>
      session.pendingToolCallIds.has(result.id)
    );
    if (!pendingResults.length) {
      qoderToolSessionManager.release(session, "awaiting_tool_result");
      return {
        type: "result",
        text: "",
        isError: true,
        errorMessage: "No pending Qoder tool result was provided",
        stderr: "",
        code: null,
      };
    }
    for (const result of pendingResults) {
      qoderToolSessionManager.sendToolResult(session, result.id, result.content);
    }
    return nextSessionOutcome(session, session.runtime);
  }

  const runtime = new QoderMcpRuntime(parsed.tools);
  const session = qoderToolSessionManager.open(parsed.conversationId ?? randomUUID(), runtime);
  try {
    await runtime.start({ ...options, prompt: parsed.prompt, systemPrompt: parsed.systemPrompt });
    return await nextSessionOutcome(session, runtime);
  } catch (error) {
    qoderToolSessionManager.close(session);
    return {
      type: "result",
      text: "",
      isError: true,
      errorMessage: (error as Error).message,
      stderr: "",
      code: null,
    };
  }
}
