/**
 * Global Test Server - 使用三窗口环境中的现有服务
 *
 * 【三窗口原则】测试脚本不得自行启动新的前端或后端服务器
 * - 开发/测试时必须使用tmux中已运行的服务
 * - 只有发现服务连接不上时，才提示用户重启tmux中的服务
 * - 前端: http://127.0.0.1:5173/ (Vite dev server)
 * - 后端: http://127.0.0.1:3000/ (Node.js server)
 */

// 三窗口环境中的服务地址
const DEV_FRONTEND_URL = "http://127.0.0.1:5173";
const DEV_BACKEND_URL = "http://127.0.0.1:3000";
const DEV_WS_URL = "ws://127.0.0.1:3000/ws";

/**
 * 检查tmux中的服务是否可用
 */
async function checkTmuxServices(): Promise<{ frontend: boolean; backend: boolean }> {
  const results = { frontend: false, backend: false };

  try {
    const frontendRes = await fetch(`${DEV_FRONTEND_URL}/`, { method: "HEAD" });
    results.frontend = frontendRes.ok;
  } catch {
    results.frontend = false;
  }

  try {
    const backendRes = await fetch(`${DEV_BACKEND_URL}/api/health`);
    results.backend = backendRes.ok;
  } catch {
    results.backend = false;
  }

  return results;
}

/**
 * 获取全局服务器状态
 * 【重要】不启动新服务，只检查tmux中现有服务的状态
 */
export async function getGlobalServer(): Promise<{ port: number; isTmux: boolean }> {
  const services = await checkTmuxServices();

  if (!services.backend) {
    console.error("[GlobalServer] ❌ 后端服务未运行！");
    console.error("[GlobalServer] 请在tmux窗口中启动后端服务:");
    console.error("  bash scripts/tmux-dev.sh restart-backend");
    throw new Error("后端服务未运行，请先在tmux中启动服务");
  }

  if (!services.frontend) {
    console.warn("[GlobalServer] ⚠️ 前端服务未运行");
    console.warn("[GlobalServer] 请在tmux窗口中启动前端服务:");
    console.warn("  bash scripts/tmux-dev.sh restart-frontend");
  }

  console.log(`[GlobalServer] ✅ 使用tmux中的服务 - 后端: ${DEV_BACKEND_URL}`);
  return { port: 3000, isTmux: true };
}

/**
 * Get base URL for API requests
 * 【三窗口原则】使用tmux中已运行的后端服务
 */
export function getBaseUrl(): string {
  return DEV_BACKEND_URL;
}

/**
 * Get WebSocket URL
 * 【三窗口原则】使用tmux中已运行的后端服务
 */
export function getWebSocketUrl(): string {
  return DEV_WS_URL;
}

/**
 * Get frontend URL
 * 【三窗口原则】使用tmux中已运行的前端服务
 */
export function getFrontendUrl(): string {
  return DEV_FRONTEND_URL;
}

/**
 * Cleanup global server (call in afterAll)
 * 【三窗口原则】不停止tmux中的服务，保持运行
 */
export async function cleanupGlobalServer(): Promise<void> {
  // 三窗口原则：不停止tmux中的服务
  console.log("[GlobalServer] 保持tmux服务运行");
}

/**
 * Stop global server completely (call at very end)
 * 【三窗口原则】不停止tmux中的服务
 */
export async function stopGlobalServer(): Promise<void> {
  // 三窗口原则：不停止tmux中的服务
  console.log("[GlobalServer] 保持tmux服务运行（不执行停止操作）");
}
