#!/bin/bash

echo "=== 多会话修改测试 ==="
echo

# 1. 检查修改的文件
echo "1. 已修改的文件："
echo "- src/server/features/chat/agent-session/session-manager.ts"
echo "- src/server/features/chat/ws-handlers/session-handlers.ts"
echo "- src/server/features/chat/controllers/session.controller.ts"
echo "- src/server/features/chat/http-routes.ts"
echo "- src/client/features/chat/components/sidebar/SessionDropdownSection.tsx"
echo "- src/client/features/chat/components/sidebar/SidebarPanel.module.css"
echo

# 2. 检查关键修改
echo "2. 关键修改点："
echo "a) 允许多会话共存（注释销毁逻辑）"
grep -n "Different sessionFile for same workingDir" src/server/features/chat/agent-session/session-manager.ts | head -2
echo

echo "b) 添加getActiveSessions方法"
grep -n "getActiveSessions" src/server/features/chat/agent-session/session-manager.ts | head -5
echo

echo "c) HTTP API端点"
grep -n "getActiveSessions" src/server/features/chat/controllers/session.controller.ts
echo

echo "d) 路由注册"
grep -n "/api/sessions/active" src/server/features/chat/http-routes.ts
echo

echo "e) 前端活跃状态显示"
grep -n "activeSessions" src/client/features/chat/components/sidebar/SessionDropdownSection.tsx | head -5
echo

# 3. 编译检查
echo "3. 编译检查："
echo "运行 npm run check..."
npm run check 2>&1 | tail -20
echo

echo "4. 启动测试（需要手动验证）："
echo "启动服务：bash scripts/start-tmux-dev.sh"
echo "测试API：curl 'http://localhost:3000/api/sessions/active?workingDir=/root'"
echo
echo "5. 浏览器测试："
echo "- 打开 http://localhost:3000"
echo "- 创建多个会话"
echo "- 观察侧边栏是否有绿点指示活跃会话"
echo "- 切换会话验证功能正常"