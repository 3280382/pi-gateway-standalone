#!/bin/bash
# Development Service Manager
# Manages frontend and backend services for development and testing.
# No tmux required - runs as background processes.
#
# Usage:
#   bash scripts/dev.sh start          Start backend + frontend
#   bash scripts/dev.sh stop           Stop all services
#   bash scripts/dev.sh restart        Restart all services
#   bash scripts/dev.sh restart-backend   Restart backend only
#   bash scripts/dev.sh restart-frontend  Restart frontend only
#   bash scripts/dev.sh status         Check service status
#   bash scripts/dev.sh health         Health check (return 0 if healthy)
#   bash scripts/dev.sh logs backend [n]  Show backend logs
#   bash scripts/dev.sh logs frontend [n] Show frontend logs

set -e

GATEWAY_DIR="/root/pi-gateway-standalone"
BACKEND_PID_FILE="$GATEWAY_DIR/logs/dev/backend.pid"
FRONTEND_PID_FILE="$GATEWAY_DIR/logs/dev/frontend.pid"
BACKEND_LOG="$GATEWAY_DIR/logs/dev/backend_current.log"
FRONTEND_LOG="$GATEWAY_DIR/logs/dev/frontend_current.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

cd "$GATEWAY_DIR" || exit 1
mkdir -p logs/dev

# ========== Helpers ==========

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERR]${NC} $1"; }

timestamp() { date +%Y%m%d_%H%M%S; }

rotate_log() {
  local f="$1"
  if [ -f "$f" ]; then
    mv "$f" "${f%.log}_$(timestamp).log" 2>/dev/null || true
  fi
}

is_port_open() {
  local port="$1"
  timeout 1 bash -c "exec 3<>/dev/tcp/127.0.0.1/$port" 2>/dev/null
}

# ========== Process Management ==========

get_pid() {
  local f="$1"
  if [ -f "$f" ]; then
    cat "$f" 2>/dev/null || echo ""
  fi
}

is_process_alive() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null
}

# Kill entire process tree starting from a PID
kill_tree() {
  local pid="$1"
  [ -z "$pid" ] && return
  # Get all children recursively
  local children
  children=$(pgrep -P "$pid" 2>/dev/null || true)
  for child in $children; do
    kill_tree "$child"
  done
  kill -9 "$pid" 2>/dev/null || true
}

stop_service() {
  local name="$1"
  local pid_file="$2"
  local pid
  pid=$(get_pid "$pid_file")

  # Step 1: Kill entire process tree from PID file
  if [ -n "$pid" ] && is_process_alive "$pid"; then
    log_info "Stopping $name process tree (PID $pid)..."
    kill_tree "$pid"
    sleep 0.5
  fi

  # Step 2: Kill all matching DEV processes by pattern (including orphans)
  # IMPORTANT: Do NOT kill production server (node dist/server/server.js on port 3300)
  case "$name" in
    backend)
      # Only kill dev-mode processes (tsx watch / tsx loader), NOT production (node dist/server/server.js)
      pkill -9 -f "tsx watch.*server.ts" 2>/dev/null || true
      pkill -9 -f "loader.mjs src/server/server.ts" 2>/dev/null || true
      # Kill any npm dev processes
      pkill -9 -f "npm run dev$" 2>/dev/null || true
      # Free DEV port only (3000), NOT production port (3300)
      fuser -k 3000/tcp 2>/dev/null || true
      ;;
    frontend)
      pkill -9 -f "vite.*--port 5173" 2>/dev/null || true
      pkill -9 -f "npm run dev:react" 2>/dev/null || true
      fuser -k 5173/tcp 2>/dev/null || true
      ;;
  esac

  rm -f "$pid_file"
  log_success "$name stopped"
}

start_backend() {
  log_info "Starting backend (port 3000)..."
  rotate_log "$BACKEND_LOG"

  nohup npm run dev > "$BACKEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$BACKEND_PID_FILE"

  # Wait for port to open
  local count=0
  while ! is_port_open 3000 && [ $count -lt 30 ]; do
    sleep 0.5
    count=$((count + 1))
  done

  if is_port_open 3000; then
    log_success "Backend started (PID $pid)"
  else
    log_warn "Backend may not be ready yet (PID $pid)"
  fi
}

start_frontend() {
  log_info "Starting frontend (port 5173)..."
  rotate_log "$FRONTEND_LOG"

  nohup npm run dev:react > "$FRONTEND_LOG" 2>&1 &
  local pid=$!
  echo "$pid" > "$FRONTEND_PID_FILE"

  # Wait for port to open
  local count=0
  while ! is_port_open 5173 && [ $count -lt 30 ]; do
    sleep 0.5
    count=$((count + 1))
  done

  if is_port_open 5173; then
    log_success "Frontend started (PID $pid)"
  else
    log_warn "Frontend may not be ready yet (PID $pid)"
  fi
}

# ========== Commands ==========

cmd_start() {
  if is_port_open 3000 && is_port_open 5173; then
    log_warn "Services already running"
    cmd_status
    return 0
  fi

  log_info "Starting development services..."

  # Always clean up before starting to prevent orphan processes
  if ! is_port_open 3000; then
    stop_service "backend" "$BACKEND_PID_FILE"
    start_backend
    sleep 1
  fi

  if ! is_port_open 5173; then
    stop_service "frontend" "$FRONTEND_PID_FILE"
    start_frontend
  fi

  echo ""
  log_success "Development environment started"
  echo "  Backend:  http://127.0.0.1:3000"
  echo "  Frontend: http://127.0.0.1:5173"
}

cmd_stop() {
  log_info "Stopping all services..."
  stop_service "backend" "$BACKEND_PID_FILE"
  stop_service "frontend" "$FRONTEND_PID_FILE"
  log_success "All services stopped"
}

cmd_restart() {
  log_info "Restarting all services..."
  cmd_stop
  sleep 1
  cmd_start
}

cmd_restart_backend() {
  log_info "Restarting backend..."
  stop_service "backend" "$BACKEND_PID_FILE"
  sleep 0.5
  start_backend
}

cmd_restart_frontend() {
  log_info "Restarting frontend..."
  stop_service "frontend" "$FRONTEND_PID_FILE"
  sleep 0.5
  start_frontend
}

cmd_status() {
  echo -e "${BLUE}=== Service Status ===${NC}"

  local be_pid=$(get_pid "$BACKEND_PID_FILE")
  local fe_pid=$(get_pid "$FRONTEND_PID_FILE")

  if is_port_open 3000; then
    echo -e "Backend (3000):  ${GREEN}UP${NC} (PID: ${be_pid:-?})"
  else
    echo -e "Backend (3000):  ${RED}DOWN${NC}"
  fi

  if is_port_open 5173; then
    echo -e "Frontend (5173): ${GREEN}UP${NC} (PID: ${fe_pid:-?})"
  else
    echo -e "Frontend (5173): ${RED}DOWN${NC}"
  fi

  # Log activity
  echo ""
  if [ -f "$BACKEND_LOG" ]; then
    local bsize=$(stat -c%s "$BACKEND_LOG" 2>/dev/null || echo 0)
    echo "Backend log:  $bsize bytes"
  fi
  if [ -f "$FRONTEND_LOG" ]; then
    local fsize=$(stat -c%s "$FRONTEND_LOG" 2>/dev/null || echo 0)
    echo "Frontend log: $fsize bytes"
  fi
}

cmd_health() {
  local healthy=0
  is_port_open 3000 && healthy=$((healthy + 1))
  is_port_open 5173 && healthy=$((healthy + 1))

  if [ "$healthy" -eq 2 ]; then
    echo "healthy"
    exit 0
  else
    echo "unhealthy ($healthy/2 services up)"
    exit 1
  fi
}

cmd_logs() {
  local svc="${1:-backend}"
  local lines="${2:-50}"

  case "$svc" in
    backend|be)
      if [ -f "$BACKEND_LOG" ]; then
        tail -n "$lines" "$BACKEND_LOG"
      else
        log_warn "Backend log not found"
      fi
      ;;
    frontend|fe)
      if [ -f "$FRONTEND_LOG" ]; then
        tail -n "$lines" "$FRONTEND_LOG"
      else
        log_warn "Frontend log not found"
      fi
      ;;
    *)
      log_error "Unknown service: $svc"
      echo "Usage: $0 logs <backend|frontend> [lines]"
      exit 1
      ;;
  esac
}

cmd_help() {
  echo "Development Service Manager"
  echo ""
  echo "Usage: bash scripts/dev.sh <command> [args]"
  echo ""
  echo "Commands:"
  echo "  start                  Start backend + frontend"
  echo "  stop                   Stop all services"
  echo "  restart                Restart all services"
  echo "  restart-backend        Restart backend only"
  echo "  restart-frontend       Restart frontend only"
  echo "  status                 Show service status"
  echo "  health                 Health check (exit 0 if healthy)"
  echo "  logs <svc> [n]         Show last n lines of logs (default 50)"
  echo "  help                   Show this help"
  echo ""
  echo "Examples:"
  echo "  bash scripts/dev.sh start"
  echo "  bash scripts/dev.sh status"
  echo "  bash scripts/dev.sh logs backend 100"
  echo "  bash scripts/dev.sh restart-backend"
}

# ========== Main ==========

case "${1:-help}" in
  start)        cmd_start ;;
  stop)         cmd_stop ;;
  restart)      cmd_restart ;;
  restart-backend|rb)  cmd_restart_backend ;;
  restart-frontend|rf) cmd_restart_frontend ;;
  status|s)     cmd_status ;;
  health)       cmd_health ;;
  logs|l)       cmd_logs "$2" "$3" ;;
  help|--help|-h) cmd_help ;;
  *)            log_error "Unknown command: $1"; cmd_help; exit 1 ;;
esac
