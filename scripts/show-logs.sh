#!/bin/bash
# Show当前的服务Log

GATEWAY_DIR="/root/pi-gateway-standalone"
LOGS_DIR="$GATEWAY_DIR/logs"

echo "=== pi-gateway-standalone 服务Log ==="
echo "位置: $LOGS_DIR"
echo ""

# CheckLog目录
if [ ! -d "$LOGS_DIR" ]; then
    echo "⚠️ Log目录不Exists，Create中..."
    mkdir -p "$LOGS_DIR"
    echo "✅ 已CreateLog目录: $LOGS_DIR"
fi

echo "📋 当前Log文件:"
echo ""

# Frontend当前Log
frontend_current="$LOGS_DIR/frontend_current.log"
if [ -f "$frontend_current" ]; then
    echo "🔵 FrontendCurrent log: frontend_current.log"
    echo "   大小: $(du -h "$frontend_current" | cut -f1)"
    echo "   修改时间: $(stat -c %y "$frontend_current" 2>/dev/null || date -r "$frontend_current")"
    echo "   最后5行:"
    tail -5 "$frontend_current" | sed 's/^/      /'
else
    echo "🔵 FrontendCurrent log: 不Exists"
fi

echo ""

# Backend当前Log
backend_current="$LOGS_DIR/backend_current.log"
if [ -f "$backend_current" ]; then
    echo "🟢 BackendCurrent log: backend_current.log"
    echo "   大小: $(du -h "$backend_current" | cut -f1)"
    echo "   修改时间: $(stat -c %y "$backend_current" 2>/dev/null || date -r "$backend_current")"
    echo "   最后5行:"
    tail -5 "$backend_current" | sed 's/^/      /'
else
    echo "🟢 BackendCurrent log: 不Exists"
fi

echo ""
echo "📁 所有Log文件:"
ls -la "$LOGS_DIR"/*.log 2>/dev/null | while read line; do
    echo "   $line"
done || echo "   没有Log文件"