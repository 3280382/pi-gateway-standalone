#!/bin/bash
# Tmux 开发环境管理脚本
# 创建三个窗格：左上(前端) | 右上(后端)
#              底部(AI交互/日志)

SESSION_NAME="gateway-dev"
GATEWAY_DIR="/root/pi-mono/packages/gateway"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查 tmux 是否安装
if ! command -v tmux &> /dev/null; then
    echo -e "${RED}错误: tmux 未安装${NC}"
    echo "安装命令: apt-get install tmux (Debian/Ubuntu) 或 brew install tmux (macOS)"
    exit 1
fi

# 函数：创建新的开发会话
create_session() {
    echo -e "${BLUE}创建 Gateway 开发会话...${NC}"
    
    # 如果会话已存在，先杀掉
    tmux kill-session -t $SESSION_NAME 2>/dev/null
    
    # 创建新会话，在底部窗格启动
    cd $GATEWAY_DIR
    tmux new-session -d -s $SESSION_NAME -n "dev"
    
    # 分割窗口 - 顶部33%、底部66%布局
    # 1. 水平分割，创建底部大区域（占66%高度）
    tmux split-window -v -p 66 -t $SESSION_NAME
    
    # 2. 在顶部水平分割，创建左右两个窗格（各占50%宽度）
    # 顶部只占33%高度，左右对半
    tmux split-window -h -p 50 -t $SESSION_NAME:0.0
    
    # 窗格布局：
    # +-----------+-----------+
    # |     0     |     1     |  <- 上部 33% (左右各50%)
    # |  前端     |   后端    |
    # +-----------+-----------+
    # |                       |  <- 底部 66% (宽度占满)
    # |      AI交互(pi)       |
    # +-----------------------+
    
    # 配置前端窗格 (0)
    tmux send-keys -t $SESSION_NAME:0.0 "cd $GATEWAY_DIR && echo '=== 前端服务窗格 ===' && echo '等待启动指令...' && bash" C-m
    
    # 配置后端窗格 (1)
    tmux send-keys -t $SESSION_NAME:0.1 "cd $GATEWAY_DIR && echo '=== 后端服务窗格 ===' && echo '等待启动指令...' && bash" C-m
    
    # 配置底部窗格 (2) - AI交互（启动 pi）
    tmux send-keys -t $SESSION_NAME:0.2 "cd $GATEWAY_DIR && echo '╔════════════════════════════════╗' && echo '║  🤖 AI 交互窗格 (pi)            ║' && echo '╠════════════════════════════════╣' && echo '║  在此与 AI 对话                 ║' && echo '║  上方两窗格显示服务输出         ║' && echo '╠════════════════════════════════╣' && echo '║  退出: Ctrl+d 或输入 exit       ║' && echo '║  分离: Ctrl+b d (服务继续运行)  ║' && echo '╚════════════════════════════════╝' && echo '' && pi" C-m
    
    # 默认激活底部窗格（AI交互窗口）
    tmux select-pane -t $SESSION_NAME:0.2
    
    echo -e "${GREEN}✅ Tmux 会话已创建${NC}"
    echo ""
    echo "窗格布局（上1/3、下2/3）:"
    echo -e "${BLUE}┌───────────┬───────────┐${NC}"
    echo -e "${BLUE}│  ${GREEN}前端${BLUE}     │  ${GREEN}后端${BLUE}     │${NC}  (上部 33% × 50%)"
    echo -e "${BLUE}│  窗格 0   │  窗格 1   │${NC}"
    echo -e "${BLUE}├───────────┴───────────┤${NC}"
    echo -e "${BLUE}│      ${YELLOW}AI 交互(pi)${BLUE}      │${NC}  (底部 66% × 100%)"
    echo -e "${BLUE}│        窗格 2         │${NC}"
    echo -e "${BLUE}└───────────────────────┘${NC}"
    echo ""
}

# 函数：启动前端
start_frontend() {
    echo -e "${BLUE}在前端窗格启动服务...${NC}"
    tmux send-keys -t $SESSION_NAME:0.0 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.0 "cd $GATEWAY_DIR && npx vite --host 127.0.0.1 --port 5173" C-m
    echo -e "${GREEN}✅ 前端启动命令已发送${NC}"
}

# 函数：启动后端
start_backend() {
    echo -e "${BLUE}在后端窗格启动服务...${NC}"
    tmux send-keys -t $SESSION_NAME:0.1 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.1 "cd $GATEWAY_DIR && npx tsx watch src/server/server.ts" C-m
    echo -e "${GREEN}✅ 后端启动命令已发送${NC}"
}

# 函数：停止前端
stop_frontend() {
    echo -e "${YELLOW}停止前端服务...${NC}"
    tmux send-keys -t $SESSION_NAME:0.0 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.0 "echo '前端已停止'" C-m
}

# 函数：停止后端
stop_backend() {
    echo -e "${YELLOW}停止后端服务...${NC}"
    tmux send-keys -t $SESSION_NAME:0.1 C-c
    sleep 0.5
    tmux send-keys -t $SESSION_NAME:0.1 "echo '后端已停止'" C-m
}

# 函数：重启前端
restart_frontend() {
    echo -e "${YELLOW}重启前端...${NC}"
    stop_frontend
    sleep 1
    start_frontend
}

# 函数：重启后端
restart_backend() {
    echo -e "${YELLOW}重启后端...${NC}"
    stop_backend
    sleep 1
    start_backend
}

# 函数：清除 Vite 缓存
clear_cache() {
    echo -e "${YELLOW}清除 Vite 缓存...${NC}"
    tmux send-keys -t $SESSION_NAME:0.2 "cd $GATEWAY_DIR && rm -rf node_modules/.vite && echo 'Vite 缓存已清除'" C-m
}

# 函数：检查状态
status() {
    echo -e "${BLUE}检查服务状态...${NC}"
    
    # 前端状态
    FRONTEND_PID=$(pgrep -f "vite --host 127.0.0.1" | head -1)
    if [ -n "$FRONTEND_PID" ]; then
        echo -e "${GREEN}前端: 运行中 (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${RED}前端: 未运行${NC}"
    fi
    
    # 后端状态
    BACKEND_PID=$(pgrep -f "tsx watch src/server/server.ts" | head -1)
    if [ -n "$BACKEND_PID" ]; then
        echo -e "${GREEN}后端: 运行中 (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${RED}后端: 未运行${NC}"
    fi
}

# 函数：在 AI 窗格执行命令
run_in_ai_pane() {
    local cmd="$1"
    tmux send-keys -t $SESSION_NAME:0.2 "$cmd" C-m
}

# 函数：附加到会话
attach() {
    tmux attach-session -t $SESSION_NAME
}

# 函数：杀掉会话
kill_session() {
    echo -e "${YELLOW}杀掉 tmux 会话...${NC}"
    tmux kill-session -t $SESSION_NAME 2>/dev/null
    echo -e "${GREEN}✅ 会话已终止${NC}"
}

# 主命令处理
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
        # 在 AI 窗格运行命令
        shift
        run_in_ai_pane "$@"
        ;;
    *)
        echo "Gateway Tmux 开发环境管理"
        echo ""
        echo "用法: $0 <command>"
        echo ""
        echo "会话管理:"
        echo "  create              创建新的 tmux 会话"
        echo "  attach              附加到现有会话（用户观察用）"
        echo "  kill                杀掉会话"
        echo ""
        echo "服务控制:"
        echo "  start               启动前端和后端"
        echo "  start-frontend      仅启动前端"
        echo "  start-backend       仅启动后端"
        echo "  stop                停止前端和后端"
        echo "  restart             重启前端和后端"
        echo "  restart-frontend    仅重启前端"
        echo "  restart-backend     仅重启后端"
        echo ""
        echo "其他:"
        echo "  clear-cache         清除 Vite 缓存"
        echo "  status              检查服务状态"
        echo "  run <command>       在 AI 窗格执行命令"
        echo ""
        echo "示例:"
        echo "  $0 create           # 创建会话"
        echo "  $0 start            # 启动所有服务"
        echo "  $0 attach           # 进入观察模式"
        echo ""
        ;;
esac
