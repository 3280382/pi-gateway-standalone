#!/bin/bash
# Tmux 操作帮助

cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║              Tmux 三窗格开发环境 - 操作指南                   ║
╠══════════════════════════════════════════════════════════════╣

🎯 快速退出方式

1️⃣  【推荐】保留会话，退出观察（服务继续运行）
    按: Ctrl+b 然后按 d
    效果: 回到普通终端，三个服务在后台继续运行
    恢复: tmux attach -t gateway-dev

2️⃣  完全关闭所有服务（前端 + 后端 + pi）
    方法A: 在每个窗格按 Ctrl+c 停止服务，然后按 exit
    方法B: 直接关闭终端窗口
    方法C: 在另一个终端运行: bash scripts/tmux-dev.sh kill

🎯 切换窗格

    Ctrl+b + ↑    去前端窗格
    Ctrl+b + ↓    去 AI (pi) 窗格
    Ctrl+b + ←    去后端窗格
    Ctrl+b + →    去后端窗格

🎯 常用操作

    停止前端:    Ctrl+b + ↑ 然后 Ctrl+c
    停止后端:    Ctrl+b + ← 然后 Ctrl+c
    停止 pi:     Ctrl+b + ↓ 然后 Ctrl+d 或输入 exit

🎯 会话管理（在普通终端执行）

    查看会话:    tmux ls
    恢复会话:    tmux attach -t gateway-dev
    杀掉会话:    tmux kill-session -t gateway-dev

╚══════════════════════════════════════════════════════════════╝
EOF
