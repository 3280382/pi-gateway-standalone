# 重构执行计划 - 5轮极致优化

## 重构原则
1. **零功能变更**：只改代码结构，不增删功能
2. **简化优先**：用最直接方式实现，消除抽象层
3. **消除重复**：DRY原则，提取公共代码
4. **清晰命名**：一看就懂，无需注释
5. **扁平结构**：减少嵌套，提前返回

---

## 第1轮：命名统一与结构清晰化

### 目标
统一所有session相关命名，消除混淆

### 当前问题
- `shortId`, `sessionId`, `id` 混用
- `sessionFile` vs `sessionPath` 不一致
- `runtimeStatus` vs `status` 不明确

### 重构动作
1. 统一使用：
   - `sessionShortId` - 8字符短ID
   - `sessionFullPath` - 完整文件路径
   - `sessionRuntimeStatus` - 运行状态

2. 文件重命名：
   - `session-manager.ts` → `SessionManager.ts` (PascalCase类文件)
   - `piAgentSession.ts` → `PiAgentSession.ts`

3. 函数重命名：
   - `extractShortSessionId()` → `extractSessionShortId()`
   - `getOrCreateSession()` → `acquireSession()`
   - `updateRuntimeStatus()` → `setSessionStatus()`

### 验证
- 所有测试通过
- 日志中的命名统一
- 无编译错误

---

## 第2轮：消除重复代码

### 目标
提取公共逻辑，减少代码重复

### 当前问题
- 多个地方解析session ID
- 多处重复的错误处理
- 多处重复的WebSocket发送逻辑

### 重构动作
1. 提取 `SessionIdUtil` 类：
```typescript
class SessionIdUtil {
  static extractShortId(fullPath: string): string;
  static extractTimestamp(fullPath: string): string;
  static isValidShortId(id: string): boolean;
}
```

2. 提取 `WebSocketSender` 类：
```typescript
class WebSocketSender {
  static send(ws: WebSocket, message: object): boolean;
  static sendSafe(ws: WebSocket, message: object): void;
  static broadcast(clients: WebSocket[], message: object): void;
}
```

3. 提取 `ErrorHandler`：
```typescript
class ErrorHandler {
  static log(context: string, error: unknown): void;
  static toUserMessage(error: unknown): string;
}
```

### 验证
- 代码行数减少 >10%
- 重复代码检测工具通过
- 所有测试通过

---

## 第3轮：简化复杂度

### 目标
降低认知负担，简化控制流

### 当前问题
- 深层嵌套 (最多5层)
- 复杂条件判断
- 过早抽象

### 重构动作
1. 减少嵌套层级：
```typescript
// 重构前
if (condition1) {
  if (condition2) {
    if (condition3) {
      doSomething();
    }
  }
}

// 重构后
if (!condition1) return;
if (!condition2) return;
if (!condition3) return;
doSomething();
```

2. 简化条件：
```typescript
// 重构前
const shouldBroadcast = entry.sidebarVisible === true || 
                       entry.lastBroadcastedStatus !== entry.runtimeStatus;

// 重构后
const statusChanged = entry.lastBroadcastedStatus !== entry.runtimeStatus;
const shouldBroadcast = entry.sidebarVisible || statusChanged;
```

3. 消除过度设计：
   - 移除不必要的接口
   - 移除只有一处的抽象类
   - 合并过度拆分的函数

### 验证
- 最大嵌套层级 <= 3
- 圈复杂度降低
- 所有测试通过

---

## 第4轮：依赖优化与解耦

### 目标
降低模块耦合，提高可测试性

### 当前问题
- 循环依赖风险
- 直接操作全局状态
- 难以单元测试

### 重构动作
1. 依赖注入：
```typescript
// 重构前
import { serverSessionManager } from './session-manager';

// 重构后
class PiAgentSession {
  constructor(
    private sessionManager: ISessionManager,
    // ...
  ) {}
}
```

2. 接口隔离：
```typescript
interface ISessionManager {
  getSession(id: string): SessionEntry | undefined;
  setClientSelectedSession(client: WebSocket, id: string): void;
}
```

3. 事件总线解耦：
```typescript
// 使用事件而非直接调用
eventBus.emit('session:statusChanged', { sessionId, status });
```

### 验证
- 无循环依赖
- 单元测试覆盖率 >90%
- 所有测试通过

---

## 第5轮：极致简化

### 目标
代码最小化，删除一切不必要

### 当前问题
- 未使用的代码
- 过度注释
- 冗余的类型定义
- 过度设计

### 重构动作
1. 删除未使用代码：
   - 搜索所有 `export` 但未引用的函数
   - 删除所有注释掉的代码
   - 删除所有 `console.log` (保留关键日志)

2. 简化类型：
```typescript
// 重构前
interface SessionEntry {
  session: PiAgentSession;
  shortId: string;
  workingDir: string;
  sessionFile: string;
  client: WebSocket;
  lastActivity: Date;
  runtimeStatus: SessionRuntimeStatus;
  sidebarVisible?: boolean;
  lastBroadcastedStatus?: SessionRuntimeStatus;
}

// 重构后
type SessionEntry = {
  session: PiAgentSession;
  shortId: string;
  workingDir: string;
  sessionFile: string;
  client: WebSocket;
  lastActivity: Date;
  status: SessionStatus;
};
```

3. 内联简单函数：
```typescript
// 重构前
function getShortId(sessionFile: string): string {
  return extractShortSessionId(sessionFile);
}

// 重构后 - 直接调用 extractShortSessionId
```

4. 合并文件：
   - 小文件合并到相关大文件
   - 消除只有导出的中间文件

### 验证
- 代码行数最少
- 无未使用代码
- 所有测试通过
- 人类代码评审通过

---

## 执行检查清单

每轮重构后检查：
- [ ] 零功能变更（测试100%通过）
- [ ] 代码行数减少或持平
- [ ] 复杂度降低
- [ ] 命名更清晰
- [ ] 无重复代码
- [ ] 无循环依赖
- [ ] 所有超时机制正常
- [ ] 日志可观测

---

## 重构后目标状态

```
重构前：
- 总代码行数: ~8000行
- 平均函数长度: 35行
- 最大嵌套层级: 5
- 重复代码块: 15处
- 圈复杂度: 平均8

重构后：
- 总代码行数: <5000行
- 平均函数长度: 20行
- 最大嵌套层级: 3
- 重复代码块: 0处
- 圈复杂度: 平均4
```

---

## 永不停歇条件

重构继续 ONLY IF：
- 代码还能更短
- 函数还能更简单
- 命名还能更清晰
- 结构还能更扁平

否则：进入下一轮优化评估
