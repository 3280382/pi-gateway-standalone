#!/bin/bash
# 开发状态检查脚本
# AI 使用此脚本Checking service status...用户操作指令

cd /root/pi-gateway-standalone

echo "=== Pi Gateway 开发状态检查 ==="
echo ""

# 检查后端的进程
BACKEND_PID=$(pgrep -f "tsx watch src/server/server.ts" | head -1)
if [ -n "$BACKEND_PID" ]; then
  echo "✅ 后端服务运行中 (PID: $BACKEND_PID)"
  BACKEND_HEALTH=$(curl -s http://127.0.0.1:3000/api/version 2>/dev/null | grep -o '"pid":[0-9]*' | cut -d: -f2)
  if [ -n "$BACKEND_HEALTH" ]; then
    echo "   健康检查通过 (PID: $BACKEND_HEALTH)"
  else
    echo "   ⚠️ 健康检查失败"
  fi
else
  echo "❌ 后端服务未运行"
  echo "   启动命令: npx tsx watch src/server/server.ts"
fi

echo ""

# 检查前端的进程
FRONTEND_PID=$(pgrep -f "vite --host 127.0.0.1" | head -1)
if [ -n "$FRONTEND_PID" ]; then
  echo "✅ 前端服务运行中 (PID: $FRONTEND_PID)"
  FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>/dev/null)
  if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "   健康检查通过 (HTTP 200)"
  else
    echo "   ⚠️ 健康检查失败 (HTTP $FRONTEND_HEALTH)"
  fi
else
  echo "❌ 前端服务未运行"
  echo "   启动命令: npx vite --host 127.0.0.1 --port 5173"
fi

echo ""
echo "=== 常用操作 ==="
echo "重启前端:  pkill -f 'vite --host' && npx vite --host 127.0.0.1 --port 5173"
echo "重启后端:  pkill -f 'tsx watch src/server' && npx tsx watch src/server/server.ts"
echo "清缓存:    rm -rf node_modules/.vite"
echo "全重启:    bash dev-start.sh"
