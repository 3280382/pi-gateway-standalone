#!/bin/bash
# Tmux 操作帮助

cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║              Tmux 三窗格开发环境 - 操作指南                   ║
╠══════════════════════════════════════════════════════════════╣

🎯 快速退出方式

1️⃣  【推荐】保留会话，退出观察（Service continues running）
    按: Ctrl+b 然后按 d
    效果: 回到普通终端，三个服务在后台继续运行
    恢复: tmux attach -t gateway-dev

2️⃣  完全关闭所有服务（Frontend + Backend + pi）
    方法A: 在每个窗格按 Ctrl+c 停止服务，然后按 exit
    方法B: 直接关闭终端窗口
    方法C: 在另一个终端运行: bash scripts/tmux-dev.sh kill

🎯 Switch pane

    Ctrl+b + ↑    去Frontend窗格
    Ctrl+b + ↓    去 AI (pi) 窗格
    Ctrl+b + ←    去Backend窗格
    Ctrl+b + →    去Backend窗格

🎯 常用操作

    停止Frontend:    Ctrl+b + ↑ 然后 Ctrl+c
    停止Backend:    Ctrl+b + ← 然后 Ctrl+c
    停止 pi:     Ctrl+b + ↓ 然后 Ctrl+d or type exit

🎯 会话管理（在普通终端执行）

    查看会话:    tmux ls
    Recover session:    tmux attach -t gateway-dev
    杀掉会话:    tmux kill-session -t gateway-dev

╚══════════════════════════════════════════════════════════════╝
EOF
