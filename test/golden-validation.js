/**
 * 黄金验证测试 - 端到端功能验证
 * 不依赖手动测试，完全自动化验证所有修复
 */

import fs from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import fetch from "node-fetch";

class GoldenValidation {
  constructor() {
    this.baseUrl = 'http://127.0.0.1:5173';
    this.apiUrl = 'http://127.0.0.1:3000';
    this.results = [];
    this.testScript = '/root/test-golden.sh';
  }
  
  async log(message, status = 'INFO') {
    const timestamp = new Date().toISOString().substring(11, 23);
    console.log(`[${timestamp}] ${status} ${message}`);
  }
  
  async setupTestEnvironment() {
    this.log('设置测试环境');
    
    // 创建测试脚本
    const scriptContent = `#!/bin/bash
echo "=== GOLDEN VALIDATION TEST ==="
echo "Test script executed successfully"
echo "Timestamp: $(date)"
echo "Working directory: $(pwd)"
echo "Script path: $0"
echo "Arguments: $@"
for i in {1..3}; do
  echo "Progress: $i/3"
  sleep 0.1
done
echo "=== TEST COMPLETE ==="
`;
    
    fs.writeFileSync(this.testScript, scriptContent);
    fs.chmodSync(this.testScript, 0o755);
    this.log(`创建测试脚本: ${this.testScript}`);
    
    // 创建测试目录结构
    const testDir = '/root/golden-test';
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // 创建测试文件
    const testFiles = [
      { name: 'test.py', content: 'print("Python test script")\nfor i in range(3):\n    print(f"Count: {i}")\n' },
      { name: 'test.js', content: 'console.log("JavaScript test script");\nfor (let i = 0; i < 3; i++) {\n  console.log(`Count: ${i}`);\n}\n' },
      { name: 'README.md', content: '# Golden Test\nThis is a test file for validation.\n' }
    ];
    
    for (const file of testFiles) {
      const filePath = path.join(testDir, file.name);
      fs.writeFileSync(filePath, file.content);
      this.log(`创建测试文件: ${filePath}`);
    }
  }
  
  async testServiceHealth() {
    this.log('测试服务健康状态');
    
    const tests = [
      { name: '前端服务', url: `${this.baseUrl}/` },
      { name: '后端API版本', url: `${this.apiUrl}/api/version` },
      { name: '后端设置', url: `${this.apiUrl}/api/settings` }
    ];
    
    for (const test of tests) {
      try {
        const response = await fetch(test.url, { timeout: 5000 });
        const success = response.status === 200 || response.status === 304;
        
        if (success) {
          this.log(`${test.name}: ✅ 正常 (HTTP ${response.status})`);
        } else {
          this.log(`${test.name}: ❌ 异常 (HTTP ${response.status})`, 'ERROR');
          this.results.push(`${test.name} 服务异常`);
        }
      } catch (error) {
        this.log(`${test.name}: ❌ 错误 (${error.message})`, 'ERROR');
        this.results.push(`${test.name} 连接失败`);
      }
    }
  }
  
  async testFileBrowsing() {
    this.log('测试文件浏览功能');
    
    const paths = [
      { path: '/', description: '根目录' },
      { path: '/root', description: 'Home目录' },
      { path: '/root/golden-test', description: '测试目录' }
    ];
    
    for (const item of paths) {
      try {
        const response = await fetch(`${this.apiUrl}/api/browse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: item.path }),
          timeout: 10000
        });
        
        if (response.ok) {
          const data = await response.json();
          this.log(`${item.description}: ✅ ${data.items.length} 个项目`);
          
          // 验证数据结构
          if (!data.currentPath || !Array.isArray(data.items)) {
            this.log(`${item.description}: ❌ 数据结构异常`, 'ERROR');
            this.results.push(`${item.description} 数据结构异常`);
          }
        } else {
          this.log(`${item.description}: ❌ HTTP ${response.status}`, 'ERROR');
          this.results.push(`${item.description} 浏览失败`);
        }
      } catch (error) {
        this.log(`${item.description}: ❌ ${error.message}`, 'ERROR');
        this.results.push(`${item.description} 浏览错误`);
      }
    }
  }
  
  async testExecuteApi() {
    this.log('测试执行API');
    
    // 测试1: 直接API调用
    try {
      const response = await fetch(`${this.apiUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: `bash "${this.testScript}"`,
          cwd: '/root',
          streaming: true
        }),
        timeout: 15000
      });
      
      if (response.ok) {
        this.log('执行API: ✅ 端点正常');
        
        // 验证响应类型
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('text/plain')) {
          this.log('执行API: ✅ 流式响应类型正确');
        } else {
          this.log('执行API: ⚠️ 响应类型可能不是流式', 'WARN');
        }
      } else {
        this.log(`执行API: ❌ HTTP ${response.status}`, 'ERROR');
        this.results.push('执行API端点失败');
      }
    } catch (error) {
      this.log(`执行API: ❌ ${error.message}`, 'ERROR');
      this.results.push('执行API连接失败');
    }
    
    // 测试2: 通过前端API函数测试（模拟）
    await this.testExecuteFileFunction();
  }
  
  async testExecuteFileFunction() {
    this.log('测试executeFile函数逻辑');
    
    // 读取executeFile函数代码并验证逻辑
    const apiFile = '/root/pi-gateway-standalone/src/client/services/api/fileApi.ts';
    const content = fs.readFileSync(apiFile, 'utf8');
    
    const checks = [
      { name: '构建command参数', pattern: /command:\s*command/, required: true },
      { name: '包含cwd参数', pattern: /cwd:\s*dir/, required: true },
      { name: '包含streaming参数', pattern: /streaming:\s*true/, required: true },
      { name: 'Python文件处理', pattern: /fileName\.endsWith\('\.py'\)/, required: true },
      { name: 'JavaScript文件处理', pattern: /fileName\.endsWith\('\.js'\)/, required: true },
      { name: 'Shell文件处理', pattern: /fileName\.endsWith\('\.sh'\)/, required: true }
    ];
    
    for (const check of checks) {
      const match = check.pattern.test(content);
      if (match) {
        this.log(`${check.name}: ✅ 代码正确`);
      } else if (check.required) {
        this.log(`${check.name}: ❌ 代码缺失`, 'ERROR');
        this.results.push(`executeFile函数缺少${check.name}`);
      } else {
        this.log(`${check.name}: ⚠️ 代码缺失`, 'WARN');
      }
    }
  }
  
  async testComponentIntegrity() {
    this.log('测试组件完整性');
    
    const components = [
      {
        name: 'FileSidebar',
        file: 'src/client/components/files/FileSidebar.tsx',
        checks: [
          { pattern: /loadDirectory\('\/root'\)/, description: '加载/root目录' },
          { pattern: /visible\s*:\s*boolean/, description: '接收visible属性' },
          { pattern: /sidebarClass.*visible.*styles\.visible/, description: 'CSS类处理' }
        ]
      },
      {
        name: 'FileBrowser',
        file: 'src/client/components/files/FileBrowser.tsx',
        checks: [
          { pattern: /externalSidebarVisible/, description: '接收外部侧边栏状态' },
          { pattern: /onToggleSidebar/, description: '接收切换回调' },
          { pattern: /overflow.*auto/, description: '滚动支持' }
        ]
      },
      {
        name: 'App',
        file: 'src/client/App.tsx',
        checks: [
          { pattern: /externalSidebarVisible=\{isSidebarVisible\}/, description: '传递侧边栏状态' },
          { pattern: /onToggleSidebar=\{\(\) => setIsSidebarVisible/, description: '传递切换函数' }
        ]
      }
    ];
    
    for (const component of components) {
      const filePath = path.join('/root/pi-gateway-standalone', component.file);
      
      if (!fs.existsSync(filePath)) {
        this.log(`${component.name}: ❌ 文件不存在`, 'ERROR');
        this.results.push(`${component.name} 组件文件缺失`);
        continue;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      let passed = 0;
      
      for (const check of component.checks) {
        if (check.pattern.test(content)) {
          passed++;
        }
      }
      
      const status = passed === component.checks.length ? '✅' : '❌';
      this.log(`${component.name}: ${status} ${passed}/${component.checks.length} 通过`);
      
      if (passed < component.checks.length) {
        this.results.push(`${component.name} 组件完整性不足`);
      }
    }
  }
  
  async testCssStyles() {
    this.log('测试CSS样式');
    
    const cssFile = '/root/pi-gateway-standalone/src/client/components/files/FileBrowser.module.css';
    const content = fs.readFileSync(cssFile, 'utf8');
    
    const styleChecks = [
      { selector: '.fileBrowserSection', property: 'overflow', value: 'auto', required: true },
      { selector: '.sidebar', property: 'position', value: 'fixed', required: true },
      { selector: '.sidebar', property: 'transform', value: 'translateX', required: true },
      { selector: '.sidebar.visible', property: 'transform', value: 'translateX(0)', required: true },
      { selector: '.sidebar', property: 'z-index', value: '900', required: true },
      { selector: '.sidebar', property: 'overflow-y', value: 'auto', required: true }
    ];
    
    for (const check of styleChecks) {
      const pattern = new RegExp(`${check.selector}[^{]*{[^}]*${check.property}:\\s*([^;]+)`);
      const match = content.match(pattern);
      
      if (match) {
        const value = match[1].trim();
        const correct = value.includes(check.value);
        
        if (correct) {
          this.log(`${check.selector} ${check.property}: ✅ ${value}`);
        } else {
          this.log(`${check.selector} ${check.property}: ❌ 应为${check.value}, 实际${value}`, 'ERROR');
          if (check.required) this.results.push(`${check.selector} CSS样式错误`);
        }
      } else if (check.required) {
        this.log(`${check.selector} ${check.property}: ❌ 未找到`, 'ERROR');
        this.results.push(`${check.selector} CSS属性缺失`);
      }
    }
  }
  
  async testStoreConsistency() {
    this.log('测试Store状态一致性');
    
    const storeFile = '/root/pi-gateway-standalone/src/client/stores/fileStore.ts';
    const content = fs.readFileSync(storeFile, 'utf8');
    
    const checks = [
      { pattern: /currentPath:\s*"\/root"/, description: '初始路径为/root' },
      { pattern: /sidebarVisible:\s*false/, description: '侧边栏默认隐藏' }
    ];
    
    for (const check of checks) {
      if (check.pattern.test(content)) {
        this.log(`Store ${check.description}: ✅`);
      } else {
        this.log(`Store ${check.description}: ❌`, 'ERROR');
        this.results.push(`Store状态不一致: ${check.description}`);
      }
    }
  }
  
  async runSimulatedUserFlow() {
    this.log('运行模拟用户流程');
    
    // 模拟用户操作序列
    const steps = [
      { action: '访问首页', api: 'GET /' },
      { action: '获取工作区', api: 'GET /api/workspace/current' },
      { action: '浏览Home目录', api: 'POST /api/browse {path: "/root"}' },
      { action: '查找测试文件', api: 'POST /api/browse {path: "/root"}' },
      { action: '测试执行端点', api: 'POST /api/execute {command: "echo test", cwd: "/root", streaming: true}' }
    ];
    
    let successCount = 0;
    
    for (const step of steps) {
      try {
        let response;
        
        if (step.api.startsWith('GET')) {
          const endpoint = step.api.split(' ')[1];
          const url = endpoint === '/' ? this.baseUrl : `${this.apiUrl}${endpoint}`;
          response = await fetch(url, { timeout: 5000 });
        } else if (step.api.startsWith('POST')) {
          const endpoint = step.api.split(' ')[1];
          const bodyMatch = step.api.match(/\{([^}]+)\}/);
          
          if (bodyMatch) {
            // 简化解析，实际应使用JSON解析
            const body = bodyMatch[1];
            let jsonBody = {};
            
            if (body.includes('path:')) {
              jsonBody = { path: '/root' };
            } else if (body.includes('command:')) {
              jsonBody = { command: 'echo "simulated test"', cwd: '/root', streaming: true };
            }
            
            response = await fetch(`${this.apiUrl}${endpoint}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(jsonBody),
              timeout: 10000
            });
          }
        }
        
        if (response && (response.status === 200 || response.status === 304)) {
          successCount++;
          this.log(`${step.action}: ✅ 成功`);
        } else {
          this.log(`${step.action}: ❌ 失败`, 'ERROR');
        }
      } catch (error) {
        this.log(`${step.action}: ❌ ${error.message}`, 'ERROR');
      }
      
      await setTimeout(500); // 模拟用户思考时间
    }
    
    const successRate = (successCount / steps.length) * 100;
    this.log(`模拟用户流程: ${successRate.toFixed(0)}% 通过`);
    
    if (successRate < 80) {
      this.results.push('模拟用户流程成功率低');
    }
  }
  
  async run() {
    console.log(`\n${'='.repeat(60)}`);
    console.log('GOLDEN VALIDATION - 端到端功能验证');
    console.log(`${'='.repeat(60)}\n`);
    
    const startTime = Date.now();
    
    try {
      await this.setupTestEnvironment();
      await this.testServiceHealth();
      await this.testFileBrowsing();
      await this.testExecuteApi();
      await this.testExecuteFileFunction();
      await this.testComponentIntegrity();
      await this.testCssStyles();
      await this.testStoreConsistency();
      await this.runSimulatedUserFlow();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n${'='.repeat(60)}`);
      console.log('验证结果汇总');
      console.log('='.repeat(60));
      
      if (this.results.length === 0) {
        console.log('🎉 所有验证通过！');
        console.log(`⏱️  总耗时: ${duration}秒`);
        console.log('\n✅ 验证的功能:');
        console.log('   1. 服务健康状态');
        console.log('   2. 文件浏览API');
        console.log('   3. 执行API端点');
        console.log('   4. executeFile函数逻辑');
        console.log('   5. 组件完整性');
        console.log('   6. CSS样式正确性');
        console.log('   7. Store状态一致性');
        console.log('   8. 模拟用户流程');
        
        console.log('\n✅ 修复的问题:');
        console.log('   • 目录不一致 (左/右面板统一使用/root)');
        console.log('   • 滚动功能 (CSS overflow修复)');
        console.log('   • 执行API格式 (前端发送正确格式)');
        console.log('   • 侧边栏overlay设计 (position: fixed, 动画)');
        
        console.log('\n📊 技术指标:');
        console.log('   • 前端服务: http://127.0.0.1:5173/');
        console.log('   • 后端服务: http://127.0.0.1:3000/');
        console.log('   • API端点: 全部正常');
        console.log('   • 组件代码: 完整性验证通过');
        console.log('   • CSS样式: 符合overlay设计');
        
        return { success: true, duration, issues: [] };
      } else {
        console.log(`❌ 发现 ${this.results.length} 个问题:`);
        this.results.forEach((_issue, index) => {
          console.log(`   ${index + 1}.
