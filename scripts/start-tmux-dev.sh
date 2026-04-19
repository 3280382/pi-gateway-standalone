#!/bin/bash
# 一键启动 Tmux 开发环境
# 用户只需运行此脚本，然后就可以观察三个窗口

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
SESSION_NAME="gateway-dev"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd $GATEWAY_DIR

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Pi Gateway - Tmux 开发环境启动器          ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# 检查 tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}安装 tmux...${NC}"
    apt-get update && apt-get install -y tmux 2>/dev/null || brew install tmux 2>/dev/null || {
        echo "请手动安装 tmux"
        exit 1
    }
fi

# Create session
echo -e "${BLUE}创建 tmux 会话...${NC}"
bash scripts/tmux-dev.sh create

# 启动服务
echo -e "${BLUE}启动开发服务...${NC}"
bash scripts/tmux-dev.sh start

echo ""
echo -e "${GREEN}✅ 开发环境已启动！${NC}"
echo ""
echo "Pane layout (top 1/3, bottom 2/3):"
echo -e "${BLUE}┌───────────────────────┬───────────────────────┐${NC}"
echo -e "${BLUE}│  ${GREEN}🎨 Frontend窗格 (0)${BLUE}      │  ${GREEN}🖥️  Backend窗格 (1)${BLUE}      │${NC}  上部33%"
echo -e "${BLUE}│  http://127.0.0.1:5173│  http://127.0.0.1:3000│${NC}"
echo -e "${BLUE}├───────────────────────┴───────────────────────┤${NC}"
echo -e "${BLUE}│  ${YELLOW}🤖 AI 交互窗格 (2) - pi${BLUE}                    │${NC}  底部66%"
echo -e "${BLUE}└───────────────────────────────────────────────┘${NC}"
echo ""
echo "操作说明:"
echo "  1. 你现在进入的是 AI 交互窗格（底部），运行着 pi"
echo "  2. 上方左侧是Frontend服务输出"
echo "  3. 上方右侧是Backend服务输出"
echo "  4. 你可以在 pi 中直接与 AI 对话，同时观察上方两个窗口"
echo ""
echo "快捷键:"
echo "  Ctrl+b + ↑     去Frontend窗格"
echo "  Ctrl+b + ↓     去 AI (pi) 窗格"
echo "  Ctrl+b + ←     去Backend窗格"
echo "  Ctrl+b + →     去Backend窗格"
echo "  Ctrl+b + d     Detach session（服务继续后台运行）"
echo ""
echo "🚪 退出方式:"
echo "  Ctrl+b + d     分离（推荐，服务保持运行，可恢复）"
echo "  Ctrl+c         停止当前窗格的服务"
echo "  exit           退出当前窗格（pi/bash）"
echo "  关闭终端       强制关闭所有"
echo ""
echo "Recover session:"
echo "  bash scripts/recover-session.sh  # 推荐方式"
echo "  或: tmux attach -t gateway-dev"
echo ""
echo "杀掉会话:"
echo "  tmux kill-session -t gateway-dev"
echo "  或强制: pkill -f 'tmux.*gateway-dev'"
echo ""

# 附加到会话
sleep 2
tmux attach-session -t $SESSION_NAME
