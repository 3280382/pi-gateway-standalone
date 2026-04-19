#!/bin/bash
# 恢复或重新创建 tmux 会话

GATEWAY_DIR="/root/pi-gateway-standalone"
SESSION_NAME="gateway-dev"

echo "=== pi-gateway-standalone 会话恢复 ==="
echo ""

# 检查会话是否Exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "✅ 会话 '$SESSION_NAME' Exists"
    echo "尝试附加到会话..."
    
    # 尝试附加
    if tmux attach -t $SESSION_NAME 2>/dev/null; then
        echo "✅ 成功附加到会话"
        exit 0
    else
        echo "⚠️ 附加失败 (权限问题)"
        echo ""
        echo "选项:"
        echo "1. 杀掉现有会话并重新创建"
        echo "2. 退出"
        echo ""
        read -p "选择 (1/2): " choice
        
        if [ "$choice" = "1" ]; then
            echo "杀掉现有会话..."
            pkill -f "tmux.*$SESSION_NAME"
            sleep 2
            echo "重新Create session..."
            bash scripts/start-tmux-dev.sh
        else
            echo "退出"
            exit 1
        fi
    fi
else
    echo "⚠️ 会话 '$SESSION_NAME' 不Exists"
    echo "创建新会话..."
    bash scripts/start-tmux-dev.sh
fi