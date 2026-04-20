#!/bin/bash
# Tmux Operation Help

cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║              Tmux Three-Pane Development Environment - Operation Guide                   ║
╠══════════════════════════════════════════════════════════════╣

🎯 Quick Exit Methods

1️⃣  [Recommended] Keep session, exit observation (service continues running)
    Press: Ctrl+b then press d
    Effect: Back to normal terminal, three services continue running in background
    Resume: tmux attach -t gateway-dev

2️⃣  Completely close all services (Frontend + Backend + pi)
    Method A: In each pane press Ctrl+c Stop服务，then press exit
    Method B: Directly close terminal window
    Method C: Run in another terminal: bash scripts/tmux-dev.sh kill

🎯 Switch pane

    Ctrl+b + ↑    去Frontend Pane
    Ctrl+b + ↓    Go to AI (pi) pane
    Ctrl+b + ←    去Backend Pane
    Ctrl+b + →    去Backend Pane

🎯 Common Operations

    Stop Frontend:    Ctrl+b + ↑ then Ctrl+c
    Stop Backend:    Ctrl+b + ← then Ctrl+c
    Stop pi:     Ctrl+b + ↓ then Ctrl+d or type exit

🎯 会话管理（在普通终端Execute）

    查看会话:    tmux ls
    Recover session:    tmux attach -t gateway-dev
    Kill session:    tmux kill-session -t gateway-dev

╚══════════════════════════════════════════════════════════════╝
EOF
