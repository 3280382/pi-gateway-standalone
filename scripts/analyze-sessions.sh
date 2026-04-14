#!/bin/bash
# Pi Session 分析脚本
# 统计所有历史 session 中的工具调用情况

set -e

SESSION_DIR="/root/.pi/agent/sessions"
OUTPUT_DIR="/tmp/pi-session-analysis"
mkdir -p "$OUTPUT_DIR"

echo "======================================"
echo "🔍 Pi Session 工具调用分析"
echo "======================================"
echo ""

# 检查 session 目录
if [ ! -d "$SESSION_DIR" ]; then
    echo "❌ Session 目录不存在: $SESSION_DIR"
    exit 1
fi

# 统计 session 文件数量
SESSION_COUNT=$(find "$SESSION_DIR" -name "*.jsonl" | wc -l)
echo "📁 发现 $SESSION_COUNT 个 session 文件"
echo ""

# 创建 Node.js 分析脚本
cat > "$OUTPUT_DIR/analyze.js" << 'NODE_SCRIPT'
const fs = require('fs');
const path = require('path');

const SESSION_DIR = '/root/.pi/agent/sessions';
const OUTPUT_FILE = '/tmp/pi-session-analysis/report.json';

// 工具统计
const stats = {
    totalSessions: 0,
    totalMessages: 0,
    totalToolCalls: 0,
    tools: {}, // 按工具名称统计
    bashCommands: {}, // bash 工具按具体命令统计
    failures: [], // 失败的调用详情
    errors: [], // 解析错误
};

// 常见的 bash 命令列表（用于识别）
const COMMON_COMMANDS = [
    'cd', 'ls', 'grep', 'find', 'cat', 'head', 'tail',
    'mkdir', 'rm', 'cp', 'mv', 'touch', 'chmod', 'chown',
    'ps', 'top', 'htop', 'kill', 'pkill', 'pgrep',
    'git', 'npm', 'node', 'python', 'python3', 'pip',
    'curl', 'wget', 'ssh', 'scp', 'rsync', 'tar', 'zip', 'unzip',
    'vim', 'vi', 'nano', 'code', 'echo', 'printf',
    'df', 'du', 'free', 'uptime', 'whoami', 'id',
    'which', 'whereis', 'locate', 'type',
    'sort', 'uniq', 'wc', 'awk', 'sed', 'cut', 'tr',
    'xargs', 'tee', 'less', 'more', 'watch',
    'docker', 'kubectl', 'terraform', 'ansible',
    'go', 'rustc', 'cargo', 'javac', 'java',
    'bash', 'sh', 'zsh', 'fish',
    'pnpm', 'yarn', 'npx', 'tsx', 'tsc',
    'rg', 'fd', 'fzf', 'bat', 'exa', 'lsd',
    'jq', 'yq', 'xq',
    'systemctl', 'service', 'journalctl',
    'apt', 'apt-get', 'yum', 'dnf', 'pacman',
    'cargo', 'rustc', 'go', 'gofmt',
];

// 解析 bash 命令
function parseBashCommand(command) {
    if (!command || typeof command !== 'string') {
        return { command: 'unknown', fullCommand: command || '' };
    }
    
    // 清理命令字符串
    const cleanCmd = command.trim().replace(/^[`$]+|[`$]+$/g, '');
    
    // 尝试提取主要命令
    // 处理管道、重定向等
    const firstPart = cleanCmd.split(/[|;>&]|\|\||&&/)[0].trim();
    
    // 处理变量赋值（如 VAR=value command）
    const withoutEnv = firstPart.replace(/^[A-Za-z_][A-Za-z0-9_]*=[^\s]*\s+/, '');
    
    // 提取命令名
    const parts = withoutEnv.split(/\s+/);
    let cmd = parts[0];
    
    // 处理 sudo
    if (cmd === 'sudo' && parts.length > 1) {
        cmd = parts[1];
    }
    
    // 去除路径，只保留命令名
    cmd = path.basename(cmd);
    
    // 检查是否是常见命令
    if (COMMON_COMMANDS.includes(cmd)) {
        return { command: cmd, fullCommand: cleanCmd };
    }
    
    // 如果不是常见命令，返回原始命令
    return { command: cmd || 'unknown', fullCommand: cleanCmd };
}

// 处理单个 session 文件
function processSessionFile(filePath) {
    const fileName = path.basename(filePath);
    stats.totalSessions++;
    
    let content;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
        stats.errors.push({ file: fileName, error: `读取失败: ${err.message}` });
        return;
    }
    
    const lines = content.split('\n').filter(line => line.trim());
    
    // 第一遍：收集所有 toolCall
    const toolCalls = new Map(); // toolId -> {name, args}
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let entry;
        try {
            entry = JSON.parse(line);
        } catch (err) {
            continue;
        }
        
        if (entry.type !== 'message') continue;
        
        const message = entry.message;
        if (!message || !message.content) continue;
        
        // 收集 assistant 消息中的 toolCall
        if (message.role === 'assistant' && Array.isArray(message.content)) {
            for (const item of message.content) {
                if (item.type === 'toolCall' || item.type === 'tool_use') {
                    const toolName = item.name || 'unknown';
                    const toolId = item.id || 'unknown';
                    
                    stats.totalToolCalls++;
                    
                    // 初始化工具统计
                    if (!stats.tools[toolName]) {
                        stats.tools[toolName] = {
                            calls: 0,
                            failures: 0,
                            examples: [],
                        };
                    }
                    stats.tools[toolName].calls++;
                    
                    // 记录 toolCall 信息
                    toolCalls.set(toolId, {
                        name: toolName,
                        args: item.arguments,
                        file: fileName,
                    });
                    
                    // 对于 bash 工具，分析具体命令
                    if (toolName === 'bash' && item.arguments) {
                        const cmd = parseBashCommand(item.arguments.command);
                        
                        if (!stats.bashCommands[cmd.command]) {
                            stats.bashCommands[cmd.command] = {
                                calls: 0,
                                failures: 0,
                                examples: [],
                            };
                        }
                        stats.bashCommands[cmd.command].calls++;
                        
                        // 保存示例（限制数量）
                        if (stats.bashCommands[cmd.command].examples.length < 3) {
                            stats.bashCommands[cmd.command].examples.push({
                                command: cmd.fullCommand,
                                file: fileName,
                                toolId: toolId,
                            });
                        }
                    }
                    
                    // 保存工具示例
                    if (stats.tools[toolName].examples.length < 3) {
                        stats.tools[toolName].examples.push({
                            arguments: item.arguments,
                            file: fileName,
                            toolId: toolId,
                        });
                    }
                }
            }
        }
        
        stats.totalMessages++;
    }
    
    // 第二遍：处理 toolResult（判断成功/失败）
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        let entry;
        try {
            entry = JSON.parse(line);
        } catch (err) {
            continue;
        }
        
        if (entry.type !== 'message') continue;
        
        const message = entry.message;
        if (!message) continue;
        
        // 处理 toolResult
        if ((message.role === 'tool' || message.type === 'toolResult') && message.toolCallId) {
            const toolCallId = message.toolCallId;
            const isError = message.isError === true;
            
            // 查找对应的 toolCall
            const toolCall = toolCalls.get(toolCallId);
            if (toolCall) {
                const toolName = toolCall.name;
                
                if (isError) {
                    stats.tools[toolName].failures++;
                    
                    // 记录失败详情
                    stats.failures.push({
                        tool: toolName,
                        toolCallId: toolCallId,
                        file: toolCall.file,
                        error: extractError(message.content),
                        timestamp: entry.timestamp,
                    });
                    
                    // 如果是 bash 失败，记录具体命令
                    if (toolName === 'bash' && toolCall.args) {
                        const cmd = parseBashCommand(toolCall.args.command);
                        if (stats.bashCommands[cmd.command]) {
                            stats.bashCommands[cmd.command].failures++;
                        }
                    }
                }
            }
        }
    }
}

// 提取错误信息
function extractError(content) {
    if (!content) return 'Unknown error';
    
    if (typeof content === 'string') {
        if (content.includes('Error:') || content.includes('error:')) {
            const match = content.match(/(?:Error|error):\s*([^\n]+)/);
            if (match) return match[1].substring(0, 200);
        }
        return content.substring(0, 100);
    }
    
    if (Array.isArray(content)) {
        for (const item of content) {
            if (item.type === 'text' && item.text) {
                const text = item.text;
                if (text.includes('Error:') || text.includes('error:')) {
                    const match = text.match(/(?:Error|error):\s*([^\n]+)/);
                    if (match) return match[1].substring(0, 200);
                }
                if (text.includes('失败') || text.includes('错误')) {
                    return text.substring(0, 200);
                }
                return text.substring(0, 100);
            }
        }
    }
    
    return 'Unknown error';
}

// 主函数
function main() {
    console.log('📊 开始分析 session 文件...');
    
    // 获取所有 session 文件
    const sessionDirs = fs.readdirSync(SESSION_DIR)
        .map(name => path.join(SESSION_DIR, name))
        .filter(dir => fs.statSync(dir).isDirectory());
    
    let totalFiles = 0;
    for (const dir of sessionDirs) {
        const files = fs.readdirSync(dir)
            .filter(name => name.endsWith('.jsonl'))
            .map(name => path.join(dir, name));
        
        for (const file of files) {
            processSessionFile(file);
            totalFiles++;
            
            if (totalFiles % 50 === 0) {
                console.log(`  已处理 ${totalFiles} 个文件...`);
            }
        }
    }
    
    console.log(`✅ 完成！共处理 ${totalFiles} 个文件`);
    
    // 计算成功率
    for (const toolName in stats.tools) {
        const tool = stats.tools[toolName];
        const success = tool.calls - tool.failures;
        tool.success = success;
        tool.successRate = tool.calls > 0 
            ? ((success / tool.calls) * 100).toFixed(2)
            : '0.00';
    }
    
    for (const cmd in stats.bashCommands) {
        const command = stats.bashCommands[cmd];
        const success = command.calls - command.failures;
        command.success = success;
        command.successRate = command.calls > 0
            ? ((success / command.calls) * 100).toFixed(2)
            : '0.00';
    }
    
    // 保存结果
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(stats, null, 2));
    console.log(`📁 详细报告已保存: ${OUTPUT_FILE}`);
    
    return stats;
}

// 运行
const result = main();

// 打印摘要
console.log('\n' + '='.repeat(60));
console.log('📈 统计摘要');
console.log('='.repeat(60));
console.log(`📁 Session 文件数: ${result.totalSessions}`);
console.log(`💬 总消息数: ${result.totalMessages}`);
console.log(`🔧 总工具调用: ${result.totalToolCalls}`);
console.log(`❌ 失败调用: ${result.failures.length}`);
console.log(`⚠️ 解析错误: ${result.errors.length}`);
NODE_SCRIPT

# 运行分析脚本
echo "🚀 开始分析..."
node "$OUTPUT_DIR/analyze.js"

# 生成详细报告
echo ""
echo "======================================"
echo "📊 详细报告"
echo "======================================"

cat > "$OUTPUT_DIR/report.js" << 'REPORT_JS'
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/pi-session-analysis/report.json', 'utf-8'));

function pad(str, len) {
    return String(str).padEnd(len).substring(0, len);
}

function padStart(str, len) {
    return String(str).padStart(len).substring(0, len);
}

console.log('\n' + '='.repeat(90));
console.log('🔧 工具调用统计（按调用次数排序）');
console.log('='.repeat(90));

const tools = Object.entries(data.tools)
    .sort((a, b) => b[1].calls - a[1].calls);

console.log('\n📌 总体情况:');
console.log(`   工具类型数: ${tools.length}`);
console.log(`   总调用次数: ${data.totalToolCalls}`);
console.log(`   失败次数: ${data.failures.length}`);
const overallSuccess = data.totalToolCalls > 0 
    ? ((1 - data.failures.length / data.totalToolCalls) * 100).toFixed(2)
    : '100.00';
console.log(`   整体成功率: ${overallSuccess}%`);

console.log('\n📋 各工具详情:');
console.log('─'.repeat(90));
console.log(`${pad('工具名', 18)} ${padStart('调用次数', 12)} ${padStart('成功', 10)} ${padStart('失败', 10)} ${padStart('成功率', 12)}`);
console.log('─'.repeat(90));

for (const [name, stat] of tools) {
    const success = stat.success || 0;
    const failures = stat.failures || 0;
    const rate = stat.successRate || '0.00';
    const rateStr = rate >= 95 ? `✅ ${rate}%` : rate >= 80 ? `⚠️  ${rate}%` : `❌ ${rate}%`;
    console.log(`${pad(name, 18)} ${padStart(stat.calls, 12)} ${padStart(success, 10)} ${padStart(failures, 10)} ${padStart(rateStr, 12)}`);
}

console.log('\n' + '='.repeat(90));
console.log('🖥️  Bash 命令统计（Top 30）');
console.log('='.repeat(90));

const bashCmds = Object.entries(data.bashCommands)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 30);

console.log('\n📋 命令详情:');
console.log('─'.repeat(90));
console.log(`${pad('命令', 18)} ${padStart('调用次数', 12)} ${padStart('成功', 10)} ${padStart('失败', 10)} ${padStart('成功率', 12)}`);
console.log('─'.repeat(90));

for (const [cmd, stat] of bashCmds) {
    const failures = stat.failures || 0;
    const success = stat.success || 0;
    const rate = stat.successRate || '0.00';
    const rateStr = rate >= 95 ? `✅ ${rate}%` : rate >= 80 ? `⚠️  ${rate}%` : `❌ ${rate}%`;
    console.log(`${pad(cmd, 18)} ${padStart(stat.calls, 12)} ${padStart(success, 10)} ${padStart(failures, 10)} ${padStart(rateStr, 12)}`);
}

console.log('\n' + '='.repeat(90));
console.log('❌ 失败分析');
console.log('='.repeat(90));

if (data.failures.length === 0) {
    console.log('\n✅ 太棒了！没有发现失败的工具调用。');
} else {
    // 统计失败次数
    const failureStats = {};
    for (const failure of data.failures) {
        const key = failure.tool;
        if (!failureStats[key]) {
            failureStats[key] = { count: 0, examples: [] };
        }
        failureStats[key].count++;
        if (failureStats[key].examples.length < 2) {
            failureStats[key].examples.push(failure);
        }
    }

    const sortedFailures = Object.entries(failureStats)
        .sort((a, b) => b[1].count - a[1].count);

    console.log(`\n共发现 ${data.failures.length} 次失败调用，涉及 ${sortedFailures.length} 个工具:`);
    console.log('─'.repeat(90));
    
    for (const [tool, info] of sortedFailures) {
        console.log(`\n🔴 ${tool}: ${info.count} 次失败`);
        if (info.examples.length > 0) {
            console.log('   失败示例:');
            for (const example of info.examples) {
                console.log(`     - 错误: ${example.error.substring(0, 80)}`);
                console.log(`       文件: ${example.file}`);
            }
        }
    }
}

console.log('\n' + '='.repeat(90));
console.log('💡 改进建议');
console.log('='.repeat(90));

const suggestions = [];

// 1. 高失败率工具
for (const [name, stat] of tools) {
    const rate = parseFloat(stat.successRate);
    if (rate < 95 && stat.calls > 10) {
        suggestions.push({
            type: '高失败率',
            tool: name,
            priority: '高',
            message: `${name} 工具失败率 ${(100-rate).toFixed(1)}%，建议检查参数验证和错误处理`,
        });
    }
}

// 2. Bash 命令失败
const failedBash = Object.entries(data.bashCommands)
    .filter(([_, stat]) => stat.failures > 0)
    .sort((a, b) => b[1].failures - a[1].failures)
    .slice(0, 5);

for (const [cmd, stat] of failedBash) {
    if (stat.failures > 2) {
        suggestions.push({
            type: '命令失败',
            tool: `bash:${cmd}`,
            priority: '中',
            message: `${cmd} 命令失败 ${stat.failures} 次，建议添加前置检查（如路径存在性、权限等）`,
        });
    }
}

// 3. 使用频率建议
if (data.bashCommands['rm'] && data.bashCommands['rm'].calls > 20) {
    suggestions.push({
        type: '风险提示',
        tool: 'bash:rm',
        priority: '中',
        message: `rm 命令使用 ${data.bashCommands['rm'].calls} 次，建议添加确认提示或备份机制`,
    });
}

if (data.bashCommands['sudo'] && data.bashCommands['sudo'].calls > 10) {
    suggestions.push({
        type: '安全提示',
        tool: 'bash:sudo',
        priority: '低',
        message: `sudo 命令使用 ${data.bashCommands['sudo'].calls} 次，建议检查是否真的需要 root 权限`,
    });
}

// 4. 高频使用建议
if (data.bashCommands['cd'] && data.bashCommands['cd'].calls > 100) {
    suggestions.push({
        type: '优化建议',
        tool: 'bash:cd',
        priority: '低',
        message: `cd 命令使用 ${data.bashCommands['cd'].calls} 次，考虑使用绝对路径减少目录切换`,
    });
}

// 输出建议
if (suggestions.length === 0) {
    console.log('\n✅ 整体工具调用健康状况良好！未发现明显问题。');
} else {
    const priorityOrder = { '高': 0, '中': 1, '低': 2 };
    suggestions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    
    for (let i = 0; i < suggestions.length; i++) {
        const s = suggestions[i];
        const icon = s.priority === '高' ? '🔴' : s.priority === '中' ? '🟡' : '🟢';
        console.log(`\n${i + 1}. ${icon} [${s.priority}] ${s.tool}`);
        console.log(`   ${s.message}`);
    }
}

console.log('\n' + '='.repeat(90));
console.log('📊 使用模式分析');
console.log('='.repeat(90));

// 分析使用模式
const totalBash = data.tools['bash']?.calls || 0;
const totalRead = data.tools['read']?.calls || 0;
const totalWrite = data.tools['write']?.calls || 0;
const totalEdit = data.tools['edit']?.calls || 0;

console.log('\n📁 文件操作分布:');
if (data.totalToolCalls > 0) {
    console.log(`   Bash 命令:   ${padStart(totalBash, 8)} (${((totalBash/data.totalToolCalls)*100).toFixed(1)}%)`);
    console.log(`   读取文件:    ${padStart(totalRead, 8)} (${((totalRead/data.totalToolCalls)*100).toFixed(1)}%)`);
    console.log(`   写入文件:    ${padStart(totalWrite, 8)} (${((totalWrite/data.totalToolCalls)*100).toFixed(1)}%)`);
    console.log(`   编辑文件:    ${padStart(totalEdit, 8)} (${((totalEdit/data.totalToolCalls)*100).toFixed(1)}%)`);
}

console.log('\n🔝 Top 5 Bash 命令:');
const topBash = Object.entries(data.bashCommands)
    .sort((a, b) => b[1].calls - a[1].calls)
    .slice(0, 5);
for (let i = 0; i < topBash.length; i++) {
    const [cmd, stat] = topBash[i];
    console.log(`   ${i+1}. ${pad(cmd, 12)} ${padStart(stat.calls, 6)} 次`);
}

console.log('\n' + '='.repeat(90));
REPORT_JS

node "$OUTPUT_DIR/report.js"

echo ""
echo "======================================"
echo "✅ 分析完成！"
echo "======================================"
echo ""
echo "📁 输出文件:"
echo "   - JSON 报告: /tmp/pi-session-analysis/report.json"
echo "   - 分析脚本: /root/pi-gateway-standalone/scripts/analyze-sessions.sh"
echo ""
