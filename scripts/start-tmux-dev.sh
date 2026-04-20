#!/bin/bash
# One-click start Tmux development environment
# User just runs this script, then can observe three windows

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
SESSION_NAME="gateway-dev"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd $GATEWAY_DIR

echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     Pi Gateway - Tmux Development Environment Launcher          ${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""

# Check tmux
if ! command -v tmux &> /dev/null; then
    echo -e "${YELLOW}Install tmux...${NC}"
    apt-get update && apt-get install -y tmux 2>/dev/null || brew install tmux 2>/dev/null || {
        echo "Please manually install tmux"
        exit 1
    }
fi

# Create session
echo -e "${BLUE}Creating tmux session...${NC}"
bash scripts/tmux-dev.sh create

# Start services
echo -e "${BLUE}Starting development services...${NC}"
bash scripts/tmux-dev.sh start

echo ""
echo -e "${GREEN}✅ Development environment started!${NC}"
echo ""
echo "Pane layout (top 1/3, bottom 2/3):"
echo -e "${BLUE}┌───────────────────────┬───────────────────────┐${NC}"
echo -e "${BLUE}│  ${GREEN}🎨 Frontend Pane (0)${BLUE}      │  ${GREEN}🖥️  Backend Pane (1)${BLUE}      │${NC}  Top 33%"
echo -e "${BLUE}│  http://127.0.0.1:5173│  http://127.0.0.1:3000│${NC}"
echo -e "${BLUE}├───────────────────────┴───────────────────────┤${NC}"
echo -e "${BLUE}│  ${YELLOW}🤖 AI Interaction Pane (2) - pi${BLUE}                    │${NC}  Bottom 66%"
echo -e "${BLUE}└───────────────────────────────────────────────┘${NC}"
echo ""
echo "Instructions:"
echo "  1. You are now in AI Interaction Pane（底部），Run着 pi"
echo "  2. Top left is Frontend service output"
echo "  3. Top right is Backend service output"
echo "  4. You can directly talk to AI in pi while observing top two windows"
echo ""
echo "Shortcuts:"
echo "  Ctrl+b + ↑     Go to Frontend Pane"
echo "  Ctrl+b + ↓     Go to AI (pi) pane"
echo "  Ctrl+b + ←     Go to Backend Pane"
echo "  Ctrl+b + →     Go to Backend Pane"
echo "  Ctrl+b + d     Detach session（服务Continue后台Run）"
echo ""
echo "🚪 Exit methods:"
echo "  Ctrl+b + d     Detach (recommended, service keeps running, can resume)"
echo "  Ctrl+c         Stop current pane's service"
echo "  exit           Exit current pane (pi/bash)"
echo "  Close terminal       Force close all"
echo ""
echo "Recover session:"
echo "  bash scripts/recover-session.sh  # recommended method"
echo "  or: tmux attach -t gateway-dev"
echo ""
echo "Kill session:"
echo "  tmux kill-session -t gateway-dev"
echo "  or force: pkill -f 'tmux.*gateway-dev'"
echo ""

# Attach to session
sleep 2
tmux attach-session -t $SESSION_NAME
