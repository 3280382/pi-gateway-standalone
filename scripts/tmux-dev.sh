#!/bin/bash
# Tmux Development Environment Management Script
# Create three panes: Top-left (Frontend) | Top-right (Backend)
#              Bottom (AI Interaction/Logs)

SESSION_NAME="gateway-dev"
GATEWAY_DIR="/root/pi-gateway-standalone"

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}Error: tmux not installed${NC}"
    echo "Installation command: apt-get install tmux (Debian/Ubuntu) or brew install tmux (macOS)"
    exit 1
fi

# Function: Create new development session
create_session() {
    echo -e "${BLUE}Creating Gateway development session...${NC}"
    
    # If session exists, kill it first
    tmux kill-session -t $SESSION_NAME 2>/dev/null
    
    # Create new session, start in bottom pane
    cd $GATEWAY_DIR
    tmux new-session -d -s $SESSION_NAME -n "dev"
    
    # Split window - Top 33%, Bottom 66% layout
    # 1. Horizontal split, create bottom large area (66% height)
    tmux split-window -v -p 66 -t $SESSION_NAME
    
    # 2. Horizontal split top, create left/right panes (50% width)
    # Top only 33% height, split left/right
    tmux split-window -h -p 50 -t $SESSION_NAME:0.0
    
    # Pane layout:
    # +-----------+-----------+
    # |     0     |     1     |  <- Top 33% (Left/right 50% each)
    # |  Frontend     |   Backend    |
    # +-----------+-----------+
    # |                       |  <- Bottom 66% (Full width)
    # |      AI Interaction (pi)       |
    # +-----------------------+
    
    # Configure Frontend pane (0)
    tmux send-keys -t $SESSION_NAME:0.0 "cd $GATEWAY_DIR && echo '=== Frontend Service Pane ===' && echo 'Waiting for start command...' && bash" C-m
    
    # Configure Backend pane (1)
    tmux send-keys -t $SESSION_NAME:0.1 "cd $GATEWAY_DIR && echo '=== Backend Service Pane ===' && echo 'Waiting for start command...' && bash" C-m
    
    # Configure bottom pane (2) - AI Interaction (start pi)
    tmux send-keys -t $SESSION_NAME:0.2 "cd $GATEWAY_DIR && echo '╔════════════════════════════════╗' && echo '║  🤖 AI Interaction Pane (pi)            ║' && echo '╠════════════════════════════════╣' && echo '║  Talk with AI here                 ║' && echo '║  Top two panes show service output         ║' && echo '╠════════════════════════════════╣' && echo '║  Exit: Ctrl+d or type exit       ║' && echo '║  Detach: Ctrl+b d (Service continues running)  ║' && echo '╚════════════════════════════════╝' && echo '' && pi" C-m
    
    # Default activate bottom pane (AI interaction window)
    tmux select-pane -t $SESSION_NAME:0.2
    
    echo -e "${GREEN}✅ Tmux session created${NC}"
    echo ""
    echo "Pane layout (top 1/3, bottom 2/3):"
    echo -e "${BLUE}┌───────────┬───────────┐${NC}"
    echo -e "${BLUE}│  ${GREEN}Frontend${BLUE}     │  ${GREEN}Backend${BLUE}     │${NC}  (Top 33% × 50%)"
    echo -e "${BLUE}│  Pane 0   │  Pane 1   │${NC}"
    echo -e "${BLUE}├───────────┴───────────┤${NC}"
    echo -e "${BLUE}│      ${YELLOW}AI 交互(pi)${BLUE}      │${NC}  (Bottom 66% × 100%)"
    echo -e "${BLUE}│        Pane 2         │${NC}"
    echo -e "${BLUE}└───────────────────────┘${NC}"
    echo ""
}

# Function: Start Frontend
start_frontend() {
    echo -e "${BLUE}Starting service in Frontend pane...${NC}"
    tmux send-keys -t $SESSION_NAME:0.0 C-c
    sleep 0.5
    # Create simple log filename
    local frontend_log="$GATEWAY_DIR/logs/frontend_current.log"
    mkdir -p "$GATEWAY_DIR/logs"
    # Rename old log files
    if [ -f "$frontend_log" ]; then
        local old_timestamp=$(date -r "$frontend_log" +%Y%m%d_%H%M%S 2>/dev/null || date +%Y%m%d_%H%M%S)
        mv "$frontend_log" "$GATEWAY_DIR/logs/frontend_${old_timestamp}.log" 2>/dev/null || true
    fi
    tmux send-keys -t $SESSION_NAME:0.0 "cd $GATEWAY_DIR && echo 'Frontend log: $frontend_log' && npx vite --host 127.0.0.1 --port 5173 2>&1 | tee -a '$frontend_log'" C-m
    echo -e "${GREEN}✅ Frontend start command sent (Current log: frontend_current.log)${NC}"
}

# Function: Start Backend
start_backend() {
    echo -e "${BLUE}Starting service in Backend pane...${NC}"
    tmux send-keys -t $SESSION_NAME:0.1 C-c
    sleep 0.5
    # Create simple log filename
    local backend_log="$GATEWAY_DIR/logs/backend_current.log"
    mkdir -p "$GATEWAY_DIR/logs"
    # Rename old log files
    if [ -f "$backend_log" ]; then
        local old_timestamp=$(date -r "$backend_log" +%Y%m%d_%H%M%S 2>/dev/null || date +%Y%m%d_%H%M%S)
        mv "$backend_log" "$GATEWAY_DIR/logs/backend_${old_timestamp}.log" 2>/dev/null || true
    fi
    tmux send-keys -t $SESSION_NAME:0.1 "cd $GATEWAY_DIR && echo 'Backend log: $backend_log' && npx tsx watch src/server/server.ts 2>&1 | tee -a '$backend_log'" C-m
    echo -e "${GREEN}✅ Backend start command sent (Current log: backend_current.log)${NC}"
}

# Function: Stop Frontend
stop_frontend() {
    echo -e "${YELLOW}Stopping Frontend service...${NC}"
    tmux send-keys -t $SESSION_NAME:0.0 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.0 "echo 'Frontend stopped'" C-m
}

# Function: Stop Backend
stop_backend() {
    echo -e "${YELLOW}Stopping Backend service...${NC}"
    tmux send-keys -t $SESSION_NAME:0.1 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.1 "echo 'Backend stopped'" C-m
}

# Function: Restart Frontend
restart_frontend() {
    echo -e "${YELLOW}Restarting Frontend...${NC}"
    stop_frontend
    sleep 1
    start_frontend
}

# Function: Restart Backend
restart_backend() {
    echo -e "${YELLOW}Restarting Backend...${NC}"
    stop_backend
    sleep 1
    start_backend
}

# Function:清除 Vite 缓存
clear_cache() {
    echo -e "${YELLOW}清除 Vite 缓存...${NC}"
    tmux send-keys -t $SESSION_NAME:0.2 "cd $GATEWAY_DIR && rm -rf node_modules/.vite && echo 'Vite 缓存已清除'" C-m
}

# Function:Check状态
status() {
    echo -e "${BLUE}Checking service status...${NC}"
    
    # Frontend状态
    FRONTEND_PID=$(pgrep -f "vite --host 127.0.0.1" | head -1)
    if [ -n "$FRONTEND_PID" ]; then
        echo -e "${GREEN}Frontend: Running (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}Frontend: Not running${NC}"
    fi
    
    # Backend状态
    BACKEND_PID=$(pgrep -f "tsx watch src/server/server.ts" | head -1)
    if [ -n "$BACKEND_PID" ]; then
        echo -e "${GREEN}Backend: Running (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}Backend: Not running${NC}"
    fi
}

# Function:在 AI 窗格ExecuteCommand
run_in_ai_pane() {
    local cmd="$1"
    tmux send-keys -t $SESSION_NAME:0.2 "$cmd" C-m
}

# Function:附加到会话
attach() {
    tmux attach-session -t $SESSION_NAME
}

# Function:杀掉会话
kill_session() {
    echo -e "${YELLOW}杀掉 tmux 会话...${NC}"
    tmux kill-session -t $SESSION_NAME 2>/dev/null
    echo -e "${GREEN}✅ 会话已终止${NC}"
}

# 主Command处理
case "${1:-}" in
    create)
        create_session
        ;;
    start)
        start_frontend
        sleep 2
        start_backend
        ;;
    start-frontend)
        start_frontend
        ;;
    start-backend)
        start_backend
        ;;
    stop)
        stop_frontend
        stop_backend
        ;;
    stop-frontend)
        stop_frontend
        ;;
    stop-backend)
        stop_backend
        ;;
    restart)
        restart_frontend
        sleep 1
        restart_backend
        ;;
    restart-frontend)
        restart_frontend
        ;;
    restart-backend)
        restart_backend
        ;;
    clear-cache)
        clear_cache
        ;;
    status)
        status
        ;;
    attach)
        attach
        ;;
    kill)
        kill_session
        ;;
    run)
        # 在 AI 窗格RunCommand
        shift
        run_in_ai_pane "$@"
        ;;
    *)
        echo "Gateway Tmux Development Environment管理"
        echo ""
        echo "Usage: $0 <command>"
        echo ""
        echo "会话管理:"
        echo "  create              Create新的 tmux 会话"
        echo "  attach              附加到现有会话（用户观察用）"
        echo "  kill                杀掉会话"
        echo ""
        echo "服务控制:"
        echo "  start               启动Frontend和Backend"
        echo "  start-frontend      仅启动Frontend"
        echo "  start-backend       仅启动Backend"
        echo "  stop                StopFrontend和Backend"
        echo "  restart             Restarting Frontend...ckend"
        echo "  restart-frontend    仅RestartFrontend"
        echo "  restart-backend     仅RestartBackend"
        echo ""
        echo "其他:"
        echo "  clear-cache         清除 Vite 缓存"
        echo "  status              Check service status"
        echo "  run <command>       在 AI 窗格ExecuteCommand"
        echo ""
        echo "Example:"
        echo "  $0 create           # Create session"
        echo "  $0 start            # 启动所有服务"
        echo "  $0 attach           # 进入观察模式"
        echo ""
        ;;
esac
