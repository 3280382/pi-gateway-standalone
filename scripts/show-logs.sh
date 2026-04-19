#!/bin/bash
# 显示当前的服务日志

GATEWAY_DIR="/root/pi-gateway-standalone"
LOGS_DIR="$GATEWAY_DIR/logs"

echo "=== pi-gateway-standalone 服务日志 ==="
echo "位置: $LOGS_DIR"
echo ""

# 检查日志目录
if [ ! -d "$LOGS_DIR" ]; then
    echo "⚠️ 日志目录不Exists，创建中..."
    mkdir -p "$LOGS_DIR"
    echo "✅ 已创建日志目录: $LOGS_DIR"
fi

echo "📋 当前日志文件:"
echo ""

# Frontend当前日志
frontend_current="$LOGS_DIR/frontend_current.log"
if [ -f "$frontend_current" ]; then
    echo "🔵 Frontend当前日志: frontend_current.log"
    echo "   大小: $(du -h "$frontend_current" | cut -f1)"
    echo "   修改时间: $(stat -c %y "$frontend_current" 2>/dev/null || date -r "$frontend_current")"
    echo "   最后5行:"
    tail -5 "$frontend_current" | sed 's/^/      /'
else
    echo "🔵 Frontend当前日志: 不Exists"
fi

echo ""

# Backend当前日志
backend_current="$LOGS_DIR/backend_current.log"
if [ -f "$backend_current" ]; then
    echo "🟢 Backend当前日志: backend_current.log"
    echo "   大小: $(du -h "$backend_current" | cut -f1)"
    echo "   修改时间: $(stat -c %y "$backend_current" 2>/dev/null || date -r "$backend_current")"
    echo "   最后5行:"
    tail -5 "$backend_current" | sed 's/^/      /'
else
    echo "🟢 Backend当前日志: 不Exists"
fi

echo ""
echo "📁 所有日志文件:"
ls -la "$LOGS_DIR"/*.log 2>/dev/null | while read line; do
    echo "   $line"
done || echo "   没有日志文件"