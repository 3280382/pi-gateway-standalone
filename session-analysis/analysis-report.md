# Pi Session 工具调用分析报告

## 📊 统计概览

| 指标 | 数值 |
|------|------|
| Session 文件总数 | 570 |
| 消息总数 | 66856 |

## 🛠️ 工具调用统计

| 工具名称 | 调用次数 | 失败次数 | 成功率 |
|---------|---------|---------|--------|

| bash | 16062 | 0 | 100.0% |
| read | 7626 | 0 | 100.0% |
| edit | 4942 | 0 | 100.0% |
| write | 2370 | 0 | 100.0% |
| coordinator | 28 | 0 | 100.0% |
| subagent | 6 | 0 | 100.0% |
| web_admin_start | 5 | 0 | 100.0% |
| tavily-search | 2 | 0 | 100.0% |

## 🔧 Bash 命令详细统计

> Bash 工具按具体命令统计（而非单一工具）

| 命令 | 调用次数 | 占比 | 示例 |
|------|---------|------|------|
| cd | 8957 | 55.8% | `cd pi-mono && git log --oneline -5 && echo "---" && git remote -v` |
| grep | 1878 | 11.7% | `grep -r "kimi" ~/.pi 2>/dev/null \| head -20` |
| ls | 743 | 4.6% | `ls -la` |
| find | 428 | 2.7% | `find / -maxdepth 4 -name "*proot*" 2>/dev/null \| head -50` |
| curl | 351 | 2.2% | `curl -s http://localhost:3000/ \| head -20` |
| sed | 345 | 2.1% | `sed -n '1060,1070p' /root/pi-mono/pi-session-2026-03-19T19-25-53-371Z_621077a9-76c1-4524-9fe2-9605a0` |
| > | 319 | 2.0% | `> /tmp/test_session.jsonl cat << 'EOF'
{"type":"message","id":"test1","timestamp":"2026-03-23T10:00:` |
| echo | 293 | 1.8% | `echo "当前tmpdir: $(node -e "console.log(require('os').tmpdir())")" && echo "HOME: $HOME" && echo "TMP` |
| cat | 282 | 1.8% | `cat ~/.pi/agent/settings.json 2>/dev/null \|\| echo "No settings.json found"` |
| sleep | 278 | 1.7% | `sleep 2 && ps aux \| grep "node server.js" \| grep -v grep && echo "---" && ss -tlnp \| grep 3000 \|\| ne` |
| pkill | 201 | 1.3% | `pkill -f "node server.js" 2>/dev/null; sleep 1; cd file-server && node server.js .. &` |
| ps | 178 | 1.1% | `ps aux \| grep node \| grep -v grep` |
| # | 174 | 1.1% | `# 演示脚本使用方法
./create_tmp_files.sh --help` |
| tail | 137 | 0.9% | `tail -20 ~/ttyd.log 2>/dev/null \|\| echo "日志文件不存在"` |
| rm | 112 | 0.7% | `rm -rf aider_env` |
| chmod | 82 | 0.5% | `chmod +x file-server/server.js && mkdir -p file-server/public` |
| node | 81 | 0.5% | `node --version && npm --version` |
| head | 80 | 0.5% | `head -20 tui_interactive_test.py` |
| which | 70 | 0.4% | `which proot 2>/dev/null && echo "---" && proot --version 2>/dev/null \|\| echo "proot 未安装或不在 PATH 中"` |
| mkdir | 69 | 0.4% | `mkdir -p ~/.pip` |
| python3 | 58 | 0.4% | `python3 --version` |
| wc | 54 | 0.3% | `wc -l /root/pi-mono/pi-session-2026-03-19T19-25-53-371Z_621077a9-76c1-4524-9fe2-9605a0b6c87e.html` |
| tmux | 50 | 0.3% | `tmux list-sessions 2>&1` |
| . | 49 | 0.3% | `. /root/pi-gateway-standalone/src/client/features/chat/components/sidebar/Settings` |
| git | 46 | 0.3% | `git clone https://github.com/badlogic/pi-mono.git` |
| pip | 42 | 0.3% | `pip install openclaw` |
| pwd | 37 | 0.2% | `pwd && ls -la` |
| pkg | 35 | 0.2% | `pkg show gradle d8 apksigner` |
| npm | 31 | 0.2% | `npm view @mariozechner/pi-coding-agent version 2>/dev/null` |
| pi | 29 | 0.2% | `pi --version 2>/dev/null \|\| npm list -g @mariozechner/pi-coding-agent 2>/dev/null` |

## ❌ 失败分析

### 按工具统计失败

| 工具 | 失败次数 | 常见错误 |
|------|---------|---------|

### 详细错误信息


## 💡 改善建议

### 1. 高频工具优化

**read**: 文件读取是最常用的工具
- 建议：增加文件缓存机制，避免重复读取
- 建议：大文件分片读取，减少内存占用

**bash**: 命令执行工具
- 建议：常用命令（ls, cat, grep）可封装为专用工具
- 建议：命令执行超时机制
- 建议：危险命令（rm -rf）二次确认

**write**: 文件写入
- 建议：批量写入支持，减少IO次数
- 建议：自动备份机制

### 2. 失败率高的工具

根据失败统计，针对性改进：
- **路径不存在错误**: 提前验证路径
- **权限错误**: 自动尝试 sudo 或提示用户
- **命令不存在**: 检查命令可用性

### 3. Bash 命令优化

高频 bash 命令可以封装为独立工具：
- `ls` → listDirectory 工具
- `cat` → readFile 工具
- `grep` → searchInFiles 工具
- `find` → findFiles 工具
- `cd` + `pwd` → 工作目录管理

### 4. 会话分析洞察

- 平均每个 session 的消息数：可评估用户活跃度
- 工具调用成功率：系统稳定性指标
- 高频失败场景：优先改进点

---

## 📈 数据导出

详细数据已保存到：
- JSON: `stats.json`
- 报告: `analysis-report.md`

