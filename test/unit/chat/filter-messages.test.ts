/**
 * Unit tests for filterMessages — full coverage of all 17 leaf filter types
 * Pattern: for each final type, test "only this type enabled, all others disabled"
 */

import { describe, expect, it } from "vitest";
import { filterMessages } from "../../../src/client/features/chat/stores/chatStore";
import type { Message } from "../../../src/client/features/chat/types/chat";

/* ─── Helpers ─── */
function msg(overrides: Partial<Message> = {}): Message {
  return {
    id: "test-msg",
    role: "assistant",
    kind1: "assistant",
    kind2: "response",
    content: [{ type: "text", text: "hello" }],
    timestamp: Date.now(),
    ...overrides,
  } as Message;
}

function allEnabled() {
  return {
    kind1: { user: true, assistant: true, sysinfo: true },
    kind2: { prompt: true, response: true, thinking: true, tool: true, event: true },
    kind3: {
      modelChange: true, thinkingLevelChange: true, compaction: true,
      retry: true, autoRetry: true, usage: true,
      toolSuccess: true, toolError: true, toolPending: true,
    },
  };
}

function onlyKind1(kind: "user" | "assistant" | "sysinfo") {
  const f = allEnabled();
  f.kind1 = { user: false, assistant: false, sysinfo: false, [kind]: true };
  return f;
}

function onlyKind2(kind2: "prompt" | "response" | "thinking" | "tool" | "event") {
  const f = allEnabled();
  // kind1 全开，kind2 只保留目标
  f.kind2 = { prompt: false, response: false, thinking: false, tool: false, event: false, [kind2]: true };
  return f;
}

function onlyKind3(kind3: keyof ReturnType<typeof allEnabled>["kind3"]) {
  const f = allEnabled();
  f.kind3 = {
    modelChange: false, thinkingLevelChange: false, compaction: false,
    retry: false, autoRetry: false, usage: false,
    toolSuccess: false, toolError: false, toolPending: false,
    [kind3]: true,
  };
  return f;
}

/* ─── Test data ─── */
const userMsg: Message = msg({
  id: "u1", role: "user", kind1: "user", kind2: "prompt",
  content: [{ type: "text", text: "hi" }],
});

const assistantText: Message = msg({
  id: "a1", kind2: "response",
  content: [{ type: "text", text: "reply" }],
});

const assistantThinking: Message = msg({
  id: "a2", kind2: "thinking", kind3: "thinking_block",
  content: [
    { type: "thinking", thinking: "hmm" },
    { type: "text", text: "answer" },
  ],
});

const assistantToolSuccess: Message = msg({
  id: "a3", kind2: "tool", kind3: "tool_call",
  content: [
    { type: "tool_use", toolName: "bash", toolCallId: "t1", args: "{}", output: "ok" },
  ],
});

const assistantToolError: Message = msg({
  id: "a4", kind2: "tool", kind3: "tool_call",
  content: [
    { type: "tool_use", toolName: "bash", toolCallId: "t2", args: "{}", error: "fail" },
  ],
});

const assistantToolPending: Message = msg({
  id: "a5", kind2: "tool", kind3: "tool_call",
  content: [
    { type: "tool_use", toolName: "bash", toolCallId: "t3", args: "{}" },
  ],
});

const sysinfoCompaction: Message = msg({
  id: "s1", role: "system", kind1: "sysinfo", kind2: "event", kind3: "compaction",
  content: [{ type: "text", text: "compacted" }],
});

const sysinfoRetry: Message = msg({
  id: "s2", role: "system", kind1: "sysinfo", kind2: "event", kind3: "retry",
  content: [{ type: "text", text: "retry" }],
});

const sysinfoAutoRetry: Message = msg({
  id: "s3", role: "system", kind1: "sysinfo", kind2: "event", kind3: "auto_retry",
  content: [{ type: "text", text: "auto retry" }],
});

const sysinfoModelChange: Message = msg({
  id: "s4", role: "system", kind1: "sysinfo", kind2: "event", kind3: "model_change",
  content: [{ type: "text", text: "model changed" }],
});

const sysinfoThinkingLevel: Message = msg({
  id: "s5", role: "system", kind1: "sysinfo", kind2: "event", kind3: "thinking_level_change",
  content: [{ type: "text", text: "level changed" }],
});

const sysinfoUsage: Message = msg({
  id: "s6", role: "system", kind1: "sysinfo", kind2: "event", kind3: "usage",
  content: [{ type: "text", text: "usage stats" }],
});

const allMessages = [
  userMsg, assistantText, assistantThinking, assistantToolSuccess,
  assistantToolError, assistantToolPending,
  sysinfoCompaction, sysinfoRetry, sysinfoAutoRetry,
  sysinfoModelChange, sysinfoThinkingLevel, sysinfoUsage,
];

/* ─── Level 1: only one source ─── */
describe("Level 1 — only one source enabled", () => {
  it("only user → shows only user messages", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind1("user") });
    expect(r.map((m) => m.id)).toEqual(["u1"]);
  });

  it("only assistant → shows only assistant messages", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind1("assistant") });
    expect(r.map((m) => m.id)).toEqual([
      "a1", "a2", "a3", "a4", "a5",
    ]);
  });

  it("only sysinfo → shows only sysinfo messages", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind1("sysinfo") });
    expect(r.map((m) => m.id)).toEqual([
      "s1", "s2", "s3", "s4", "s5", "s6",
    ]);
  });
});

/* ─── Level 2: only one content type ─── */
describe("Level 2 — only one content type enabled (kind1=all)", () => {
  it("only prompt → shows only user prompts", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind2("prompt") });
    expect(r.map((m) => m.id)).toEqual(["u1"]);
  });

  it("only response → shows only text responses", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind2("response") });
    expect(r.map((m) => m.id)).toEqual(["a1"]);
  });

  it("only thinking → shows messages with thinking content", () => {
    // a2 (thinking+text) contains enabled thinking
    const r = filterMessages(allMessages, { query: "", filters: onlyKind2("thinking") });
    expect(r.map((m) => m.id)).toEqual(["a2"]);
  });

  it("only tool → shows only tool messages", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind2("tool") });
    expect(r.map((m) => m.id)).toEqual(["a3", "a4", "a5"]);
  });

  it("only event → shows only sysinfo events", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind2("event") });
    expect(r.map((m) => m.id)).toEqual(["s1", "s2", "s3", "s4", "s5", "s6"]);
  });
});

/* ─── Level 3: only one subtype ─── */
describe("Level 3 — only one subtype enabled (kind1+kind2=all)", () => {
  // kind3 filters tool status and sysinfo event subtypes.
  // Non-tool / non-sysinfo messages pass through unaffected.
  // Tool messages are filtered by their status; when a tool status is disabled,
  // that tool message is hidden even if kind2.tool is true.
  const nonToolIds = ["u1", "a1", "a2"];

  it("only toolSuccess → non-tool + success tools", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("toolSuccess") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "a3"]);
  });

  it("only toolError → non-tool + error tools", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("toolError") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "a4"]);
  });

  it("only toolPending → non-tool + pending tools", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("toolPending") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "a5"]);
  });

  it("only compaction → non-tool + compaction event", () => {
    // tool messages filtered out because their status is disabled
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("compaction") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s1"]);
  });

  it("only retry → non-tool + retry event", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("retry") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s2"]);
  });

  it("only autoRetry → non-tool + autoRetry event", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("autoRetry") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s3"]);
  });

  it("only modelChange → non-tool + modelChange event", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("modelChange") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s4"]);
  });

  it("only thinkingLevelChange → non-tool + thinkingLevelChange event", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("thinkingLevelChange") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s5"]);
  });

  it("only usage → non-tool + usage event", () => {
    const r = filterMessages(allMessages, { query: "", filters: onlyKind3("usage") });
    expect(r.map((m) => m.id)).toEqual([...nonToolIds, "s6"]);
  });
});

/* ─── Combo: only assistant + only one kind2 ─── */
describe("Combo — only assistant + only one kind2", () => {
  function assistantPlus(kind2: "response" | "thinking" | "tool") {
    const f = allEnabled();
    f.kind1 = { user: false, assistant: true, sysinfo: false };
    f.kind2 = { prompt: false, response: false, thinking: false, tool: false, event: false, [kind2]: true };
    return f;
  }

  it("assistant + only response → a1", () => {
    const r = filterMessages(allMessages, { query: "", filters: assistantPlus("response") });
    expect(r.map((m) => m.id)).toEqual(["a1"]);
  });

  it("assistant + only thinking → a2", () => {
    const r = filterMessages(allMessages, { query: "", filters: assistantPlus("thinking") });
    expect(r.map((m) => m.id)).toEqual(["a2"]);
  });

  it("assistant + only tool → a3,a4,a5", () => {
    const r = filterMessages(allMessages, { query: "", filters: assistantPlus("tool") });
    expect(r.map((m) => m.id)).toEqual(["a3", "a4", "a5"]);
  });
});
