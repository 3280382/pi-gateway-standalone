#!/bin/bash
#
# Terminal WebSocket Test Runner
# 规范：使用 test/run-tests.ts 统一入口
#
# Usage: bash scripts/run-terminal-tests.sh [server|client|all]

set -e

TEST_TYPE="${1:-all}"
PROJECT_ROOT="/root/pi-gateway-standalone"

echo "🧪 Terminal WebSocket Test Runner"
echo "测试类型: $TEST_TYPE"
echo ""

cd "$PROJECT_ROOT"

if [ "$TEST_TYPE" = "server" ]; then
    npx tsx test/run-tests.ts terminal-server
elif [ "$TEST_TYPE" = "client" ]; then
    npx tsx test/run-tests.ts terminal-client
else
    npx tsx test/run-tests.ts terminal
fi
