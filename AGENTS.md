# Pi Gateway Standalone - AI Assistant Guide

> **This is the primary reference document for AI Coding Agents**. Read this first before starting any task.

## Project Identification

- **Name**: pi-gateway-standalone
- **Location**: /root/pi-gateway-standalone
- **GitHub**: https://github.com/3280382/pi-gateway-standalone
- **Type**: Web gateway for Pi Coding Agent (React + Node.js)

## First Message Rule

**If the user did not give a concrete task, ALWAYS read in parallel:**
1. `README.md` - Project overview and quick start
2. `DEVELOPMENT.md` - Development guide and architecture principles
3. `FEATURES.md` - Feature specification and UI guidelines

Then ask which specific feature to work on.

## Quick Decision Reference

### Pre-Modification Checklist
- [ ] Do I understand the affected feature domain (chat/files/shared)?
- [ ] Have I checked the corresponding store/service/component?
- [ ] Does it comply with import constraints (client/ cannot import @server/*)?
- [ ] Have I run `npm run check`?

### Common Tasks Quick Path

| Task Type | Key Location | Notes |
|-----------|--------------|-------|
| **Modify chat UI** | `src/client/features/chat/components/` | Check MessageList, InputArea, ChatPanel |
| **Modify sidebar** | `src/client/features/chat/components/sidebar/` | SidebarPanel, ModelParamsSection |
| **Modify header** | `src/client/features/chat/components/Header/` | AppHeader, DirectoryPicker |
| **Add WebSocket message** | `src/server/features/chat/ws-handlers/message/` | Follow existing handler pattern |
| **Modify state management** | `src/client/features/chat/stores/` | Use Zustand, check persist config |
| **Modify file browser** | `src/client/features/files/components/` | FileBrowser, FileGrid |

### Key Constraints (Non-Violable)

```
client/          → Cannot import @server/*
server/          → Cannot import @client/*  
shared/          → No runtime logic (types only)
```

### Code Commit Standards

```bash
# Must run before committing
npm run check  # Fix all errors and warnings

# Commit format
type(scope): subject

Types: feat, fix, docs, style, refactor, test, chore

Examples:
feat(chat): add message search
fix(files): fix sidebar duplication
refactor(core): optimize initialization
```

## Documentation Navigation

**Do NOT read these documents directly unless AGENTS.md guides you to:**

| Document | When to Read | Content Summary |
|----------|--------------|-----------------|
| [`README.md`](./README.md) | First Message Rule or need project overview | Quick start, project structure |
| [`DEVELOPMENT.md`](./DEVELOPMENT.md) | Need development standards, architecture details | Development guide, API reference |
| [`FEATURES.md`](./FEATURES.md) | Need UI specs, feature definitions | Feature specification, user flows |
| [`CHANGELOG.md`](./CHANGELOG.md) | Need version history | Version changes |

## Project Structure Quick Reference (High Level)

```
src/
├── client/features/     # Frontend feature domains
│   ├── chat/           # Chat feature (components/, stores/, services/)
│   └── files/          # File feature (components/, stores/, services/)
├── server/features/    # Backend feature domains
│   └── chat/           # agent-session/, ws-handlers/, controllers/
└── shared/             # Shared types (type definitions only)
```

**For detailed structure, see README.md and DEVELOPMENT.md**

## Development Environment

**统一的开发测试环境（唯一推荐方式）**

```bash
# Tmux 3-pane mode - 同时启动前端、后端和监控
bash scripts/start-tmux-dev.sh
```

### 自动监控和热启动

Tmux 模式下已配置自动监控和热启动：

| 组件 | 热启动方式 | 说明 |
|------|-----------|------|
| 后端 | `tsx watch` 自动重启 | 代码修改后自动重启 |
| 前端 | Vite HMR 热更新 | 代码修改后浏览器自动刷新 |

**说明：**
- 正常情况下无需手动重启，代码修改后自动生效
- 仅在添加新依赖或配置文件修改后需要手动重启
- 开发和测试使用同一套运行环境，确保一致性

### 单独重启前后端

使用 `scripts/tmux-dev.sh` 脚本管理：

```bash
# 单独重启前端
bash scripts/tmux-dev.sh restart-frontend

# 单独重启后端
bash scripts/tmux-dev.sh restart-backend

# 查看状态
bash scripts/tmux-dev.sh status

# 停止前端
bash scripts/tmux-dev.sh stop-frontend

# 停止后端
bash scripts/tmux-dev.sh stop-backend

# 启动前端
bash scripts/tmux-dev.sh start-frontend

# 启动后端
bash scripts/tmux-dev.sh start-backend
```

**直接命令方式（tmux 快捷键）：**

```bash
# 进入 tmux 后，切换到对应窗格重启

# 重启后端 (窗格 1)
tmux select-pane -t gateway-dev:0.1
tmux send-keys -t gateway-dev:0.1 C-c  # 停止
tmux send-keys -t gateway-dev:0.1 'npm run dev' Enter  # 启动

# 重启前端 (窗格 0)
tmux select-pane -t gateway-dev:0.0
tmux send-keys -t gateway-dev:0.0 C-c  # 停止
tmux send-keys -t gateway-dev:0.0 'npm run dev:react' Enter  # 启动
```

### 检查代码

```bash
npm run check  # 提交前必须运行
```

## Testing Standards

### 测试快速参考

| 命令 | 说明 |
|------|------|
| `bash scripts/run-all-tests.sh` | 运行所有测试（推荐） |
| `bash scripts/run-terminal-tests.sh all` | 运行终端服务端+客户端测试 |
| `bash scripts/run-terminal-tests.sh server` | 仅运行服务端测试 |
| `bash scripts/run-terminal-tests.sh client` | 仅运行浏览器测试 |
| `npm run test` | 运行 Vitest 单元测试 |
| `cat test-results/latest/summary.md` | 查看最新测试报告 |

### 测试结果位置

所有测试结果统一输出到 `test-results/<timestamp>/` 目录：

```
test-results/latest/
├── summary.md           # 📄 人类可读的总览报告
├── backend/
│   ├── server.log      # 🖥️ 后端服务完整日志
│   └── test.log        # 🧪 后端测试执行日志
├── frontend/
│   └── dev-server.log  # ⚛️ 前端服务日志
├── browser/
│   ├── test.log        # 🎭 Playwright测试日志
│   ├── console.log     # 🌐 浏览器控制台输出
│   └── ws-messages.json # 📡 WebSocket消息记录
└── screenshots/
    └── *.png           # 📸 测试截图
```

### 测试输出规范（重要）

所有测试必须遵循统一的输出规范，确保测试结果对人类可读、可追踪、可备份。

#### 测试结果目录结构

```
test-results/
├── YYYY-MM-DD_HH-MM-SS/           # 每次测试的独立目录（时间戳命名）
│   ├── summary.md                 # 人类可读的测试摘要
│   ├── report.json                # 机器可读的完整报告
│   ├── backend/
│   │   ├── server.log             # 后端完整运行日志
│   │   └── test.log               # 后端测试执行日志
│   ├── frontend/
│   │   ├── build.log              # 前端构建日志
│   │   └── dev-server.log         # 前端开发服务器日志
│   ├── browser/
│   │   ├── console.log            # 浏览器控制台日志
│   │   ├── network.log            # 浏览器网络请求日志
│   │   └── ws-messages.json       # WebSocket消息记录
│   └── screenshots/
│       ├── 01-test-name.png       # 按顺序编号的截图
│       ├── 02-test-name.png
│       └── failed-*.png           # 失败测试的截图
└── latest -> YYYY-MM-DD_HH-MM-SS  # 软链接到最新结果
```

#### 测试脚本规范

测试脚本必须实现以下自动化流程，**不需要AI模型介入处理**：

```bash
#!/bin/bash
# 测试脚本模板规范

set -e

# ========== 1. 配置 ==========
TEST_TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
RESULTS_DIR="test-results/${TEST_TIMESTAMP}"
BACKUP_DIR="test-results/backups"

# ========== 2. 备份和清理 ==========
# 自动备份上一次测试结果
if [ -L "test-results/latest" ]; then
    LAST_RESULT=$(readlink test-results/latest)
    if [ -d "$LAST_RESULT" ]; then
        mkdir -p "$BACKUP_DIR"
        cp -r "$LAST_RESULT" "$BACKUP_DIR/$(basename $LAST_RESULT)"
        echo "已备份上次结果: $BACKUP_DIR/$(basename $LAST_RESULT)"
    fi
fi

# 清理旧的 latest 链接
rm -f test-results/latest

# 创建新结果目录
mkdir -p "$RESULTS_DIR"/{backend,frontend,browser,screenshots}

# ========== 3. 启动服务并捕获日志 ==========
# 后端日志捕获
npm run dev > "$RESULTS_DIR/backend/server.log" 2>&1 &
SERVER_PID=$!

# 前端日志捕获
npm run dev:react > "$RESULTS_DIR/frontend/dev-server.log" 2>&1 &
FRONTEND_PID=$!

# 等待服务启动
sleep 5

# ========== 4. 执行测试并捕获所有输出 ==========
npx playwright test \
    --reporter=html,json,line \
    --output="$RESULTS_DIR" \
    2>&1 | tee "$RESULTS_DIR/test-run.log"

TEST_EXIT_CODE=${PIPESTATUS[0]}

# ========== 5. 收集浏览器日志 ==========
# 浏览器控制台日志（由playwright自动收集到 test-results/

# ========== 6. 生成人类可读报告 ==========
cat > "$RESULTS_DIR/summary.md" << 'REPORT'
测试报告: ${TEST_TIMESTAMP}

[摘要]
- 测试时间: $(date)
- 测试类型: E2E / Unit / Integration
- 总体结果: 通过 / 失败

[统计]
- 总测试数: X | 通过: X | 失败: X | 跳过: X
- 总耗时: X秒

[日志文件位置]
- 后端日志: backend/server.log
- 前端日志: frontend/dev-server.log
- 浏览器控制台: browser/console.log
- 测试执行日志: test-run.log

REPORT

# ========== 7. 更新 latest 链接 ==========
ln -sf "$RESULTS_DIR" test-results/latest

# ========== 8. 输出结果摘要 ==========
echo ""
echo "═══════════════════════════════════════════════════════"
echo "测试完成"
echo "═══════════════════════════════════════════════════════"
echo "结果目录: $RESULTS_DIR"
echo "查看报告: cat $RESULTS_DIR/summary.md"
echo "查看截图: ls $RESULTS_DIR/screenshots/"
echo ""

# 返回测试退出码
exit $TEST_EXIT_CODE
```

#### 可用的测试命令

```bash
# 运行所有测试（自动完成备份、日志收集、报告生成）
bash scripts/run-all-tests.sh

# 仅运行服务端测试（headless，无浏览器）
bash scripts/run-terminal-tests.sh server

# 仅运行客户端浏览器测试
bash scripts/run-terminal-tests.sh client

# 运行完整E2E测试
npx playwright test test/e2e/

# 运行单元测试
npm run test
```

#### 测试结果检查清单

测试脚本运行后，检查结果目录是否包含：

- [ ] `summary.md` - 人类可读的总览
- [ ] `report.json` - 详细的JSON报告
- [ ] `backend/server.log` - 后端完整日志
- [ ] `frontend/dev-server.log` - 前端服务日志
- [ ] `browser/console.log` - 浏览器控制台输出
- [ ] `browser/ws-messages.json` - WebSocket通信记录
- [ ] `screenshots/*.png` - 关键步骤截图（至少每个测试一张）
- [ ] `latest` 软链接指向当前结果

#### 测试自动化规范（无需AI介入）

测试脚本已完全自动化以下流程，**AI模型不应重复处理**：

```bash
# ✅ 脚本自动处理（无需AI操作）
1. 备份上一次测试结果到 backups/ 目录
2. 清理旧的 latest 链接
3. 创建新的时间戳目录结构
4. 启动后端服务并捕获所有输出到 backend/server.log
5. 启动前端服务并捕获所有输出到 frontend/dev-server.log
6. 运行测试并收集详细的执行日志
7. 捕获浏览器控制台输出到 browser/console.log
8. 捕获 WebSocket 消息到 browser/ws-messages.json
9. 自动截图保存到 screenshots/ 目录
10. 生成人类可读的 summary.md 报告
11. 更新 latest 软链接
12. 输出测试统计和结果摘要

# ❌ AI不应重复操作
- 不要手动创建 test-results/ 目录
- 不要手动复制日志文件
- 不要手动生成报告
- 不要手动备份旧结果
```

#### 测试失败时的诊断流程

当测试失败时，按以下顺序查看日志：

```bash
# 1. 查看测试摘要
cat test-results/latest/summary.md

# 2. 查看服务端测试日志
tail -100 test-results/latest/backend/test.log

# 3. 查看服务端运行日志
tail -100 test-results/latest/backend/server.log

# 4. 查看浏览器测试日志
tail -100 test-results/latest/browser/test.log

# 5. 查看浏览器控制台
cat test-results/latest/browser/console.log

# 6. 查看 WebSocket 消息
jq . test-results/latest/browser/ws-messages.json | head -50

# 7. 查看截图
ls -la test-results/latest/screenshots/
```

#### 测试备份策略

每次测试运行自动执行备份：

```bash
test-results/
├── backups/                       # 历史测试结果备份
│   ├── 2024-01-15_10-30-00/      # 每次测试的备份
│   ├── 2024-01-15_09-15-00/
│   └── ...
├── 2024-01-15_11-00-00/          # 当前测试（最新）
│   └── ...
└── latest -> 2024-01-15_11-00-00 # 软链接到最新结果
```

保留策略：
- 自动保留最近 10 次测试备份
- 手动清理：`rm -rf test-results/backups/*`
- 查看备份：`ls -lt test-results/backups/`

#### Playwright测试配置规范

测试文件必须配置正确的输出：

```typescript
// test/example.test.ts
import { test, expect } from "@playwright/test";
import { mkdirSync, appendFileSync } from "node:fs";

const RESULTS_DIR = process.env.TEST_RESULTS_DIR || "test-results/latest";
mkdirSync(`${RESULTS_DIR}/browser`, { recursive: true });

const logFile = `${RESULTS_DIR}/browser/console.log`;

test.beforeEach(async ({ page }) => {
  // 捕获所有控制台输出
  page.on("console", (msg) => {
    const logEntry = `[${new Date().toISOString()}] [${msg.type()}] ${msg.text()}\n`;
    appendFileSync(logFile, logEntry);
  });
  
  // 捕获WebSocket消息
  page.on("websocket", (ws) => {
    ws.on("framereceived", (data) => {
      appendFileSync(`${RESULTS_DIR}/browser/ws-messages.json`, 
        JSON.stringify({ type: "received", data, time: Date.now() }) + "\n");
    });
  });
});

test("example test", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ 
    path: `${RESULTS_DIR}/screenshots/01-example.png`,
    fullPage: true 
  });
  expect(await page.title()).toBe("Expected Title");
});
```

#### 环境变量

测试脚本自动设置以下环境变量：

```bash
TEST_RESULTS_DIR=test-results/YYYY-MM-DD_HH-MM-SS
TEST_TIMESTAMP=YYYY-MM-DD_HH-MM-SS
TEST_LOG_LEVEL=debug|info|warn|error
TEST_BROWSER=chromium
TEST_PORT=3000+random
```

### 测试最佳实践

#### 编写新的测试文件

遵循以下模板确保输出规范：

```typescript
// test/my-feature.test.ts
import { test, expect } from "@playwright/test";
import { mkdirSync, appendFileSync, writeFileSync } from "node:fs";

// 使用环境变量或默认值
const RESULTS_DIR = process.env.TEST_RESULTS_DIR 
  || "/root/pi-gateway-standalone/test-results/latest";
const SCREENSHOTS_DIR = `${RESULTS_DIR}/screenshots`;
const LOG_DIR = `${RESULTS_DIR}/browser`;

// 确保目录存在
mkdirSync(SCREENSHOTS_DIR, { recursive: true });
mkdirSync(LOG_DIR, { recursive: true });

// 日志文件
const LOG_FILE = `${LOG_DIR}/my-feature.log`;

function log(level: string, message: string) {
  const entry = `[${new Date().toISOString()}] [${level}] ${message}\n`;
  console.log(entry.trim());
  appendFileSync(LOG_FILE, entry);
}

test.beforeEach(async ({ page }) => {
  // 捕获控制台日志
  page.on("console", (msg) => {
    appendFileSync(`${LOG_DIR}/console.log`, 
      `[${msg.type()}] ${msg.text()}\n`);
  });
});

test("my feature test", async ({ page }) => {
  log("INFO", "开始测试");
  
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  
  // 截图 - 使用编号命名
  await page.screenshot({ 
    path: `${SCREENSHOTS_DIR}/01-my-feature.png`,
    fullPage: true 
  });
  
  // 测试逻辑...
  
  log("INFO", "测试完成");
});
```

#### 测试命名规范

| 类型 | 命名示例 | 位置 |
|------|----------|------|
| 单元测试 | `*.test.ts` | `src/**/` 或 `test/unit/` |
| 集成测试 | `*.test.ts` | `test/integration/` |
| E2E测试 | `*.spec.ts` | `test/e2e/` |
| 终端测试 | `terminal-*.test.ts` | `test/` |

#### 截图命名规范

```
screenshots/
├── 01-page-loaded.png          # 按顺序编号
├── 02-terminal-opened.png
├── 03-command-executed.png
├── failed-invalid-state.png    # 失败状态截图
└── error-modal-displayed.png   # 错误情况截图
```

#### 测试数据隔离

- 每个测试使用独立的测试数据
- 测试后清理创建的资源
- 使用随机端口避免冲突
- 使用临时目录存放测试文件

## Debugging Tips

1. **Frontend Hot Reload**: Vite auto-reloads
2. **Backend Hot Reload**: tsx watch auto-restarts
3. **WebSocket Debugging**: Browser DevTools Network WS tab
4. **View Logs**: `tail -f logs/backend_current.log`
5. **View Test Results**: `cat test-results/latest/summary.md`

## Prohibited Practices

- ❌ Direct fetch in components (use services/)
- ❌ Use Math.random() as key
- ❌ Directly modify arrays/objects (return new objects)
- ❌ Write business logic in components (extract to Hook)
- ❌ Put runtime logic in shared/

## Need Help?

If the answer is not in the documentation:
1. Check existing code for similar functionality
2. Check stores/ for relevant state
3. Check services/ for relevant APIs
4. Ask user to confirm requirements
