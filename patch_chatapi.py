#!/usr/bin/env python3
"""
Patch chatApi.ts to add fault tolerance for message reconstruction
"""

import re

with open('src/client/features/chat/services/api/chatApi.ts', 'r') as f:
    content = f.read()

# 1. Patch text_delta
old_text_delta = '''  websocketService.on("text_delta", (data: { text?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_delta[${data?.index ?? "?"]}]`);
    if (data?.text) {
      store.appendStreamingContent(data.text);
    }
  });'''

new_text_delta = '''  websocketService.on("text_delta", (data: { text?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_delta[${data?.index ?? "?"]}]`);
    
    // 容错：检查是否需要自动创建 message_start
    if (messageReconstructor.shouldCreateMessageStart()) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
      store.createStreamingMessage();
      messageReconstructor.startMessage();
    }
    
    // 容错：检查是否需要自动创建 text_start
    const index = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(index, "text")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing text_start[${index}]`);
      store.startContentBlock("text", index);
      messageReconstructor.startContentBlock(index, "text");
    }

    if (data?.text) {
      store.appendStreamingContent(data.text);
      messageReconstructor.appendContent(index, data.text);
    }
  });'''

if old_text_delta in content:
    content = content.replace(old_text_delta, new_text_delta)
    print("✓ Patched text_delta")
else:
    print("✗ Could not find text_delta pattern")

# 2. Patch text_start
old_text_start = '''  websocketService.on("text_start", (data: { index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_start[${data?.index ?? "?"]}]`);
    store.startContentBlock("text", data?.index);
  });'''

new_text_start = '''  websocketService.on("text_start", (data: { index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] text_start[${data?.index ?? "?"]}]`);
    messageReconstructor.recordEvent("text_start");
    messageReconstructor.startContentBlock(data?.index ?? 0, "text");
    store.startContentBlock("text", data?.index);
  });'''

if old_text_start in content:
    content = content.replace(old_text_start, new_text_start)
    print("✓ Patched text_start")
else:
    print("✗ Could not find text_start pattern")

# 3. Patch text_end
old_text_end = '''  websocketService.on("text_end", (data: { index?: number; implicit?: boolean }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `[${ts}] [RECV] text_end[${data?.index ?? "?"]}]${data?.implicit ? " (implicit)" : ""}`
    );
    store.endContentBlock("text", data?.index);
  });'''

new_text_end = '''  websocketService.on("text_end", (data: { index?: number; implicit?: boolean }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(
      `[${ts}] [RECV] text_end[${data?.index ?? "?"]}]${data?.implicit ? " (implicit)" : ""}`
    );
    messageReconstructor.recordEvent("text_end");
    messageReconstructor.endContentBlock(data?.index ?? 0);
    store.endContentBlock("text", data?.index);
  });'''

if old_text_end in content:
    content = content.replace(old_text_end, new_text_end)
    print("✓ Patched text_end")
else:
    print("✗ Could not find text_end pattern")

# 4. Patch thinking_delta
old_thinking_delta = '''  websocketService.on("thinking_delta", (data: { thinking?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] thinking_delta[${data?.index ?? "?"]}]`);
    if (data?.thinking) {
      store.appendStreamingThinking(data.thinking);
    }
  });'''

new_thinking_delta = '''  websocketService.on("thinking_delta", (data: { thinking?: string; index?: number }) => {
    const ts = new Date().toISOString().split("T")[1].split(".")[0];
    console.log(`[${ts}] [RECV] thinking_delta[${data?.index ?? "?"]}]`);
    
    // 容错：检查是否需要自动创建 message_start
    if (messageReconstructor.shouldCreateMessageStart()) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
      store.createStreamingMessage();
      messageReconstructor.startMessage();
    }
    
    // 容错：检查是否需要自动创建 thinking_start
    const index = data?.index ?? 0;
    if (messageReconstructor.shouldCreateContentBlockStart(index, "thinking")) {
      console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing thinking_start[${index}]`);
      store.startContentBlock("thinking", index);
      messageReconstructor.startContentBlock(index, "thinking");
    }
    
    if (data?.thinking) {
      store.appendStreamingThinking(data.thinking);
      messageReconstructor.appendContent(index, data.thinking);
    }
  });'''

if old_thinking_delta in content:
    content = content.replace(old_thinking_delta, new_thinking_delta)
    print("✓ Patched thinking_delta")
else:
    print("✗ Could not find thinking_delta pattern")

# 5. Patch toolcall_delta
old_toolcall_delta = '''  websocketService.on(
    "toolcall_delta",
    (data: { toolCallId?: string; toolName?: string; delta?: string; index?: number }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `[${ts}] [RECV] toolcall_delta[${data?.index ?? "?"]}]: ${data?.toolName || "unknown"}`
      );
      if (data?.toolCallId && data?.toolName) {
        store.appendToolCallDelta(data.toolCallId, data.toolName, data.delta || "");
      }
    }
  );'''

new_toolcall_delta = '''  websocketService.on(
    "toolcall_delta",
    (data: { toolCallId?: string; toolName?: string; delta?: string; index?: number }) => {
      const ts = new Date().toISOString().split("T")[1].split(".")[0];
      console.log(
        `[${ts}] [RECV] toolcall_delta[${data?.index ?? "?"]}]: ${data?.toolName || "unknown"}`
      );
      
      // 容错：检查是否需要自动创建 message_start
      if (messageReconstructor.shouldCreateMessageStart()) {
        console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing message_start`);
        store.createStreamingMessage();
        messageReconstructor.startMessage();
      }
      
      // 容错：检查是否需要自动创建 toolcall_start
      const index = data?.index ?? 0;
      if (messageReconstructor.shouldCreateContentBlockStart(index, "tool_use")) {
        console.log(`[${ts}] [RECONSTRUCT] Auto-creating missing toolcall_start[${index}]`);
        store.startContentBlock("tool_use", index, {
          toolCallId: data?.toolCallId,
          toolName: data?.toolName,
        });
        messageReconstructor.startContentBlock(index, "tool_use", {
          toolCallId: data?.toolCallId,
          toolName: data?.toolName,
        });
      }
      
      if (data?.toolCallId && data?.toolName) {
        store.appendToolCallDelta(data.toolCallId, data.toolName, data.delta || "");
        messageReconstructor.appendContent(index, data.delta || "");
      }
    }
  );'''

if old_toolcall_delta in content:
    content = content.replace(old_toolcall_delta, new_toolcall_delta)
    print("✓ Patched toolcall_delta")
else:
    print("✗ Could not find toolcall_delta pattern")

with open('src/client/features/chat/services/api/chatApi.ts', 'w') as f:
    f.write(content)

print("\nDone!")
