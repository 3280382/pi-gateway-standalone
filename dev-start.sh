#!/bin/bash
# Gateway 开发环境启动脚本
# 统一入口，支持两种模式：
#   ./dev-start.sh         启动 tmux 三窗格模式（推荐）
#   ./dev-start.sh simple  启动简单后台模式

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
MODE="${1:-tmux}"
SESSION_NAME="gateway-dev"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd $GATEWAY_DIR

# Helper: Get current timestamp
timestamp() {
  date +%Y%m%d_%H%M%S
}

# Helper: Rotate log file
rotate_log() {
  local log_file="$1"
  if [ -f "$log_file" ]; then
    mv "$log_file" "${log_file%.log}_$(timestamp).log" 2>/dev/null || true
  fi
}

# Create new tmux session with 3 panes
create_tmux_session() {
  echo -e "${BLUE}Creating tmux development session...${NC}"
  
  # Kill existing session
  tmux kill-session -t $SESSION_NAME 2>/dev/null || true
  
  cd $GATEWAY_DIR
  
  # Create session with 3 panes:
  # +-----------+-----------+
  # | Frontend  |  Backend  |
  # +-----------+-----------+
  # |      AI/Logs         |
  # +----------------------+
  tmux new-session -d -s $SESSION_NAME -n "dev"
  tmux split-window -v -p 50 -t $SESSION_NAME
  tmux split-window -h -p 50 -t $SESSION_NAME:0.0
  
  # Pane 0: Frontend (top-left)
  tmux send-keys -t $SESSION_NAME:0.0 "cd $GATEWAY_DIR && echo '=== Frontend ===' && bash" C-m
  
  # Pane 1: Backend (top-right)
  tmux send-keys -t $SESSION_NAME:0.1 "cd $GATEWAY_DIR && echo '=== Backend ===' && bash" C-m
  
  # Pane 2: AI/Logs (bottom)
  tmux send-keys -t $SESSION_NAME:0.2 "cd $GATEWAY_DIR && echo '=== AI/Logs ===' && pi 2>/dev/null || bash" C-m
  
  # Select bottom pane
  tmux select-pane -t $SESSION_NAME:0.2
  
  echo -e "${GREEN}Session created.${NC}"
}

# Start frontend in tmux
start_tmux_frontend() {
  echo -e "${BLUE}Starting frontend in tmux...${NC}"
  rotate_log "$GATEWAY_DIR/logs/frontend_current.log"
  tmux send-keys -t $SESSION_NAME:0.0 C-c 2>/dev/null || true
  sleep 0.5
  tmux send-keys -t $SESSION_NAME:0.0 "npm run dev:react 2>&1 | tee -a logs/frontend_current.log" C-m
  echo -e "${GREEN}Frontend started${NC}"
}

# Start backend in tmux
start_tmux_backend() {
  echo -e "${BLUE}Starting backend in tmux...${NC}"
  rotate_log "$GATEWAY_DIR/logs/backend_current.log"
  tmux send-keys -t $SESSION_NAME:0.1 C-c 2>/dev/null || true
  sleep 0.5
  tmux send-keys -t $SESSION_NAME:0.1 "npm run dev 2>&1 | tee -a logs/backend_current.log" C-m
  echo -e "${GREEN}Backend started${NC}"
}

# Attach to tmux session
attach_tmux() {
  tmux attach-session -t $SESSION_NAME 2>/dev/null || echo -e "${RED}Session not found${NC}"
}

# Kill tmux session
kill_tmux() {
  tmux kill-session -t $SESSION_NAME 2>/dev/null && echo -e "${GREEN}Session killed${NC}" || echo -e "${RED}No session${NC}"
}

# Tmux mode
tmux_mode() {
  create_tmux_session
  sleep 1
  start_tmux_frontend
  sleep 1
  start_tmux_backend
  echo ""
  echo -e "${GREEN}Services started. Attaching to tmux...${NC}"
  echo -e "${YELLOW}Tip: Press Ctrl+b d to detach, $0 attach to reattach${NC}"
  sleep 2
  attach_tmux
}

# Simple background mode
simple_mode() {
  echo "=== Stopping old services ==="
  pkill -9 -f "tsx src/server" 2>/dev/null || true
  pkill -9 -f "vite --host" 2>/dev/null || true
  sleep 1

  echo ""
  echo "=== Starting backend (port 3000) ==="
  npx tsx watch src/server/server.ts &
  BACKEND_PID=$!
  echo "Backend PID: $BACKEND_PID"

  sleep 4
  echo ""
  echo "=== Starting frontend (port 5173) ==="
  npx vite --host 127.0.0.1 --port 5173 &
  FRONTEND_PID=$!
  echo "Frontend PID: $FRONTEND_PID"

  echo ""
  echo "=== Waiting for services ==="
  sleep 5

  echo ""
  echo "╔══════════════════════════════════════════╗"
  echo "║     Gateway dev environment started      ║"
  echo "╠══════════════════════════════════════════╣"
  echo "║  Frontend: http://127.0.0.1:5173        ║"
  echo "║  Backend: http://127.0.0.1:3000         ║"
  echo "╠══════════════════════════════════════════╣"
  echo "║  Press Ctrl+C to stop                   ║"
  echo "╚══════════════════════════════════════════╝"
  echo ""

  trap "echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true; exit" INT
  wait
}

# Main command handling
case "$MODE" in
  tmux|t|"")
    tmux_mode
    ;;
    
  simple|s|bg)
    simple_mode
    ;;

  create)
    create_tmux_session
    ;;

  start)
    start_tmux_frontend
    sleep 1
    start_tmux_backend
    ;;

  attach)
    attach_tmux
    ;;

  kill)
    kill_tmux
    ;;

  *)
    echo "Gateway Development Environment"
    echo ""
    echo "Usage: $0 [mode|command]"
    echo ""
    echo "Modes:"
    echo "  tmux, t          Tmux 3-pane mode (default)"
    echo "  simple, s        Simple background mode"
    echo ""
    echo "Commands (for tmux mode):"
    echo "  create           Create tmux session only"
    echo "  start            Start frontend + backend in tmux"
    echo "  attach           Attach to tmux session"
    echo "  kill             Kill tmux session"
    echo ""
    echo "Examples:"
    echo "  $0               # Start tmux mode"
    echo "  $0 tmux          # Same as above"
    echo "  $0 simple        # Start simple background mode"
    echo "  $0 attach        # Attach to existing tmux session"
    ;;
esac
