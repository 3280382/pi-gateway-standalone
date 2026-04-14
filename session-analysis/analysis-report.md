# Pi Session 工具调用分析报告

生成时间: 2026-04-14 02:44:55

## 📊 统计概览

| 指标 | 数值 |
|------|------|
| Session 文件总数 | 570 |
| 消息总数 | 66864 |
| 工具调用总数 | 31043 |
| 失败次数 | 0 |
| 整体成功率 | 100.0% |

## 🛠️ 工具调用统计

| 工具名称 | 调用次数 | 失败次数 | 成功率 | 占比 |
|---------|---------|---------|--------|------|
| bash | 16064 | 0 | 100.0% | 51.7% |
| read | 7626 | 0 | 100.0% | 24.6% |
| edit | 4942 | 0 | 100.0% | 15.9% |
| write | 2370 | 0 | 100.0% | 7.6% |
| coordinator | 28 | 0 | 100.0% | 0.1% |
| subagent | 6 | 0 | 100.0% | 0.0% |
| web_admin_start | 5 | 0 | 100.0% | 0.0% |
| tavily-search | 2 | 0 | 100.0% | 0.0% |

## 🔧 Bash 命令详细统计

> Bash 工具按具体命令统计（而非单一工具）

| 命令 | 调用次数 | 失败次数 | 占比 | 成功率 | 示例 |
|------|---------|---------|------|--------|------|
| `cd` | 8958 | 0 | 55.8% | 100.0% | `cd pi-mono && git log --oneline -5 && echo "---" && git remo` |
| `grep` | 1878 | 0 | 11.7% | 100.0% | `grep -r "kimi" ~/.pi 2>/dev/null \| head -20` |
| `ls` | 743 | 0 | 4.6% | 100.0% | `ls -la` |
| `find` | 428 | 0 | 2.7% | 100.0% | `find / -maxdepth 4 -name "*proot*" 2>/dev/null \| head -50` |
| `curl` | 351 | 0 | 2.2% | 100.0% | `curl -s http://localhost:3000/ \| head -20` |
| `sed` | 345 | 0 | 2.1% | 100.0% | `sed -n '1060,1070p' /root/pi-mono/pi-session-2026-03-19T19-2` |
| `echo` | 293 | 0 | 1.8% | 100.0% | `echo "=== OS Information ===" && cat /etc/os-release 2>/dev/` |
| `cat` | 282 | 0 | 1.8% | 100.0% | `cat ~/.pi/agent/settings.json 2>/dev/null \|\| echo "No sett` |
| `sleep` | 278 | 0 | 1.7% | 100.0% | `sleep 2 && ps aux \| grep "node server.js" \| grep -v grep &` |
| `unknown` | 273 | 0 | 1.7% | 100.0% | `password="a6631384." && echo "Password: $password" && echo "` |
| `pkill` | 201 | 0 | 1.3% | 100.0% | `pkill -f "node server.js" 2>/dev/null; sleep 1; cd file-serv` |
| `ps` | 178 | 0 | 1.1% | 100.0% | `ps aux \| grep node \| grep -v grep` |
| `#` | 174 | 0 | 1.1% | 100.0% | `# List all processes with their PIDs and filter for pi-relat` |
| `tail` | 137 | 0 | 0.9% | 100.0% | `tail -100 /root/pi-mono/pi-session-2026-03-19T19-25-53-371Z_` |
| `rm` | 112 | 0 | 0.7% | 100.0% | `rm -f /root/.pi/agent/skills/tavily` |
| `chmod` | 82 | 0 | 0.5% | 100.0% | `chmod +x file-server/server.js && mkdir -p file-server/publi` |
| `head` | 81 | 0 | 0.5% | 100.0% | `head -30 /tmp/tavily-skills-new/tavily_cli/README.md` |
| `node` | 81 | 0 | 0.5% | 100.0% | `node scripts/tmux-controller.js status` |
| `which` | 70 | 0 | 0.4% | 100.0% | `which proot 2>/dev/null && echo "---" && proot --version 2>/` |
| `mkdir` | 69 | 0 | 0.4% | 100.0% | `mkdir -p /root/.pi/agent/git/github.com/tavily-ai && cd /roo` |
| `python3` | 58 | 0 | 0.4% | 100.0% | `python3 --version` |
| `wc` | 54 | 0 | 0.3% | 100.0% | `wc -l /root/pi-mono/pi-session-2026-03-19T19-25-53-371Z_6210` |
| `>` | 54 | 0 | 0.3% | 100.0% | `> /tmp/test_session.jsonl cat << 'EOF'
{"type":"message","id` |
| `tmux` | 50 | 0 | 0.3% | 100.0% | `tmux new-session -d -s multiagent -n hello1 "cd /data/data/c` |
| `.` | 49 | 0 | 0.3% | 100.0% | `. /root/pi-gateway-standalone/src/client/features/chat/compo` |
| `git` | 46 | 0 | 0.3% | 100.0% | `git clone https://github.com/badlogic/pi-mono.git` |
| `pip` | 42 | 0 | 0.3% | 100.0% | `pip install speedtest-cli 2>/dev/null \|\| pip3 install spee` |
| `pwd` | 37 | 0 | 0.2% | 100.0% | `pwd && ls -la` |
| `pkg` | 35 | 0 | 0.2% | 100.0% | `pkg install -y dart flutter 2>&1 \| tail -30` |
| `npm` | 32 | 0 | 0.2% | 100.0% | `npm view @mariozechner/pi-coding-agent version 2>/dev/null` |
| `pi` | 29 | 0 | 0.2% | 100.0% | `pi --version 2>/dev/null \|\| npm list -g @mariozechner/pi-c` |
| `cp` | 28 | 0 | 0.2% | 100.0% | `cp /root/.pi/agent/git/github.com/tavily-ai/skills/skills/ta` |
| `apt` | 25 | 0 | 0.2% | 100.0% | `apt update -y` |
| `~/.pi/agent/skills/free-search/search.sh` | 24 | 0 | 0.1% | 100.0% | `~/.pi/agent/skills/free-search/search.sh "world population 2` |
| `seq` | 22 | 0 | 0.1% | 100.0% | `seq 1 100 > numbers.txt` |
| `mv` | 21 | 0 | 0.1% | 100.0% | `mv bankflow_project.zip bankflow_project.doc` |
| `source` | 19 | 0 | 0.1% | 100.0% | `source ~/.bashrc && which tvly` |
| `timeout` | 19 | 0 | 0.1% | 100.0% | `timeout 30 ollama run gemma4:e2b "你好！你是谁？请用中文简单回答。" 2>&1 \| ` |
| `proot-distro` | 19 | 0 | 0.1% | 100.0% | `proot-distro list` |
| `python` | 18 | 0 | 0.1% | 100.0% | `python hello.py` |
| `npx` | 18 | 0 | 0.1% | 100.0% | `npx tsc --noEmit --skipLibCheck 2>&1 \| head -50` |
| `~/.config/gh/hosts.yml` | 15 | 0 | 0.1% | 100.0% | `TOKEN=$(cat ~/.config/gh/hosts.yml \| grep "oauth_token:" \|` |
| `netstat` | 14 | 0 | 0.1% | 100.0% | `netstat -tlnp 2>/dev/null \| grep -E "(5173\|3000\|8080\|80\` |
| `aider` | 14 | 0 | 0.1% | 100.0% | `aider --help` |
| `env` | 12 | 0 | 0.1% | 100.0% | `env \| head -30` |
| `export` | 12 | 0 | 0.1% | 100.0% | `export PATH="/root/.local/bin:$PATH" && which tvly` |
| `for` | 12 | 0 | 0.1% | 100.0% | `for skill in tavily-search tavily-cli tavily-crawl tavily-ex` |
| `awk` | 12 | 0 | 0.1% | 100.0% | `awk '/entries = \[/,/^\];/' /root/pi-mono/pi-session-2026-03` |
| `uname` | 11 | 0 | 0.1% | 100.0% | `uname -a` |
| `qqsend_mail` | 11 | 0 | 0.1% | 100.0% | `qqsend_mail "bankflow项目打包文件" "$(cat email_content.txt)" "rec` |

### Bash 命令失败详情

✅ 所有 Bash 命令都执行成功！

## ❌ 失败分析

✅ 没有发现工具调用失败！

## 📈 使用趋势（最近30天）

| 日期 | 调用次数 |
|------|---------|
| 2026-04-14 | 69 |
| 2026-04-13 | 1197 |
| 2026-04-12 | 210 |
| 2026-04-11 | 1754 |
| 2026-04-10 | 1337 |
| 2026-04-09 | 1038 |
| 2026-04-08 | 632 |
| 2026-04-07 | 454 |
| 2026-04-06 | 1290 |
| 2026-04-05 | 1870 |
| 2026-04-04 | 111 |
| 2026-04-03 | 1426 |
| 2026-04-02 | 2266 |
| 2026-04-01 | 42 |
| 2026-03-31 | 2954 |
| 2026-03-30 | 962 |
| 2026-03-29 | 2075 |
| 2026-03-28 | 1493 |
| 2026-03-27 | 629 |
| 2026-03-26 | 1318 |
| 2026-03-25 | 1625 |
| 2026-03-24 | 1418 |
| 2026-03-23 | 181 |
| 2026-03-22 | 21 |
| 2026-03-21 | 432 |
| 2026-03-20 | 675 |
| 2026-03-19 | 180 |
| 2026-03-18 | 105 |
| 2026-03-17 | 201 |
| 2026-03-16 | 172 |

## 💡 改善建议

### 1. 高频工具优化

**read**: 文件读取是最常用的工具
- 建议：增加文件缓存机制，避免重复读取相同文件
- 建议：大文件分片读取，减少内存占用
- 建议：监控频繁读取的文件，可能需要常驻内存

**bash**: 命令执行工具
- 建议：高频命令（如 cd, grep, ls）可封装为专用工具
- 建议：命令执行超时机制，防止长时间挂起
- 建议：危险命令（rm -rf, > 等）二次确认或限制
- 建议：命令结果缓存，相同命令短时间内复用

**edit**: 文件编辑
- 建议：增加编辑预览功能，确认后再应用
- 建议：支持批量编辑，减少多次调用

### 2. Bash 命令优化建议

根据统计，最常用的 bash 命令是: cd, grep, ls, find, curl

建议将这些高频命令封装为专用工具:

- `cd` → **changeDirectory**: 工作目录管理，支持历史记录
- `grep` → **searchInFiles**: 文件内容搜索，支持正则
- `ls` → **listDirectory**: 目录列表，支持过滤和排序
- `find` → **findFiles**: 文件查找，支持复杂条件
- `curl` → **httpRequest**: HTTP 请求，支持多种方法

### 4. 系统架构建议

- **工具调用追踪**: 实现调用链追踪，便于问题定位
- **性能监控**: 监控工具调用耗时，识别性能瓶颈
- **智能重试**: 对失败工具实现智能重试机制
- **结果缓存**: 对幂等操作实现结果缓存
- **批量操作**: 支持批量工具调用，减少往返次数
- **沙箱执行**: bash 命令在沙箱中执行，提高安全性

---

📊 详细数据已导出到 `stats.json`
