#!/bin/bash
# Resume或重新Create tmux 会话

GATEWAY_DIR="/root/pi-gateway-standalone"
SESSION_NAME="gateway-dev"

echo "=== pi-gateway-standalone 会话Resume ==="
echo ""

# Check会话是否Exists
if tmux has-session -t $SESSION_NAME 2>/dev/null; then
    echo "✅ 会话 '$SESSION_NAME' Exists"
    echo "尝试附加到会话..."
    
    # 尝试附加
    if tmux attach -t $SESSION_NAME 2>/dev/null; then
        echo "✅ Success附加到会话"
        exit 0
    else
        echo "⚠️ 附加Failed (权限问题)"
        echo ""
        echo "Options:"
        echo "1. 杀掉现有会话并重新Create"
        echo "2. Exit"
        echo ""
        read -p "Select (1/2): " choice
        
        if [ "$choice" = "1" ]; then
            echo "杀掉现有会话..."
            pkill -f "tmux.*$SESSION_NAME"
            sleep 2
            echo "重新Create session..."
            bash scripts/start-tmux-dev.sh
        else
            echo "Exit"
            exit 1
        fi
    fi
else
    echo "⚠️ 会话 '$SESSION_NAME' 不Exists"
    echo "Create新会话..."
    bash scripts/start-tmux-dev.sh
fi