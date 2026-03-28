#!/bin/bash
# Gateway 开发环境启动脚本
# 统一入口，支持两种模式：
#   ./dev-start.sh         启动 tmux 三窗格模式（推荐）
#   ./dev-start.sh simple  启动简单后台模式

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
MODE="${1:-tmux}"

cd $GATEWAY_DIR

case "$MODE" in
  tmux|t|*)
    # Tmux 三窗格模式（默认）
    echo "启动 Tmux 三窗格开发环境..."
    bash scripts/start-tmux-dev.sh
    ;;
    
  simple|s|bg|background)
    # 简单后台模式（旧方式）
    echo "=== 停止旧服务 ==="
    pkill -9 -f "tsx src/server" 2>/dev/null || true
    pkill -9 -f "vite --host" 2>/dev/null || true
    sleep 1

    echo ""
    echo "=== 启动后端 (端口3000) - 热重载模式 ==="
    npx tsx watch src/server/server.ts &
    BACKEND_PID=$!
    echo "后端 PID: $BACKEND_PID"

    sleep 4
    echo ""
    echo "=== 启动前端 (端口5173) ==="
    npx vite --host 127.0.0.1 --port 5173 &
    FRONTEND_PID=$!
    echo "前端 PID: $FRONTEND_PID"

    echo ""
    echo "=== 等待服务就绪 ==="
    sleep 5

    echo ""
    echo "╔══════════════════════════════════════════╗"
    echo "║     Gateway 开发环境已启动 (后台模式)    ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║  前端: http://127.0.0.1:5173            ║"
    echo "║  后端: http://127.0.0.1:3000            ║"
    echo "╠══════════════════════════════════════════╣"
    echo "║  按 Ctrl+C 停止服务                     ║"
    echo "╚══════════════════════════════════════════════════╝"
    echo ""
    echo "提示: 使用 tmux 模式获得更好的体验: ./dev-start.sh tmux"
    echo ""

    # 等待用户按Ctrl+C
    trap "echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" INT
    wait
    ;;
esac
