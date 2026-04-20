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
    Method A: In each pane press Ctrl+c Stop service, then press exit
    Method B: Directly close terminal window
    Method C: Run in another terminal: bash scripts/tmux-dev.sh kill

🎯 Switch pane

    Ctrl+b + ↑    Go to Frontend Pane
    Ctrl+b + ↓    Go to AI (pi) pane
    Ctrl+b + ←    Go to Backend Pane
    Ctrl+b + →    Go to Backend Pane

🎯 Common Operations

    Stop Frontend:    Ctrl+b + ↑ then Ctrl+c
    Stop Backend:    Ctrl+b + ← then Ctrl+c
    Stop pi:     Ctrl+b + ↓ then Ctrl+d or type exit

🎯 Session management (execute in normal terminal)

    View sessions:    tmux ls
    Recover session:    tmux attach -t gateway-dev
    Kill session:    tmux kill-session -t gateway-dev

╚══════════════════════════════════════════════════════════════╝
EOF
