#!/bin/bash
# Pi Session 工具调用分析脚本
# 分析所有历史 session 文件中的工具调用情况

set -e

SESSION_DIR="${1:-/root/.pi/agent/sessions}"
OUTPUT_DIR="${2:-./session-analysis}"
ANALYSIS_FILE="$OUTPUT_DIR/analysis-report.md"

echo "=========================================="
echo "🔍 Pi Session 工具调用分析"
echo "=========================================="
echo "Session 目录: $SESSION_DIR"
echo "输出目录: $OUTPUT_DIR"
echo ""

# 创建输出目录
mkdir -p "$OUTPUT_DIR"

# 统计 session 文件数量
SESSION_COUNT=$(find "$SESSION_DIR" -name "*.jsonl" 2>/dev/null | wc -l)
echo "📁 找到 $SESSION_COUNT 个 session 文件"
echo ""

if [ "$SESSION_COUNT" -eq 0 ]; then
    echo "❌ 未找到 session 文件"
    exit 1
fi

# 创建临时目录
TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

# 提取所有工具调用
echo "⏳ 正在分析 session 文件..."

find "$SESSION_DIR" -name "*.jsonl" -exec cat {} \; | \
node -e '
const fs = require("fs");
const readline = require("readline");

const stats = {
    totalSessions: 0,
    totalMessages: 0,
    toolCalls: {},
    bashCommands: {},
    failures: {},
    bashFailures: {}
};

const rl = readline.createInterface({
    input: process.stdin,
    terminal: false
});

rl.on("line", (line) => {
    try {
        const data = JSON.parse(line);
        
        // 统计 session
        if (data.type === "session") {
            stats.totalSessions++;
        }
        
        // 统计消息
        if (data.type === "message" && data.message) {
            stats.totalMessages++;
            
            const content = data.message.content;
            if (Array.isArray(content)) {
                content.forEach(item => {
                    // 工具调用统计
                    if (item.type === "toolCall" || item.type === "tool_use") {
                        const toolName = item.name || item.toolName || "unknown";
                        
                        if (!stats.toolCalls[toolName]) {
                            stats.toolCalls[toolName] = { count: 0, failures: 0 };
                        }
                        stats.toolCalls[toolName].count++;
                        
                        // bash 命令详细统计
                        if (toolName === "bash" && item.arguments) {
                            try {
                                const args = typeof item.arguments === "string" ? 
                                    JSON.parse(item.arguments) : item.arguments;
                                const command = args.command || "";
                                
                                // 提取基础命令（第一个单词）
                                const baseCmd = command.trim().split(/\s+/)[0];
                                if (baseCmd) {
                                    if (!stats.bashCommands[baseCmd]) {
                                        stats.bashCommands[baseCmd] = { count: 0, failures: 0, examples: [] };
                                    }
                                    stats.bashCommands[baseCmd].count++;
                                    
                                    // 保存示例（最多3个）
                                    if (stats.bashCommands[baseCmd].examples.length < 3) {
                                        stats.bashCommands[baseCmd].examples.push(command.substring(0, 100));
                                    }
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                    
                    // 工具结果统计（用于判断失败）
                    if (item.type === "toolResult" || item.type === "tool_result") {
                        const toolName = item.toolName || "unknown";
                        
                        if (item.isError) {
                            if (!stats.failures[toolName]) {
                                stats.failures[toolName] = { count: 0, errors: [] };
                            }
                            stats.failures[toolName].count++;
                            
                            // 记录错误信息
                            if (item.content && Array.isArray(item.content)) {
                                const errorText = item.content
                                    .filter(c => c.type === "text")
                                    .map(c => c.text)
                                    .join(" ")
                                    .substring(0, 200);
                                if (errorText && stats.failures[toolName].errors.length < 5) {
                                    stats.failures[toolName].errors.push(errorText);
                                }
                            }
                            
                            // bash 失败统计
                            if (toolName === "bash" && item.toolCallId) {
                                // 这里需要关联 toolCall，简化处理
                            }
                        }
                    }
                });
            }
        }
    } catch (e) {
        // 忽略解析错误
    }
});

rl.on("close", () => {
    fs.writeFileSync("'$TMP_DIR'/stats.json", JSON.stringify(stats, null, 2));
    console.log(JSON.stringify(stats, null, 2));
});
' > "$TMP_DIR/output.json"

# 读取统计数据
STATS=$(cat "$TMP_DIR/output.json")

echo "✅ 分析完成"
echo ""

# 生成报告
cat > "$ANALYSIS_FILE" << 'HEADER'
# Pi Session 工具调用分析报告

## 📊 统计概览

| 指标 | 数值 |
|------|------|
| Session 文件总数 | SESSION_COUNT |
| 消息总数 | MESSAGE_COUNT |

## 🛠️ 工具调用统计

| 工具名称 | 调用次数 | 失败次数 | 成功率 |
|---------|---------|---------|--------|
HEADER

# 添加总体统计
TOTAL_SESSIONS=$(echo "$STATS" | node -e 'const d=require("fs").readFileSync(0,"utf8");const s=JSON.parse(d);console.log(s.totalSessions||0)')
TOTAL_MESSAGES=$(echo "$STATS" | node -e 'const d=require("fs").readFileSync(0,"utf8");const s=JSON.parse(d);console.log(s.totalMessages||0)')

sed -i "s/SESSION_COUNT/$TOTAL_SESSIONS/g" "$ANALYSIS_FILE"
sed -i "s/MESSAGE_COUNT/$TOTAL_MESSAGES/g" "$ANALYSIS_FILE"

# 添加工具统计
echo "" >> "$ANALYSIS_FILE"
echo "$STATS" | node -e '
const d = require("fs").readFileSync(0, "utf8");
const s = JSON.parse(d);

const tools = Object.entries(s.toolCalls).sort((a, b) => b[1].count - a[1].count);
tools.forEach(([name, data]) => {
    const failCount = (s.failures[name] && s.failures[name].count) || 0;
    const success = ((data.count - failCount) / data.count * 100).toFixed(1);
    console.log(`| ${name} | ${data.count} | ${failCount} | ${success}% |`);
});
' >> "$ANALYSIS_FILE"

# 添加 bash 命令详细统计
cat >> "$ANALYSIS_FILE" << 'BASH_HEADER'

## 🔧 Bash 命令详细统计

> Bash 工具按具体命令统计（而非单一工具）

| 命令 | 调用次数 | 占比 | 示例 |
|------|---------|------|------|
BASH_HEADER

echo "$STATS" | node -e '
const d = require("fs").readFileSync(0, "utf8");
const s = JSON.parse(d);
const totalBash = s.toolCalls.bash ? s.toolCalls.bash.count : 1;

const cmds = Object.entries(s.bashCommands).sort((a, b) => b[1].count - a[1].count);
cmds.slice(0, 30).forEach(([name, data]) => {
    const pct = ((data.count / totalBash) * 100).toFixed(1);
    const example = data.examples[0] ? data.examples[0].replace(/\|/g, "\\|") : "";
    console.log(`| ${name} | ${data.count} | ${pct}% | \`${example}\` |`);
});
' >> "$ANALYSIS_FILE"

# 添加失败分析
cat >> "$ANALYSIS_FILE" << 'FAIL_HEADER'

## ❌ 失败分析

### 按工具统计失败

| 工具 | 失败次数 | 常见错误 |
|------|---------|---------|
FAIL_HEADER

echo "$STATS" | node -e '
const d = require("fs").readFileSync(0, "utf8");
const s = JSON.parse(d);

const fails = Object.entries(s.failures).sort((a, b) => b[1].count - a[1].count);
fails.forEach(([name, data]) => {
    const errorPreview = data.errors[0] ? data.errors[0].substring(0, 50).replace(/\|/g, "\\|") + "..." : "N/A";
    console.log(`| ${name} | ${data.count} | ${errorPreview} |`);
});
' >> "$ANALYSIS_FILE"

# 添加详细错误信息
cat >> "$ANALYSIS_FILE" << 'DETAIL_HEADER'

### 详细错误信息

DETAIL_HEADER

echo "$STATS" | node -e '
const d = require("fs").readFileSync(0, "utf8");
const s = JSON.parse(d);

const fails = Object.entries(s.failures).sort((a, b) => b[1].count - a[1].count);
fails.slice(0, 10).forEach(([name, data]) => {
    console.log(`\n#### ${name} (${data.count} 次失败)\n`);
    data.errors.slice(0, 3).forEach((err, i) => {
        console.log(`\${i + 1}. ${err.substring(0, 150)}...\n`);
    });
});
' >> "$ANALYSIS_FILE"

# 添加改善建议
cat >> "$ANALYSIS_FILE" << 'SUGGESTIONS'

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

SUGGESTIONS

# 保存 JSON 数据
cp "$TMP_DIR/output.json" "$OUTPUT_DIR/stats.json"

echo "✅ 分析完成！"
echo ""
echo "📄 报告位置: $ANALYSIS_FILE"
echo "📊 JSON 数据: $OUTPUT_DIR/stats.json"
echo ""

# 显示摘要
echo "=========================================="
echo "📊 分析摘要"
echo "=========================================="
echo "$STATS" | node -e '
const d = require("fs").readFileSync(0, "utf8");
const s = JSON.parse(d);

console.log(`Session 总数: ${s.totalSessions}`);
console.log(`消息总数: ${s.totalMessages}`);
console.log("");
console.log("🔝 使用最多的工具:");
const tools = Object.entries(s.toolCalls).sort((a, b) => b[1].count - a[1].count);
tools.slice(0, 5).forEach(([name, data], i) => {
    console.log(`  ${i+1}. ${name}: ${data.count} 次`);
});
console.log("");
console.log("🔝 使用最多的 Bash 命令:");
const cmds = Object.entries(s.bashCommands).sort((a, b) => b[1].count - a[1].count);
cmds.slice(0, 5).forEach(([name, data], i) => {
    console.log(`  ${i+1}. ${name}: ${data.count} 次`);
});
'

echo ""
echo "=========================================="
echo "💡 查看完整报告:"
echo "cat $ANALYSIS_FILE"
echo "=========================================="
