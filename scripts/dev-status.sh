#!/bin/bash
# Development status check script
# AI uses this script to check service status... user operation instructions

cd /root/pi-gateway-standalone

echo "=== Pi Gateway development status check ==="
echo ""

# Check backend process
BACKEND_PID=$(pgrep -f "tsx watch src/server/server.ts" | head -1)
if [ -n "$BACKEND_PID" ]; then
  echo "✅ Backend service running (PID: $BACKEND_PID)"
  BACKEND_HEALTH=$(curl -s http://127.0.0.1:3000/api/version 2>/dev/null | grep -o '"pid":[0-9]*' | cut -d: -f2)
  if [ -n "$BACKEND_HEALTH" ]; then
    echo "   Health check passed (PID: $BACKEND_HEALTH)"
  else
    echo "   ⚠️ Health check failed"
  fi
else
  echo "❌ Backend service not running"
  echo "   Start command: npx tsx watch src/server/server.ts"
fi

echo ""

# Check frontend process
FRONTEND_PID=$(pgrep -f "vite --host 127.0.0.1" | head -1)
if [ -n "$FRONTEND_PID" ]; then
  echo "✅ Frontend service running (PID: $FRONTEND_PID)"
  FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173 2>/dev/null)
  if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "   Health check passed (HTTP 200)"
  else
    echo "   ⚠️ Health check failed (HTTP $FRONTEND_HEALTH)"
  fi
else
  echo "❌ Frontend service not running"
  echo "   Start command: npx vite --host 127.0.0.1 --port 5173"
fi

echo ""
echo "=== Common Operations ==="
echo "Restarting Frontend...pkill -f 'vite --host' && npx vite --host 127.0.0.1 --port 5173"
echo "Restarting Backend...pkill -f 'tsx watch src/server' && npx tsx watch src/server/server.ts"
echo "Clear cache:    rm -rf node_modules/.vite"
echo "Full restart:    bash dev-start.sh"
