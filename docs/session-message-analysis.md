# Session Message 对比分析：file vs SDK message 数组 vs pi-gateway

**分析日期**: 2026-04-24  
**数据来源**: `/root/.pi/agent/sessions/` 全部 session 文件（~1000 个文件，90,000+ 条 entry）

---

## 一、Session File 中的所有 Entry Type

| Entry Type | 总出现次数 | 是否在 SDK `messages[]` 中 | 是否在 pi-gateway `processSessionEntries()` 中 |
|-----------|-----------|-------------------------|------------------------------------------|
| `message` | 90,524 | ✅ 原样放入 messages | ✅ 作为 Message 处理 |
| `model_change` | 2,210 | ❌ **不在** messages（仅设 agent state） | ✅ 转为 `kind3: "model_change"` 消息 |
| `thinking_level_change` | 1,019 | ❌ **不在** messages（仅设 agent state） | ✅ 转为 `kind3: "thinking_level_change"` 消息 |
| `session` | 578 | ❌ **不在** messages（这是文件头部） | ❌ 跳过（无法解析） |
| `compaction` | 99 | ✅ **作为 summary 在** messages | ✅ 转为 `kind3: "compaction"` 消息 |
| `session_info` | 1 | ❌ **不在** messages（name 字段） | ❌ 跳过（未处理） |

---

## 二、关键发现：file 有但 SDK messages 没有的内容

### 2.1 `model_change` — 2,210 条丢失

SDK 处理方式：
- `buildSessionContext()` 中仅用于设置 `model` 变量（agent 状态的当前模型）
- **不放入 messages 数组**

对用户的影响：
- 会话加载时看不到模型变更历史
- 无法知道对话中间切换过哪些模型

pi-gateway 处理方式：
- `processSessionEntries()` 将其转为独立消息：`kind1: "sysinfo"`, `kind2: "event"`, `kind3: "model_change"`
- 内容示例：`"Model: deepseek/deepseek-reasoner"`

### 2.2 `thinking_level_change` — 1,019 条丢失

SDK 处理方式：
- `buildSessionContext()` 中仅用于设置 `thinkingLevel` 变量
- **不放入 messages 数组**

对用户的影响：
- 看不到 thinking level 的变更历史

pi-gateway 处理方式：
- `processSessionEntries()` 将其转为独立消息：`kind1: "sysinfo"`, `kind2: "event"`, `kind3: "thinking_level_change"`
- 内容示例：`"Thinking: off"`

### 2.3 `session_info` — 1 条丢失

格式：
```json
{
  "type": "session_info",
  "id": "16aee27e",
  "parentId": "9efb8621",
  "timestamp": "2026-04-20T10:46:49.829Z",
  "name": "dev-main"
}
```

SDK 处理方式：
- `getAllSessionSummaries()` 中用于提取 session name
- `buildSessionContext()` 中不处理
- **不放入 messages 数组**

pi-gateway 处理方式：
- `processSessionEntries()` 不处理，静默丢弃

### 2.4 `session` header — 578 条丢失

SDK 处理方式：
- 文件头信息，记录 session 元数据
- 用于版本迁移、cwd 提取
- 不放入 messages 数组（正确行为）

pi-gateway 处理方式：
- 不处理，静默丢弃（正确行为）

---

## 三、关键发现：SDK messages 有但 file 没有的内容

### 3.1 `custom_message` 和 `branch_summary`

SDK `buildSessionContext()` 会处理这两种 entry type：
```
custom_message → messages.push(createCustomMessage(...))
branch_summary → messages.push(createBranchSummaryMessage(...))
```

但当前扫描的所有 session 文件中**未发现**这两种类型。它们是 pi SDK 的高级功能（fork/branch、extensions），尚未在 pi-gateway-standalone 中被使用。

pi-gateway `processSessionEntries()` 不处理这两种类型 → 无影响（目前不存在）。

---

## 四、实时流 vs 文件加载路径的差异

### 实时流（WebSocket）
```
PiAgentSession.setupEventHandlers()
  ├── "message_end" → 发送 usage 事件
  ├── "compaction_start/end" → 发送事件
  ├── "auto_retry_start/end" → 发送事件
  └── 每个 case 带精确 type
```
**特点**：每个事件有精确类型标签，前端不需要猜测。

### 文件加载路径
```
getSessionMessages() 读取 JSONL → processSessionEntries()
  ├── model_change →  emoji 匹配检测（"🤖"）
  ├── thinking_level_change → emoji 匹配检测（"🧠"）
  ├── compaction → 直接走 case
  ├── retry/auto_retry → emoji 匹配检测（"🔄"）
  └── usage → 从 assistant message.content 提取 emoji（"📊"、"💰"）
```
**问题**：`retry`、`auto_retry`、`export` 这些类型在 session.jsonl 文件中**根本不存在**作为独立 entry type。它们可能是：
- 实时流独有的临时事件
- 从未写入 session file 的消息类型
- 从 content text 中通过 emoji 模式反推出来的

**需要确认**：`retry`/`auto_retry` 是否写入过 session file？搜索 suggests 它们从未作为 entry 出现。

---

## 五、usage 信息的处理链路差异

| 路径 | 传输方式 | message 数量 | usage 位置 |
|------|---------|------------|-----------|
| 实时流 | WebSocket `usage` 事件（独立消息） | assistant + usage = **2条** | 独立 WebSocket 消息 |
| 文件加载 | 从 assistant message 的 `usage` 字段提取 | assistant + usage = **2条** | `msg.usage` 字段 |

两种路径最终效果一致（都生成独立的 usage 消息），但实现路径不同。

---

## 六、建议措施

### 优先级 1：正确处理 model_change 和 thinking_level_change

这两个类型的 entry 在文件中存在量较大（3,000+ 条），已正确转换。**不需要改动。**

### 优先级 2：调查 retry/auto_retry/export 是否存在于文件

运行以下脚本验证 retry/auto_retry 是否曾写入 session file：
```bash
python3 -c "
import json, glob
for f in glob.glob('/root/.pi/agent/sessions/--*--/*.jsonl'):
    with open(f) as fp:
        for line in fp:
            obj = json.loads(line.strip())
            t = obj.get('type', '')
            if 'retry' in t or 'export' in t:
                print(f'{f}: type={t}')
"
```

如果结果为空，说明这些类型只存在于实时流中，文件加载时的 emoji 匹配是多余的（永远不会触发）。

### 优先级 3：考虑保留 emoji 匹配作为"保险"

即使 retry/auto_retry/export 目前不存在于文件中，保留 emoji 匹配逻辑也无害。未来 pi SDK 可能新增将 retry 事件写入 session file 的行为。

### 优先级 4：session_info 处理（低优先级）

`session_info` 只有 1 条记录，用于 session 名称显示。当前 session name 可通过 `SessionRegistry` 获取，无需从 entry 提取。

---

## 七、结论

| 问题 | 答案 |
|------|------|
| session file 有但 SDK messages 没有？ | ✅ 有：`model_change`（2,210条）、`thinking_level_change`（1,019条）、`session_info`（1条） |
| pi-gateway 是否处理了这些丢失的数据？ | ✅ `model_change` 和 `thinking_level_change` 已处理<br>❌ `session_info` 未处理（影响极小） |
| SDK messages 有但 file 没有？ | ✅ SDK 支持 `custom_message` 和 `branch_summary`，但当前文件中不存在（未使用的高级功能） |
| 文件加载 vs 实时流的差异？ | `retry`/`auto_retry`/`export` 可能只存在于实时流中，文件加载时需要 emoji 匹配重建 |
