#!/usr/bin/env python3
"""
直接在delta事件中插入容错逻辑
"""

with open('src/client/features/chat/services/api/chatApi.ts', 'r') as f:
    lines = f.readlines()

# 找到text_delta的位置并插入容错逻辑
for i, line in enumerate(lines):
    if 'websocketService.on("text_delta"' in line:
        # 在text_delta的函数体内添加容错逻辑
        # 找到函数体的开始（下一行）
        j = i + 1
        # 找到原有的if (data?.text)行
        while j < len(lines) and 'if (data?.text)' not in lines[j]:
            j += 1
        
        if j < len(lines):
            # 在if语句之前插入容错逻辑
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
                f"{indent}// 容错：检查是否需要自动创建 text_start\n",
                f"{indent}const index = data?.index ?? 0;\n",
                f"{indent}if (messageReconstructor.shouldCreateContentBlockStart(index, \"text\")) {{\n",
                f"{indent}  console.log(`[${{ts}}] [RECONSTRUCT] Auto-creating missing text_start[${{index}}]`);\n",
                f"{indent}  store.startContentBlock(\"text\", index);\n",
                f"{indent}  messageReconstructor.startContentBlock(index, \"text\");\n",
                f"{indent}}};\n",
                f"{indent}\n",
            ]
            # 在if (data?.text)之前插入
            lines = lines[:j] + new_lines + lines[j:]
            print(f"✓ Patched text_delta at line {i+1}")
            break

# 写回文件
with open('src/client/features/chat/services/api/chatApi.ts', 'w') as f:
    f.writelines(lines)

print("Done!")
