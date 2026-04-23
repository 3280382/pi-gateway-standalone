#!/bin/bash
#
# Unified Test Runner - 统一测试RunScript
# 规范：所有测试输出统一在 logs/test/<timestamp>/ 目录
#
# Usage: bash scripts/run-all-tests.sh [unit|integration|terminal|e2e|all]

set -e

# ========== ColorsConfigure ==========
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[PASS]${NC} $1"; }
log_error() { echo -e "${RED}[FAIL]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_section() { 
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}$1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
}

# ========== Configure ==========
TEST_TYPE="${1:-all}"
PROJECT_ROOT="/root/pi-gateway-standalone"

log_section "🧪 Pi Gateway 统一测试Run器"
log_info "测试类型: $TEST_TYPE"

# ========== Test ==========
cd "$PROJECT_ROOT"

if [ "$TEST_TYPE" = "all" ]; then
    npx tsx test/run-tests.ts all
elif [ "$TEST_TYPE" = "unit" ]; then
    npx tsx test/run-tests.ts unit
elif [ "$TEST_TYPE" = "integration" ]; then
    npx tsx test/run-tests.ts integration
elif [ "$TEST_TYPE" = "terminal" ]; then
    npx tsx test/run-tests.ts terminal
elif [ "$TEST_TYPE" = "terminal-server" ]; then
    npx tsx test/run-tests.ts terminal-server
elif [ "$TEST_TYPE" = "terminal-client" ]; then
    npx tsx test/run-tests.ts terminal-client
elif [ "$TEST_TYPE" = "e2e" ]; then
    npx tsx test/run-tests.ts e2e
else
    log_error "未知测试类型: $TEST_TYPE"
    echo "可用类型: all, unit, integration, terminal, terminal-server, terminal-client, e2e"
    exit 1
fi

EXIT_CODE=$?

# ========== 输出结果 ==========
if [ $EXIT_CODE -eq 0 ]; then
    log_success "All tests passed!"
    echo ""
    echo "View results:"
    echo "  报告: cat logs/test/latest/summary.md"
    echo "  截图: ls logs/test/latest/screenshots/"
    exit 0
else
    log_error "ExistsFailed的测试"
    echo ""
    echo "诊断Command:"
    echo "  报告: cat logs/test/latest/summary.md"
    echo "  Log: tail -100 logs/test/latest/backend/test.log"
    exit 1
fi
