#!/usr/bin/env python3
"""
在toolcall_delta事件中插入容错逻辑
"""

with open('src/client/features/chat/services/api/chatApi.ts', 'r') as f:
    lines = f.readlines()

# 找到toolcall_delta的位置并插入容错逻辑
for i, line in enumerate(lines):
    if '"toolcall_delta"' in line and 'websocketService.on' in lines[i-1]:
        # 找到原有的if (data?.toolCallId && data?.toolName)行
        j = i + 1
        while j < len(lines) and 'if (data?.toolCallId && data?.toolName)' not in lines[j]:
            j += 1
        
        if j < len(lines):
            indent = "      "
            new_lines = [
                f"{indent}\n",
                f"{indent}// 容错：检查是否需要自动创建 message_start\n",
                f"{indent}if (messageReconstructor.shouldCreateMessageStart()) {{\n",
                f"{indent}  console.log(`[${{ts}}] [RECONSTRUCT] Auto-creating missing message_start`);\n",
                f"{indent}  store.createStreamingMessage();\n",
                f"{indent}  messageReconstructor.startMessage();\n",
                f"{indent}}};\n",
                f"{indent}\n",
                f"{indent}// 容错：检查是否需要自动创建 toolcall_start\n",
                f"{indent}const toolIndex = data?.index ?? 0;\n",
                f"{indent}if (messageReconstructor.shouldCreateContentBlockStart(toolIndex, \"tool_use\")) {{\n",
                f"{indent}  console.log(`[${{ts}}] [RECONSTRUCT] Auto-creating missing toolcall_start[${{toolIndex}}]`);\n",
                f"{indent}  store.startContentBlock(\"tool_use\", toolIndex, {{\n",
                f"{indent}    toolCallId: data?.toolCallId,\n",
                f"{indent}    toolName: data?.toolName,\n",
                f"{indent}  }});\n",
                f"{indent}  messageReconstructor.startContentBlock(toolIndex, \"tool_use\", {{\n",
                f"{indent}    toolCallId: data?.toolCallId,\n",
                f"{indent}    toolName: data?.toolName,\n",
                f"{indent}  }});\n",
                f"{indent}}};\n",
                f"{indent}\n",
            ]
            lines = lines[:j] + new_lines + lines[j:]
            print(f"✓ Patched toolcall_delta at line {i+1}")
            break

with open('src/client/features/chat/services/api/chatApi.ts', 'w') as f:
    f.writelines(lines)

print("Done!")
