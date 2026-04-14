#!/usr/bin/env python3
"""
Pi Session 工具调用分析脚本
分析所有历史 session 文件中的工具调用情况
"""

import json
import os
import sys
from pathlib import Path
from collections import defaultdict, Counter
from datetime import datetime
import re

class SessionAnalyzer:
    def __init__(self, session_dir):
        self.session_dir = Path(session_dir)
        self.stats = {
            'total_sessions': 0,
            'total_messages': 0,
            'tool_calls': defaultdict(lambda: {'count': 0, 'failures': 0}),
            'bash_commands': defaultdict(lambda: {'count': 0, 'failures': 0, 'examples': []}),
            'failures_by_tool': defaultdict(lambda: {'count': 0, 'errors': []}),
            'bash_failures': defaultdict(lambda: {'count': 0, 'errors': []}),
            'timeline': defaultdict(int),  # 按日期的调用统计
        }
        
    def extract_bash_command(self, command):
        """提取 bash 命令的基础命令（第一个单词）"""
        if not command:
            return 'unknown'
        
        # 处理常见的 shell 语法
        command = command.strip()
        
        # 处理变量赋值（如 VAR=value command）
        while '=' in command.split()[0] if command else False:
            parts = command.split()
            if '=' in parts[0] and not parts[0].startswith('export '):
                command = ' '.join(parts[1:])
            else:
                break
        
        # 处理管道、分号、逻辑运算符
        for sep in ['|', ';', '&&', '||']:
            if sep in command:
                command = command.split(sep)[0].strip()
        
        # 处理重定向
        command = re.sub(r'[<>].*$', '', command).strip()
        
        # 提取第一个单词
        parts = command.split()
        if not parts:
            return 'unknown'
        
        base_cmd = parts[0].strip()
        
        # 处理以 - 开头的参数（如 -c 应该归类为 shell 内置）
        if base_cmd.startswith('-'):
            return 'shell_builtin'
        
        # 处理相对路径执行（如 ./script.sh）
        if base_cmd.startswith('./'):
            return 'execute_script'
        
        # 处理绝对路径
        if base_cmd.startswith('/'):
            return base_cmd.split('/')[-1]
        
        return base_cmd
    
    def analyze_file(self, filepath):
        """分析单个 session 文件"""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    
                    try:
                        data = json.loads(line)
                        self.process_entry(data, filepath)
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"Warning: Error reading {filepath}: {e}")
    
    def process_entry(self, data, filepath):
        """处理单个 JSON 条目"""
        entry_type = data.get('type')
        
        if entry_type == 'session':
            self.stats['total_sessions'] += 1
            
        elif entry_type == 'message':
            self.stats['total_messages'] += 1
            
            message = data.get('message', {})
            content = message.get('content', [])
            
            if not isinstance(content, list):
                return
            
            for item in content:
                item_type = item.get('type')
                
                # 工具调用统计
                if item_type in ['toolCall', 'tool_use']:
                    tool_name = item.get('name') or item.get('toolName') or 'unknown'
                    self.stats['tool_calls'][tool_name]['count'] += 1
                    
                    # 记录时间线
                    timestamp = data.get('timestamp', '')
                    if timestamp:
                        try:
                            date = timestamp[:10]  # YYYY-MM-DD
                            self.stats['timeline'][date] += 1
                        except:
                            pass
                    
                    # bash 命令详细统计
                    if tool_name == 'bash':
                        args = item.get('arguments', {})
                        if isinstance(args, str):
                            try:
                                args = json.loads(args)
                            except:
                                args = {}
                        
                        command = args.get('command', '')
                        base_cmd = self.extract_bash_command(command)
                        
                        self.stats['bash_commands'][base_cmd]['count'] += 1
                        
                        # 保存示例
                        examples = self.stats['bash_commands'][base_cmd]['examples']
                        if len(examples) < 3 and command:
                            examples.append(command[:150])
                
                # 工具结果统计（失败分析）
                elif item_type in ['toolResult', 'tool_result']:
                    tool_name = item.get('toolName') or 'unknown'
                    is_error = item.get('isError', False)
                    
                    if is_error:
                        self.stats['tool_calls'][tool_name]['failures'] += 1
                        
                        # 记录错误详情
                        error_info = {
                            'tool': tool_name,
                            'error_text': '',
                            'tool_call_id': item.get('toolCallId', ''),
                        }
                        
                        content_items = item.get('content', [])
                        if isinstance(content_items, list):
                            error_text = ' '.join([
                                c.get('text', '') for c in content_items 
                                if c.get('type') == 'text'
                            ])
                            error_info['error_text'] = error_text[:200]
                        
                        # 记录到失败统计
                        if len(self.stats['failures_by_tool'][tool_name]['errors']) < 5:
                            self.stats['failures_by_tool'][tool_name]['errors'].append(error_info)
                        
                        self.stats['failures_by_tool'][tool_name]['count'] += 1
                        
                        # bash 失败特别处理
                        if tool_name == 'bash':
                            self.stats['bash_commands']['(failed)']['count'] += 1
    
    def analyze_all(self):
        """分析所有 session 文件"""
        print(f"🔍 扫描目录: {self.session_dir}")
        
        jsonl_files = list(self.session_dir.rglob("*.jsonl"))
        total_files = len(jsonl_files)
        
        print(f"📁 找到 {total_files} 个 session 文件")
        print("⏳ 正在分析...")
        
        for i, filepath in enumerate(jsonl_files, 1):
            if i % 50 == 0:
                print(f"  进度: {i}/{total_files} ({i/total_files*100:.1f}%)")
            self.analyze_file(filepath)
        
        print(f"✅ 分析完成！")
        
    def generate_report(self, output_dir):
        """生成分析报告"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        # 保存 JSON 数据
        json_file = output_dir / 'stats.json'
        with open(json_file, 'w', encoding='utf-8') as f:
            json.dump(self.stats, f, indent=2, default=str)
        
        # 生成 Markdown 报告
        report_file = output_dir / 'analysis-report.md'
        with open(report_file, 'w', encoding='utf-8') as f:
            self.write_report(f)
        
        return report_file, json_file
    
    def write_report(self, f):
        """写入 Markdown 报告"""
        # 标题
        f.write("# Pi Session 工具调用分析报告\n\n")
        f.write(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        
        # 概览
        f.write("## 📊 统计概览\n\n")
        f.write("| 指标 | 数值 |\n")
        f.write("|------|------|\n")
        f.write(f"| Session 文件总数 | {self.stats['total_sessions']} |\n")
        f.write(f"| 消息总数 | {self.stats['total_messages']} |\n")
        
        # 计算总工具调用数
        total_tool_calls = sum(v['count'] for v in self.stats['tool_calls'].values())
        total_failures = sum(v['failures'] for v in self.stats['tool_calls'].values())
        f.write(f"| 工具调用总数 | {total_tool_calls} |\n")
        f.write(f"| 失败次数 | {total_failures} |\n")
        if total_tool_calls > 0:
            f.write(f"| 整体成功率 | {(1 - total_failures/total_tool_calls)*100:.1f}% |\n")
        f.write("\n")
        
        # 工具调用统计
        f.write("## 🛠️ 工具调用统计\n\n")
        f.write("| 工具名称 | 调用次数 | 失败次数 | 成功率 | 占比 |\n")
        f.write("|---------|---------|---------|--------|------|\n")
        
        sorted_tools = sorted(
            self.stats['tool_calls'].items(), 
            key=lambda x: x[1]['count'], 
            reverse=True
        )
        
        for tool_name, data in sorted_tools:
            count = data['count']
            failures = data['failures']
            success_rate = ((count - failures) / count * 100) if count > 0 else 100
            percentage = (count / total_tool_calls * 100) if total_tool_calls > 0 else 0
            f.write(f"| {tool_name} | {count} | {failures} | {success_rate:.1f}% | {percentage:.1f}% |\n")
        f.write("\n")
        
        # Bash 命令详细统计
        f.write("## 🔧 Bash 命令详细统计\n\n")
        f.write("> Bash 工具按具体命令统计（而非单一工具）\n\n")
        f.write("| 命令 | 调用次数 | 占比 | 成功率 | 示例 |\n")
        f.write("|------|---------|------|--------|------|\n")
        
        bash_total = self.stats['tool_calls'].get('bash', {}).get('count', 1)
        sorted_bash = sorted(
            self.stats['bash_commands'].items(),
            key=lambda x: x[1]['count'],
            reverse=True
        )
        
        for cmd, data in sorted_bash[:50]:  # 前50个
            count = data['count']
            failures = data['failures']
            percentage = (count / bash_total * 100) if bash_total > 0 else 0
            success_rate = ((count - failures) / count * 100) if count > 0 else 100
            example = data['examples'][0] if data['examples'] else ''
            example = example.replace('|', '\\|')[:60]
            f.write(f"| `{cmd}` | {count} | {percentage:.1f}% | {success_rate:.1f}% | `{example}` |\n")
        f.write("\n")
        
        # 失败分析
        f.write("## ❌ 失败分析\n\n")
        
        if self.stats['failures_by_tool']:
            f.write("### 按工具统计失败\n\n")
            f.write("| 工具 | 失败次数 | 主要错误类型 |\n")
            f.write("|------|---------|-------------|\n")
            
            sorted_failures = sorted(
                self.stats['failures_by_tool'].items(),
                key=lambda x: x[1]['count'],
                reverse=True
            )
            
            for tool_name, data in sorted_failures:
                count = data['count']
                errors = data['errors']
                error_preview = ''
                if errors:
                    error_text = errors[0].get('error_text', '')[:50]
                    error_preview = error_text.replace('|', '\\|')
                f.write(f"| {tool_name} | {count} | {error_preview}... |\n")
            f.write("\n")
            
            # 详细错误信息
            f.write("### 详细错误示例\n\n")
            for tool_name, data in sorted_failures[:10]:
                if data['errors']:
                    f.write(f"#### {tool_name} ({data['count']} 次失败)\n\n")
                    for i, error in enumerate(data['errors'][:3], 1):
                        error_text = error.get('error_text', 'No details')
                        f.write(f"{i}. ```\n{error_text}\n```\n\n")
                    f.write("\n")
        else:
            f.write("✅ 没有发现工具调用失败！\n\n")
        
        # 使用趋势
        if self.stats['timeline']:
            f.write("## 📈 使用趋势（最近30天）\n\n")
            f.write("| 日期 | 调用次数 |\n")
            f.write("|------|---------|\n")
            
            sorted_dates = sorted(self.stats['timeline'].items(), reverse=True)[:30]
            for date, count in sorted_dates:
                f.write(f"| {date} | {count} |\n")
            f.write("\n")
        
        # 改善建议
        f.write("## 💡 改善建议\n\n")
        
        # 根据数据生成建议
        top_tools = [t for t, _ in sorted_tools[:3]]
        top_bash = [c for c, _ in sorted_bash[:5] if c != '(failed)']
        
        f.write("### 1. 高频工具优化\n\n")
        
        if 'read' in top_tools:
            f.write("**read**: 文件读取是最常用的工具\n")
            f.write("- 建议：增加文件缓存机制，避免重复读取相同文件\n")
            f.write("- 建议：大文件分片读取，减少内存占用\n")
            f.write("- 建议：监控频繁读取的文件，可能需要常驻内存\n\n")
        
        if 'bash' in top_tools:
            f.write("**bash**: 命令执行工具\n")
            f.write("- 建议：高频命令（如 cd, grep, ls）可封装为专用工具\n")
            f.write("- 建议：命令执行超时机制，防止长时间挂起\n")
            f.write("- 建议：危险命令（rm -rf, > 等）二次确认或限制\n")
            f.write("- 建议：命令结果缓存，相同命令短时间内复用\n\n")
        
        if 'write' in top_tools:
            f.write("**write**: 文件写入\n")
            f.write("- 建议：批量写入支持，减少 IO 次数\n")
            f.write("- 建议：自动备份机制，防止数据丢失\n")
            f.write("- 建议：写入前校验，避免覆盖重要文件\n\n")
        
        if 'edit' in top_tools:
            f.write("**edit**: 文件编辑\n")
            f.write("- 建议：增加编辑预览功能，确认后再应用\n")
            f.write("- 建议：支持批量编辑，减少多次调用\n\n")
        
        f.write("### 2. Bash 命令优化建议\n\n")
        f.write(f"根据统计，最常用的 bash 命令是: {', '.join(top_bash[:5])}\n\n")
        f.write("建议将这些高频命令封装为专用工具:\n\n")
        
        command_mapping = {
            'cd': ('changeDirectory', '工作目录管理，支持历史记录'),
            'ls': ('listDirectory', '目录列表，支持过滤和排序'),
            'grep': ('searchInFiles', '文件内容搜索，支持正则'),
            'find': ('findFiles', '文件查找，支持复杂条件'),
            'cat': ('readFile', '文件读取，支持大文件'),
            'curl': ('httpRequest', 'HTTP 请求，支持多种方法'),
            'sed': ('replaceText', '文本替换，支持正则'),
        }
        
        for cmd in top_bash[:10]:
            if cmd in command_mapping:
                tool_name, desc = command_mapping[cmd]
                f.write(f"- `{cmd}` → **{tool_name}**: {desc}\n")
        
        f.write("\n")
        
        # 失败分析建议
        if self.stats['failures_by_tool']:
            f.write("### 3. 失败率优化\n\n")
            
            for tool_name, data in sorted_failures[:5]:
                if data['errors']:
                    errors = data['errors']
                    error_texts = [e.get('error_text', '') for e in errors]
                    
                    f.write(f"**{tool_name}** ({data['count']} 次失败):\n")
                    
                    # 分析错误类型
                    if any('ENOENT' in e for e in error_texts):
                        f.write("- 路径不存在错误: 调用前验证路径存在性\n")
                    if any('EACCES' in e or 'Permission' in e for e in error_texts):
                        f.write("- 权限错误: 检查文件权限，必要时提示用户\n")
                    if any('not found' in e.lower() for e in error_texts):
                        f.write("- 命令不存在: 检查命令可用性，提供安装建议\n")
                    if any('exit code' in e.lower() for e in error_texts):
                        f.write("- 命令执行失败: 检查命令参数和工作目录\n")
                    
                    f.write("\n")
        
        f.write("### 4. 系统架构建议\n\n")
        f.write("- **工具调用追踪**: 实现调用链追踪，便于问题定位\n")
        f.write("- **性能监控**: 监控工具调用耗时，识别性能瓶颈\n")
        f.write("- **智能重试**: 对失败工具实现智能重试机制\n")
        f.write("- **结果缓存**: 对幂等操作实现结果缓存\n")
        f.write("- **批量操作**: 支持批量工具调用，减少往返次数\n")
        f.write("- **沙箱执行**: bash 命令在沙箱中执行，提高安全性\n")
        
        f.write("\n---\n\n")
        f.write("📊 详细数据已导出到 `stats.json`\n")


def main():
    # 获取参数
    session_dir = sys.argv[1] if len(sys.argv) > 1 else "/root/.pi/agent/sessions"
    output_dir = sys.argv[2] if len(sys.argv) > 2 else "./session-analysis"
    
    print("=" * 60)
    print("🔍 Pi Session 工具调用分析")
    print("=" * 60)
    print(f"Session 目录: {session_dir}")
    print(f"输出目录: {output_dir}")
    print()
    
    # 创建分析器
    analyzer = SessionAnalyzer(session_dir)
    
    # 执行分析
    analyzer.analyze_all()
    
    # 生成报告
    print("\n📝 正在生成报告...")
    report_file, json_file = analyzer.generate_report(output_dir)
    
    print()
    print("=" * 60)
    print("✅ 分析完成！")
    print("=" * 60)
    print(f"📄 报告: {report_file}")
    print(f"📊 数据: {json_file}")
    print()
    
    # 打印摘要
    print("📈 摘要:")
    print(f"  - Sessions: {analyzer.stats['total_sessions']}")
    print(f"  - Messages: {analyzer.stats['total_messages']}")
    print(f"  - Tool Calls: {sum(v['count'] for v in analyzer.stats['tool_calls'].values())}")
    print(f"  - Unique Tools: {len(analyzer.stats['tool_calls'])}")
    print(f"  - Unique Bash Commands: {len(analyzer.stats['bash_commands'])}")
    
    # 显示 top 5 工具
    print("\n🔝 Top 5 工具:")
    sorted_tools = sorted(analyzer.stats['tool_calls'].items(), key=lambda x: x[1]['count'], reverse=True)
    for i, (tool, data) in enumerate(sorted_tools[:5], 1):
        print(f"  {i}. {tool}: {data['count']} 次")
    
    # 显示 top 5 bash 命令
    print("\n🔝 Top 5 Bash 命令:")
    sorted_bash = sorted(analyzer.stats['bash_commands'].items(), key=lambda x: x[1]['count'], reverse=True)
    for i, (cmd, data) in enumerate(sorted_bash[:5], 1):
        if cmd != '(failed)':
            print(f"  {i}. {cmd}: {data['count']} 次")
    
    print()
    print(f"💡 查看完整报告: cat {report_file}")


if __name__ == "__main__":
    main()
