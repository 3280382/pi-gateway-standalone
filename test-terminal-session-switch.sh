#!/bin/bash
# 终端测试：验证 session 切换时的消息加载

echo "========================================"
echo "测试: Session 切换消息加载"
echo "========================================"
echo ""

# 测试 1: 发送 init 消息获取初始 session
echo "[测试 1] 初始化并获取 session 列表..."
echo '{"type":"init","workingDir":"/root/pi-gateway-standalone"}' | websocat ws://127.0.0.1:3000/ws -n 2>/dev/null | jq -c '. | select(.type=="initialized" or .type=="sessions_list")' | head -5

echo ""
echo "[测试 2] 如果初始化成功，检查消息字段..."
echo ""

# 测试 2: 发送 list_sessions
echo '{"type":"list_sessions","workingDir":"/root/pi-gateway-standalone"}' | websocat ws://127.0.0.1:3000/ws -n 2>/dev/null | jq '.'

echo ""
echo "========================================"
echo "检查后端日志中的 session 加载..."
echo "========================================"
tail -20 logs/backend_current.log 2>/dev/null | grep -E "handleLoadSession|session_loaded|messages" || echo "无相关日志"

echo ""
echo "========================================"
echo "测试完成"
echo "========================================"
