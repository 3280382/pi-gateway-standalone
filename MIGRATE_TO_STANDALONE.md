# Gateway 独立迁移指南

## 现状分析

✅ **已经准备好的部分**:
- `package.json` 依赖已经是 npm 包 (`@mariozechner/pi-ai` 等)，不是 workspace 引用
- `tsconfig.json` 和 `vite.config.ts` 都是内部路径映射，没有 monorepo 特殊配置
- 代码中没有直接引用 `../../packages/` 的外部路径

## 迁移步骤

### 1. 复制项目到新目录

```bash
# 在你的机器上执行
mkdir -p ~/projects/pi-gateway-standalone
cd ~/projects/pi-gateway-standalone

# 复制 gateway 目录（排除 node_modules）
rsync -av --exclude='node_modules' --exclude='dist' \
  /path/to/pi-mono/packages/gateway/ ./
```

### 2. 修改 package.json

删除 monorepo 相关字段：

```json
{
  "name": "pi-gateway-standalone",  // 改名
  "version": "0.57.1",
  "type": "module",
  // 删除: "composite": true (如果在 tsconfig 里)
  // 不需要改 dependencies，已经是 npm 包
}
```

### 3. 确认全局安装的包

确保你已全局安装或可用：

```bash
# 检查全局安装
npm list -g @mariozechner/pi-coding-agent
npm list -g @mariozechner/pi-ai
npm list -g @mariozechner/pi-agent-core

# 如果没有，从 monorepo 安装或 npm 安装
npm install -g @mariozechner/pi-coding-agent
npm install -g @mariozechner/pi-ai
npm install -g @mariozechner/pi-agent-core
```

### 4. 修改 tsconfig.json（可选）

删除 `composite: true`（如果是独立项目不需要）：

```json
{
  "compilerOptions": {
    // ... 其他配置
    // 删除这行: "composite": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/client/*"],
      "@shared/*": ["src/shared/*"],
      "@server/*": ["src/server/*"]
    }
  }
}
```

### 5. 安装依赖

```bash
npm install
```

### 6. 启动测试

```bash
# 启动后端
npx tsx watch src/server/server.ts

# 另一个终端启动前端
npx vite --host 127.0.0.1 --port 5173

# 或使用 tmux 模式
bash scripts/start-tmux-dev.sh
```

## 依赖包版本对照

当前 gateway 依赖的 monorepo 包版本：

| 包名 | 版本 | 用途 |
|------|------|------|
| @mariozechner/pi-ai | ^0.57.1 | AI 模型调用 |
| @mariozechner/pi-agent-core | ^0.57.1 | Agent 核心 |
| @mariozechner/pi-coding-agent | ^0.57.1 | Coding Agent SDK |

**方案 A: 使用 npm 发布的包（推荐）**
```bash
npm install @mariozechner/pi-coding-agent@latest
```

**方案 B: 使用本地 monorepo 构建的包**
```bash
# 在 monorepo 中构建
cd /path/to/pi-mono/packages/coding-agent
npm run build
npm pack  # 生成 .tgz

# 在 standalone 项目安装
cd ~/projects/pi-gateway-standalone
npm install /path/to/pi-mono/packages/coding-agent/*.tgz
```

**方案 C: 使用 npm link（开发调试）**
```bash
# 在 monorepo 包目录
cd /path/to/pi-mono/packages/coding-agent
npm link

# 在 standalone 项目
cd ~/projects/pi-gateway-standalone
npm link @mariozechner/pi-coding-agent
```

## 文件清单

需要复制的文件：
```
gateway/
├── src/                    # 全部源代码
├── scripts/                # 启动脚本
├── public/                 # 静态资源
├── test/                   # 测试文件
├── index.html              # Vite 入口
├── package.json            # 修改后
├── tsconfig.json           # 修改后
├── tsconfig.react.json     # 保持不变
├── vite.config.ts          # 保持不变
├── vitest.config.ts        # 保持不变
├── biome.json              # 保持不变
├── DEVELOPMENT.md          # 文档
├── FEATURES.md             # 文档
└── README.md               # 文档
```

## 验证清单

迁移后检查：

- [ ] `npm install` 成功
- [ ] `npx tsx src/server/server.ts` 后端启动
- [ ] `curl http://127.0.0.1:3000/api/version` 返回版本信息
- [ ] `npx vite` 前端编译
- [ ] 浏览器访问 http://127.0.0.1:5173 正常
- [ ] AI 对话功能正常

## 注意事项

1. **版本锁定**: 独立后需要自行管理依赖版本
2. **更新策略**: monorepo 更新后，需要手动更新 standalone 的依赖
3. **调试**: 如果需要调试 pi-coding-agent 源码，使用 `npm link`
4. **环境变量**: 确保 `.env` 或环境变量配置正确

## 快速迁移脚本

```bash
#!/bin/bash
# migrate-to-standalone.sh

SOURCE="/path/to/pi-mono/packages/gateway"
TARGET="$HOME/projects/pi-gateway-standalone"

mkdir -p $TARGET
cd $TARGET

# 复制文件
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' \
  $SOURCE/ ./

# 修改 package.json (删除 monorepo 字段)
node -e "
const pkg = require('./package.json');
delete pkg.composite;
pkg.name = 'pi-gateway-standalone';
require('fs').writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
"

# 修改 tsconfig.json
node -e "
const ts = require('./tsconfig.json');
delete ts.compilerOptions.composite;
require('fs').writeFileSync('./tsconfig.json', JSON.stringify(ts, null, 2));
"

# 安装依赖
npm install

echo "✅ 迁移完成！"
echo "启动命令: bash scripts/start-tmux-dev.sh"
```

## 总结

| 方面 | 状态 | 说明 |
|------|------|------|
| 代码依赖 | ✅ 无需修改 | 已经是 npm 包引用 |
| 配置文件 | ⚠️ 小修改 | 删除 composite 等 monorepo 字段 |
| 路径别名 | ✅ 无需修改 | 内部路径映射不受影响 |
| 构建流程 | ✅ 无需修改 | 使用 vite 和 tsx |

**结论**: Gateway 已经是高度独立的包，迁移成本极低！
