#!/usr/bin/env python3
"""
在thinking_delta事件中插入容错逻辑
"""

with open('src/client/features/chat/services/api/chatApi.ts', 'r') as f:
    lines = f.readlines()

# 找到thinking_delta的位置并插入容错逻辑
for i, line in enumerate(lines):
    if 'websocketService.on("thinking_delta"' in line:
        # 找到原有的if (data?.thinking)行
        j = i + 1
        while j < len(lines) and 'if (data?.thinking)' not in lines[j]:
            j += 1
        
        if j < len(lines):
            indent = "    "
            new_lines = [
                f"{indent}\n",
                f"{indent}// 容错：检查是否需要自动创建 message_start\n",
                f"{indent}if (messageReconstructor.shouldCreateMessageStart()) {{\n",
                f"{indent}  console.log(`[${{ts}}] [RECONSTRUCT] Auto-creating missing message_start`);\n",
                f"{indent}  store.createStreamingMessage();\n",
                f"{indent}  messageReconstructor.startMessage();\n",
                f"{indent}}};\n",
                f"{indent}\n",
                f"{indent}// 容错：检查是否需要自动创建 thinking_start\n",
                f"{indent}const thinkingIndex = data?.index ?? 0;\n",
                f"{indent}if (messageReconstructor.shouldCreateContentBlockStart(thinkingIndex, \"thinking\")) {{\n",
                f"{indent}  console.log(`[${{ts}}] [RECONSTRUCT] Auto-creating missing thinking_start[${{thinkingIndex}}]`);\n",
                f"{indent}  store.startContentBlock(\"thinking\", thinkingIndex);\n",
                f"{indent}  messageReconstructor.startContentBlock(thinkingIndex, \"thinking\");\n",
                f"{indent}}};\n",
                f"{indent}\n",
            ]
            lines = lines[:j] + new_lines + lines[j:]
            print(f"✓ Patched thinking_delta at line {i+1}")
            break

with open('src/client/features/chat/services/api/chatApi.ts', 'w') as f:
    f.writelines(lines)

print("Done!")
