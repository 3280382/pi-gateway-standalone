#!/usr/bin/env node
/**
 * Tmux 控制器 - 供 AI 程序化控制开发环境
 * 
 * 使用方式:
 * const controller = require('./tmux-controller');
 * await controller.restartFrontend();
 * await controller.clearCache();
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const SESSION_NAME = 'gateway-dev';
const GATEWAY_DIR = '/root/pi-mono/packages/gateway';

// ANSI 颜色
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function exec(cmd, options = {}) {
  try {
    return execSync(cmd, { 
      encoding: 'utf8', 
      cwd: GATEWAY_DIR,
      ...options 
    });
  } catch (e) {
    if (!options.ignoreError) {
      throw e;
    }
    return '';
  }
}

// 检查 tmux 是否安装
function checkTmux() {
  try {
    execSync('which tmux', { encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

// 检查会话是否存在
function sessionExists() {
  try {
    exec(`tmux has-session -t ${SESSION_NAME} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

// 在指定窗格发送按键
function sendKeys(paneIndex, keys) {
  exec(`tmux send-keys -t ${SESSION_NAME}:0.${paneIndex} ${keys}`);
}

// 在指定窗格执行命令
function runInPane(paneIndex, command) {
  exec(`tmux send-keys -t ${SESSION_NAME}:0.${paneIndex} '${command}' C-m`);
}

// 控制器对象
const controller = {
  // 初始化检查
  init() {
    if (!checkTmux()) {
      throw new Error('tmux 未安装，请先安装 tmux');
    }
    log('✅ Tmux 已安装', 'green');
    
    if (!sessionExists()) {
      log('⚠️ Tmux 会话不存在，请先运行: bash scripts/tmux-dev.sh create', 'yellow');
      return false;
    }
    log('✅ Tmux 会话已存在', 'green');
    return true;
  },

  // 创建会话
  createSession() {
    log('创建 tmux 会话...', 'blue');
    try {
      exec(`bash scripts/tmux-dev.sh create`);
      log('✅ 会话创建成功', 'green');
      return true;
    } catch (e) {
      log(`❌ 创建失败: ${e.message}`, 'red');
      return false;
    }
  },

  // 启动前端
  async startFrontend() {
    log('🚀 启动前端服务...', 'blue');
    runInPane(0, 'cd ' + GATEWAY_DIR + ' && npx vite --host 127.0.0.1 --port 5173');
    await sleep(3000);
    
    // 检查是否启动成功
    const health = await this.checkFrontendHealth();
    if (health) {
      log('✅ 前端启动成功', 'green');
    } else {
      log('⚠️ 前端可能未成功启动，请检查窗格 0', 'yellow');
    }
    return health;
  },

  // 启动后端
  async startBackend() {
    log('🚀 启动后端服务...', 'blue');
    runInPane(1, 'cd ' + GATEWAY_DIR + ' && npx tsx watch src/server/server.ts');
    await sleep(5000);
    
    const health = await this.checkBackendHealth();
    if (health) {
      log('✅ 后端启动成功', 'green');
    } else {
      log('⚠️ 后端可能未成功启动，请检查窗格 1', 'yellow');
    }
    return health;
  },

  // 停止前端
  stopFrontend() {
    log('🛑 停止前端服务...', 'yellow');
    sendKeys(0, 'C-c');
    runInPane(0, "echo '前端已停止'");
  },

  // 停止后端
  stopBackend() {
    log('🛑 停止后端服务...', 'yellow');
    sendKeys(1, 'C-c');
    runInPane(1, "echo '后端已停止'");
  },

  // 重启前端
  async restartFrontend() {
    this.stopFrontend();
    await sleep(1000);
    return this.startFrontend();
  },

  // 重启后端
  async restartBackend() {
    this.stopBackend();
    await sleep(1000);
    return this.startBackend();
  },

  // 重启所有
  async restartAll() {
    await this.restartBackend();
    await sleep(1000);
    await this.restartFrontend();
  },

  // 清除 Vite 缓存
  clearCache() {
    log('🧹 清除 Vite 缓存...', 'blue');
    runInPane(2, `cd ${GATEWAY_DIR} && rm -rf node_modules/.vite && echo 'Vite 缓存已清除'`);
    log('✅ 缓存清除命令已发送', 'green');
  },

  // 在 AI 窗格执行命令
  runInAIPane(command) {
    runInPane(2, command);
  },

  // 检查前端健康
  async checkFrontendHealth() {
    try {
      const result = exec('curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173', { timeout: 5000 });
      return result.trim() === '200';
    } catch {
      return false;
    }
  },

  // 检查后端健康
  async checkBackendHealth() {
    try {
      const result = exec('curl -s http://127.0.0.1:3000/api/version', { timeout: 5000 });
      const data = JSON.parse(result);
      return data.pid !== undefined;
    } catch {
      return false;
    }
  },

  // 获取完整状态
  async getStatus() {
    const frontendRunning = (await exec('pgrep -f "vite --host 127.0.0.1" | head -1', { ignoreError: true })).trim();
    const backendRunning = (await exec('pgrep -f "tsx watch src/server/server.ts" | head -1', { ignoreError: true })).trim();
    
    const frontendHealth = await this.checkFrontendHealth();
    const backendHealth = await this.checkBackendHealth();

    return {
      session: sessionExists(),
      frontend: {
        pid: frontendRunning || null,
        healthy: frontendHealth,
        port: 5173
      },
      backend: {
        pid: backendRunning || null,
        healthy: backendHealth,
        port: 3000
      }
    };
  },

  // 打印状态
  async printStatus() {
    const status = await this.getStatus();
    
    console.log('\n=== 开发环境状态 ===\n');
    
    if (!status.session) {
      log('❌ Tmux 会话不存在', 'red');
      return;
    }
    log('✅ Tmux 会话: 运行中', 'green');
    
    console.log('\n前端服务:');
    if (status.frontend.pid) {
      log(`  PID: ${status.frontend.pid}`, 'green');
      log(`  健康: ${status.frontend.healthy ? '✅' : '⚠️'}`, status.frontend.healthy ? 'green' : 'yellow');
    } else {
      log('  状态: 未运行', 'red');
    }
    
    console.log('\n后端服务:');
    if (status.backend.pid) {
      log(`  PID: ${status.backend.pid}`, 'green');
      log(`  健康: ${status.backend.healthy ? '✅' : '⚠️'}`, status.backend.healthy ? 'green' : 'yellow');
    } else {
      log('  状态: 未运行', 'red');
    }
    
    console.log('');
  },

  // 智能修复 - 根据当前状态自动修复问题
  async autoFix() {
    log('🔧 开始自动修复...', 'blue');
    
    const status = await this.getStatus();
    
    if (!status.session) {
      log('创建 tmux 会话...', 'blue');
      this.createSession();
      await sleep(2000);
    }
    
    if (!status.backend.healthy) {
      log('后端未运行，启动中...', 'blue');
      await this.startBackend();
    }
    
    if (!status.frontend.healthy) {
      log('前端未运行，启动中...', 'blue');
      await this.startFrontend();
    }
    
    log('✅ 自动修复完成', 'green');
    await this.printStatus();
  }
};

// 工具函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI 支持
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    switch (command) {
      case 'status':
        await controller.printStatus();
        break;
      case 'create':
        controller.createSession();
        break;
      case 'start':
        controller.init();
        await controller.startBackend();
        await controller.startFrontend();
        break;
      case 'stop':
        controller.stopBackend();
        controller.stopFrontend();
        break;
      case 'restart-frontend':
        controller.init();
        await controller.restartFrontend();
        break;
      case 'restart-backend':
        controller.init();
        await controller.restartBackend();
        break;
      case 'restart':
        controller.init();
        await controller.restartAll();
        break;
      case 'clear-cache':
        controller.init();
        controller.clearCache();
        break;
      case 'autofix':
        await controller.autoFix();
        break;
      case 'run':
        controller.init();
        controller.runInAIPane(args.slice(1).join(' '));
        break;
      default:
        console.log('Tmux 控制器 - AI 用');
        console.log('');
        console.log('用法: node tmux-controller.js <command>');
        console.log('');
        console.log('命令:');
        console.log('  status              显示状态');
        console.log('  create              创建会话');
        console.log('  start               启动所有服务');
        console.log('  stop                停止所有服务');
        console.log('  restart             重启所有服务');
        console.log('  restart-frontend    仅重启前端');
        console.log('  restart-backend     仅重启后端');
        console.log('  clear-cache         清除 Vite 缓存');
        console.log('  autofix             自动修复问题');
        console.log('  run <cmd>           在 AI 窗格执行命令');
        console.log('');
    }
  })();
}

module.exports = controller;
