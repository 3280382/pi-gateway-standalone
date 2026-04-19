#!/bin/bash
# 开发状态CheckScript
# AI 使用此ScriptChecking service status...用户操作指令

cd /root/pi-gateway-standalone

echo "=== Pi Gateway 开发状态Check ==="
echo ""

# CheckBackend的进程
BACKEND_PID=$(pgrep -f "tsx watch src/server/server.ts" | head -1)
if [ -n "$BACKEND_PID" ]; then
  echo "✅ Backend服务Running (PID: $BACKEND_PID)"
  BACKEND_HEALTH=$(curl -s http://127.0.0.1:3000/api/version 2>/dev/null | grep -o '"pid":[0-9]*' | cut -d: -f2)
  if [ -n "$BACKEND_HEALTH" ]; then
    echo "   健康Check通过 (PID: $BACKEND_HEALTH)"
  else
    echo "   ⚠️ 健康CheckFailed"
  fi
else
  echo "❌ Backend服务Not running"
  echo "   启动Command: npx tsx watch src/server/server.ts"
fi

echo ""

# CheckFrontend的进程
FRONTEND_PID=$(pgrep -f "vite --host 127.0.0.1" | head -1)
if [ -n "$FRONTEND_PID" ]; then
  echo "✅ Frontend服务Running (PID: $FRONTEND_PID)"
  FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>/dev/null)
  if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "   健康Check通过 (HTTP 200)"
  else
    echo "   ⚠️ 健康CheckFailed (HTTP $FRONTEND_HEALTH)"
  fi
else
  echo "❌ Frontend服务Not running"
  echo "   启动Command: npx vite --host 127.0.0.1 --port 5173"
fi

echo ""
echo "=== 常用操作 ==="
echo "Restarting Frontend...pkill -f 'vite --host' && npx vite --host 127.0.0.1 --port 5173"
echo "Restarting Backend...pkill -f 'tsx watch src/server' && npx tsx watch src/server/server.ts"
echo "清缓存:    rm -rf node_modules/.vite"
echo "全Restart:    bash dev-start.sh"
