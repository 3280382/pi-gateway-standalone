#!/bin/bash
# Development service control script for AI assistants
# Manages frontend/backend services within an existing tmux session.
# The tmux 3-pane session must be started by a human via: bash ./dev-start.sh

set -e

SESSION_NAME="gateway-dev"
GATEWAY_DIR="/root/pi-gateway-standalone"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$GATEWAY_DIR" || exit 1

# Check if tmux session exists
check_session() {
  if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${RED}Error: tmux session '$SESSION_NAME' not found.${NC}"
    echo -e "${YELLOW}The 3-pane development environment must be started by a human first:${NC}"
    echo "  bash ./dev-start.sh"
    exit 1
  fi
}

# Rotate log file
rotate_log() {
  local log_file="$1"
  if [ -f "$log_file" ]; then
    local ts
    ts=$(date +%Y%m%d_%H%M%S)
    mv "$log_file" "${log_file%.log}_${ts}.log" 2>/dev/null || true
  fi
}

# Restart frontend in tmux pane 0.0
restart_frontend() {
  check_session
  echo -e "${BLUE}Restarting frontend...${NC}"
  rotate_log "$GATEWAY_DIR/logs/frontend_current.log"
  tmux send-keys -t "$SESSION_NAME:0.0" C-c 2>/dev/null || true
  sleep 0.5
  tmux send-keys -t "$SESSION_NAME:0.0" "npm run dev:react 2>&1 | tee -a logs/frontend_current.log" C-m
  echo -e "${GREEN}Frontend restart command sent to tmux pane 0.0${NC}"
}

# Restart backend in tmux pane 0.1
restart_backend() {
  check_session
  echo -e "${BLUE}Restarting backend...${NC}"
  rotate_log "$GATEWAY_DIR/logs/backend_current.log"
  tmux send-keys -t "$SESSION_NAME:0.1" C-c 2>/dev/null || true
  sleep 0.5
  tmux send-keys -t "$SESSION_NAME:0.1" "npm run dev 2>&1 | tee -a logs/backend_current.log" C-m
  echo -e "${GREEN}Backend restart command sent to tmux pane 0.1${NC}"
}

# Check service status
show_status() {
  echo -e "${BLUE}=== Development Environment Status ===${NC}"
  echo ""

  # Tmux session
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "Tmux session: ${GREEN}running${NC} ($SESSION_NAME)"
  else
    echo -e "Tmux session: ${RED}not found${NC} ($SESSION_NAME)"
    echo -e "${YELLOW}Start it manually with: bash ./dev-start.sh${NC}"
    return
  fi

  # Frontend process
  if pgrep -f "vite" >/dev/null 2>&1; then
    echo -e "Frontend:     ${GREEN}running${NC} (vite)"
  else
    echo -e "Frontend:     ${RED}not running${NC}"
  fi

  # Backend process
  if pgrep -f "tsx watch.*server" >/dev/null 2>&1; then
    echo -e "Backend:      ${GREEN}running${NC} (tsx watch)"
  else
    echo -e "Backend:      ${RED}not running${NC}"
  fi

  # Port check
  echo ""
  echo -e "${BLUE}Port Status:${NC}"
  if timeout 2 curl -s http://127.0.0.1:5173 >/dev/null 2>&1; then
    echo -e "  5173 (frontend): ${GREEN}UP${NC}"
  else
    echo -e "  5173 (frontend): ${RED}DOWN${NC}"
  fi

  if timeout 2 curl -s http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
    echo -e "  3000 (backend):  ${GREEN}UP${NC}"
  else
    echo -e "  3000 (backend):  ${RED}DOWN${NC}"
  fi

  # Recent log activity
  echo ""
  echo -e "${BLUE}Recent Log Activity:${NC}"
  if [ -f "$GATEWAY_DIR/logs/frontend_current.log" ]; then
    local fsize
    fsize=$(stat -c%s "$GATEWAY_DIR/logs/frontend_current.log" 2>/dev/null || echo 0)
    local ftime
    ftime=$(stat -c%Y "$GATEWAY_DIR/logs/frontend_current.log" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local fage=$((now - ftime))
    echo -e "  frontend_current.log: ${fsize} bytes, last modified ${fage}s ago"
  else
    echo -e "  frontend_current.log: ${RED}not found${NC}"
  fi

  if [ -f "$GATEWAY_DIR/logs/backend_current.log" ]; then
    local bsize
    bsize=$(stat -c%s "$GATEWAY_DIR/logs/backend_current.log" 2>/dev/null || echo 0)
    local btime
    btime=$(stat -c%Y "$GATEWAY_DIR/logs/backend_current.log" 2>/dev/null || echo 0)
    local now
    now=$(date +%s)
    local bage=$((now - btime))
    echo -e "  backend_current.log:  ${bsize} bytes, last modified ${bage}s ago"
  else
    echo -e "  backend_current.log:  ${RED}not found${NC}"
  fi
}

# Show logs
show_logs() {
  local service="$1"
  local lines="${2:-50}"

  case "$service" in
    frontend|fe)
      if [ -f "$GATEWAY_DIR/logs/frontend_current.log" ]; then
        echo -e "${BLUE}=== Frontend Logs (last ${lines} lines) ===${NC}"
        tail -n "$lines" "$GATEWAY_DIR/logs/frontend_current.log"
      else
        echo -e "${RED}frontend_current.log not found${NC}"
      fi
      ;;
    backend|be)
      if [ -f "$GATEWAY_DIR/logs/backend_current.log" ]; then
        echo -e "${BLUE}=== Backend Logs (last ${lines} lines) ===${NC}"
        tail -n "$lines" "$GATEWAY_DIR/logs/backend_current.log"
      else
        echo -e "${RED}backend_current.log not found${NC}"
      fi
      ;;
    *)
      echo -e "${RED}Unknown service: $service${NC}"
      echo "Usage: $0 logs <frontend|backend> [lines]"
      exit 1
      ;;
  esac
}

# Help
show_help() {
  echo "Development Service Control (for AI assistants)"
  echo ""
  echo "The tmux 3-pane session must be started by a human first:"
  echo "  bash ./dev-start.sh"
  echo ""
  echo "Usage: $0 <command> [args]"
  echo ""
  echo "Commands:"
  echo "  restart-frontend, rf     Restart frontend service in tmux pane 0.0"
  echo "  restart-backend, rb      Restart backend service in tmux pane 0.1"
  echo "  status, s                Show tmux, process, and port status"
  echo "  logs <svc> [n], l <svc>  Show last n lines of logs (default 50)"
  echo "  help, h                  Show this help"
  echo ""
  echo "Examples:"
  echo "  $0 restart-frontend"
  echo "  $0 restart-backend"
  echo "  $0 status"
  echo "  $0 logs frontend 100"
  echo "  $0 l backend 20"
}

# Main
case "$1" in
  restart-frontend|rf)
    restart_frontend
    ;;
  restart-backend|rb)
    restart_backend
    ;;
  status|s)
    show_status
    ;;
  logs|l)
    if [ -z "$2" ]; then
      echo -e "${RED}Error: service required${NC}"
      show_help
      exit 1
    fi
    show_logs "$2" "$3"
    ;;
  help|h|--help|-h)
    show_help
    ;;
  *)
    show_help
    exit 1
    ;;
esac
