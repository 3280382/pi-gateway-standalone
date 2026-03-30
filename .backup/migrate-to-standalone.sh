#!/bin/bash
# Gateway 独立迁移脚本
# 用法: bash scripts/migrate-to-standalone.sh [目标目录]

set -e

SOURCE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET_DIR="${1:-$HOME/pi-gateway-standalone}"

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Pi Gateway - 独立项目迁移工具                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "源目录: $SOURCE_DIR"
echo "目标目录: $TARGET_DIR"
echo ""

# 确认
read -p "确认开始迁移? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "已取消"
    exit 1
fi

# 创建目标目录
mkdir -p "$TARGET_DIR"
cd "$TARGET_DIR"

echo ""
echo "📦 步骤 1: 复制项目文件..."
rsync -av --progress \
    --exclude='node_modules' \
    --exclude='dist' \
    --exclude='.git' \
    --exclude='*.log' \
    "$SOURCE_DIR/" ./

echo ""
echo "📝 步骤 2: 修改 package.json..."
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf8'));

// 修改包名
pkg.name = 'pi-gateway-standalone';

// 删除 monorepo 相关字段
const fieldsToRemove = ['composite', 'workspaces', 'publishConfig'];
fieldsToRemove.forEach(f => delete pkg[f]);

// 更新 scripts (去掉 monorepo 特定的)
if (pkg.scripts) {
    delete pkg.scripts['version:set'];
    delete pkg.scripts['publish'];
}

fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2));
console.log('✅ package.json 已更新');
"

echo ""
echo "🔧 步骤 3: 修改 tsconfig.json..."
node -e "
const fs = require('fs');
const ts = JSON.parse(fs.readFileSync('./tsconfig.json', 'utf8'));

// 删除 composite (独立项目不需要)
if (ts.compilerOptions) {
    delete ts.compilerOptions.composite;
    delete ts.compilerOptions.references;
}
delete ts.references;

fs.writeFileSync('./tsconfig.json', JSON.stringify(ts, null, 2));
console.log('✅ tsconfig.json 已更新');
"

echo ""
echo "📋 步骤 4: 创建 .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-store/

# Build output
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/extensions.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*

# Testing
coverage/

# Misc
*.local
EOF

echo ""
echo "📖 步骤 5: 创建独立项目说明..."
cat > STANDALONE.md << 'EOF'
# Pi Gateway - 独立版本

这是从 pi-mono monorepo 独立出来的 Gateway 项目。

## 与原 monorepo 的区别

- ✅ 依赖 `@mariozechner/*` 包通过 npm 安装
- ✅ 不再依赖 workspace 链接
- ✅ 独立的版本管理
- ✅ 独立的部署流程

## 安装依赖

```bash
npm install
```

## 开发启动

```bash
# Tmux 三窗格模式（推荐）
bash scripts/start-tmux-dev.sh

# 或分别启动
# 终端1: 后端
npx tsx watch src/server/server.ts

# 终端2: 前端
npx vite --host 127.0.0.1 --port 5173
```

## 更新 monorepo 包

如果需要更新 `@mariozechner/*` 包：

```bash
# 从 npm 更新
npm update @mariozechner/pi-coding-agent

# 或从本地 monorepo 链接（开发调试）
cd /path/to/pi-mono/packages/coding-agent
npm link
cd /path/to/this/project
npm link @mariozechner/pi-coding-agent
```

## 文档

- [DEVELOPMENT.md](./DEVELOPMENT.md) - 开发指南
- [FEATURES.md](./FEATURES.md) - 功能规格
EOF

echo ""
echo "✅ 迁移完成！"
echo ""
echo "下一步:"
echo "1. cd $TARGET_DIR"
echo "2. npm install"
echo "3. bash scripts/start-tmux-dev.sh"
echo ""
echo "如需链接本地 monorepo 包进行开发调试:"
echo "  npm link @mariozechner/pi-coding-agent"
echo "  npm link @mariozechner/pi-ai"
echo "  npm link @mariozechner/pi-agent-core"
echo ""
