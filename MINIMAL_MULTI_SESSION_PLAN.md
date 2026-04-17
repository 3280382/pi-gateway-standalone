# 最小多会话修改方案

## 目标
- 允许同一工作目录下同时运行多个活跃的AI进程
- 左侧面板可以看到活跃进程状态
- 中间聊天界面只关联其中一个活跃进程，可随时切换
- 通过HTTP API获取活跃会话列表，WebSocket用于当前关联进程通信

## 当前限制
当前 `ServerSessionManager` 限制每个工作目录只能有一个活跃会话：
```typescript
// 一对一映射：workingDir → sessionKey
private workingDirToKey: Map<string, string> = new Map();

// 在 getOrCreateSession 中，如果同一workingDir已有不同sessionFile，会销毁旧会话
if (existingKeyForDir && existingKeyForDir !== sessionKey) {
  this.disposeSessionByKey(existingKeyForDir);  // 销毁旧会话
}
```

## 修改方案

### 第一步：修改 `session-manager.ts`（核心）

#### 1.1 修改映射关系
```typescript
// 第50行，修改为：
private workingDirToKeys: Map<string, Set<string>> = new Map();
```

#### 1.2 修改 `getOrCreateSession` 方法
```typescript
// 第105-112行，注释掉销毁其他会话的代码：
// const existingKeyForDir = this.workingDirToKey.get(workingDir);
// if (existingKeyForDir && existingKeyForDir !== sessionKey) {
//   console.log(...);
//   this.disposeSessionByKey(existingKeyForDir);
// }
```

#### 1.3 更新映射管理
在创建新会话后（约第184行）：
```typescript
// 更新 workingDirToKeys 映射
if (!this.workingDirToKeys.has(workingDir)) {
  this.workingDirToKeys.set(workingDir, new Set());
}
this.workingDirToKeys.get(workingDir)!.add(newSessionKey);
```

#### 1.4 修改所有使用 `workingDirToKey` 的地方
需要修改以下行（共11处）：

| 行号 | 原代码 | 修改为 |
|------|--------|--------|
| 105 | `this.workingDirToKey.get(workingDir)` | `Array.from(this.workingDirToKeys.get(workingDir) || [])[0]`（如果需要第一个）或修改逻辑 |
| 184 | `this.workingDirToKey.set(workingDir, newSessionKey)` | 已在上一步处理 |
| 238 | `this.workingDirToKey.get(currentWorkingDir)` | `this.workingDirToKeys.get(currentWorkingDir)` |
| 261 | `this.workingDirToKey.get(workingDir)` | `this.workingDirToKeys.get(workingDir)` |
| 304 | `this.workingDirToKey.delete(entry.workingDir)` | `this.workingDirToKeys.delete(entry.workingDir)` |
| 318 | `this.workingDirToKey.get(workingDir)` | `this.workingDirToKeys.get(workingDir)` |
| 331 | `this.workingDirToKey.get(workingDir)` | `this.workingDirToKeys.get(workingDir)` |
| 357 | `this.workingDirToKey.get(workingDir)` | `this.workingDirToKeys.get(workingDir)` |
| 411 | `this.workingDirToKey.get(workingDir)` | `this.workingDirToKeys.get(workingDir)` |
| 426 | `this.workingDirToKey.set(workingDir, sessionKey)` | `if (!this.workingDirToKeys.has(workingDir)) this.workingDirToKeys.set(workingDir, new Set()); this.workingDirToKeys.get(workingDir)!.add(sessionKey);` |

#### 1.5 添加 `getActiveSessions` 方法
```typescript
/**
 * 获取工作目录下所有活跃会话
 */
getActiveSessions(workingDir: string): Array<{
  sessionFile: string;
  isActive: boolean;  // 是否有WebSocket客户端连接
  lastActivity: Date;
}> {
  const sessionKeys = this.workingDirToKeys.get(workingDir);
  if (!sessionKeys) return [];
  
  const result = [];
  for (const sessionKey of sessionKeys) {
    const entry = this.sessions.get(sessionKey);
    if (entry) {
      result.push({
        sessionFile: entry.sessionFile,
        isActive: entry.client.readyState === WebSocket.OPEN,
        lastActivity: entry.lastActivity,
      });
    }
  }
  
  return result;
}
```

### 第二步：添加HTTP API端点

#### 2.1 修改 `session.controller.ts`
在现有文件末尾添加：
```typescript
import { serverSessionManager } from "../agent-session/session-manager";

/**
 * 获取活跃会话列表
 */
export async function getActiveSessions(req: Request, res: Response) {
  const workingDir = req.query.workingDir as string;
  
  if (!workingDir) {
    return res.status(400).json({ 
      error: "workingDir parameter is required" 
    });
  }
  
  try {
    const activeSessions = serverSessionManager.getActiveSessions(workingDir);
    
    res.json({
      workingDir,
      activeSessions,
      count: activeSessions.length,
    });
  } catch (error) {
    logger.error(`[getActiveSessions] Error: ${error}`);
    res.status(500).json({ 
      error: "Failed to get active sessions" 
    });
  }
}
```

#### 2.2 注册路由
修改 `http-routes.ts`，添加：
```typescript
app.get("/api/sessions/active", getActiveSessions);
```

### 第三步：修改前端侧边栏

#### 3.1 修改 `SessionDropdownSection.tsx`
```typescript
// 添加状态
const [activeSessions, setActiveSessions] = useState<Set<string>>(new Set());

// 获取活跃会话
useEffect(() => {
  const fetchActiveSessions = async () => {
    const workingDir = useSessionStore.getState().workingDir;
    if (!workingDir) return;
    
    try {
      const response = await fetch(
        `/api/sessions/active?workingDir=${encodeURIComponent(workingDir)}`
      );
      if (response.ok) {
        const data = await response.json();
        const activeFiles = new Set(
          data.activeSessions
            .filter((s: any) => s.isActive)
            .map((s: any) => s.sessionFile)
        );
        setActiveSessions(activeFiles);
      }
    } catch (error) {
      console.error("Failed to fetch active sessions:", error);
    }
  };
  
  fetchActiveSessions();
  const interval = setInterval(fetchActiveSessions, 10000); // 每10秒刷新
  return () => clearInterval(interval);
}, []);

// 在渲染会话时添加状态指示器
{sessions.map((session) => {
  const isActive = activeSessions.has(session.id);
  
  return (
    <div key={session.id} className={...}>
      <div className={styles.sessionRow}>
        <span className={styles.sessionName}>
          {session.name}
          {isActive && (
            <span className={styles.activeIndicator} title="Active session">
              ●
            </span>
          )}
        </span>
        {session.messageCount > 0 && (
          <span className={styles.sessionCount}>{session.messageCount}</span>
        )}
      </div>
    </div>
  );
})}
```

#### 3.2 添加CSS样式
在 `SidebarPanel.module.css` 中添加：
```css
.activeIndicator {
  color: #4CAF50;
  font-size: 12px;
  margin-left: 4px;
  animation: pulse 2s infinite;
}

.sessionRow {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

@keyframes pulse {
  0% { opacity: 1; }
  50% { opacity: 0.5; }
  100% { opacity: 1; }
}
```

## 验证测试

### 测试场景
1. **创建多个会话**
   - 打开应用，创建会话A
   - 点击"New Session"创建会话B
   - 验证两个会话同时存在

2. **会话切换**
   - 在会话A中发送消息
   - 切换到会话B，发送不同消息
   - 切回会话A，验证消息历史正确

3. **活跃状态显示**
   - 观察侧边栏，当前会话应有绿点指示
   - 切换会话，指示器相应更新

4. **HTTP API测试**
   ```
   GET /api/sessions/active?workingDir=/root
   响应：{ "activeSessions": [...] }
   ```

### 预期结果
- 同一工作目录可同时运行多个AI进程
- 侧边栏显示活跃会话状态
- 会话切换流畅，消息历史正确
- HTTP API返回准确的活跃会话列表

## 备选简化方案

如果不想添加HTTP API，可以采用更简化的方案：

**只修改 `session-manager.ts`**：
1. 允许同一工作目录多个会话共存
2. 移除销毁其他会话的逻辑
3. 保持现有切换功能

这样不会在前端显示活跃状态，但后台已经支持多会话。

## 实施步骤

1. **备份现有文件**
   ```bash
   cp src/server/features/chat/agent-session/session-manager.ts session-manager.backup.ts
   ```

2. **修改 `session-manager.ts`**（核心修改）
3. **修改 `session.controller.ts`**（添加API）
4. **修改 `http-routes.ts`**（注册路由）
5. **修改 `SessionDropdownSection.tsx`**（添加状态显示）
6. **测试验证**

每个步骤后运行：
```bash
npm run check  # 代码检查
npm test       # 单元测试
```

## 风险控制

1. **会话映射错误**
   - 风险：修改映射关系可能导致客户端找不到会话
   - 控制：仔细测试映射逻辑，添加详细日志

2. **资源泄漏**
   - 风险：多个会话可能消耗过多内存
   - 控制：后续可添加会话超时清理

3. **向后兼容**
   - 风险：现有单会话功能受影响
   - 控制：保持现有API不变，新增功能为扩展

## 回滚方案

如遇问题可回退：
1. 恢复 `session-manager.ts` 备份
2. 移除新增的API端点和前端代码
3. 数据格式未变，无需特殊处理

---

此方案为最小修改，仅改动必要的3个文件，即可实现多会话支持。