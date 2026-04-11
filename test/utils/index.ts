/**
 * Test utilities for coordinating with development server
 *
 * BEST PRACTICE for `npm run dev` (tsx watch mode):
 *
 * Problem: tsx watch restarts server on code changes, but restart time varies (1-3s).
 * If tests run before restart completes, they test old code.
 *
 * Solution: PID-based reload detection
 * - tsx watch KILLS the old process and starts a new one
 * - PID is guaranteed to change
 * - Poll /api/version until PID changes
 *
 * Alternative: Use vitest's built-in retry mechanism
 * - Add `{ retry: 2 }` to tests that may hit reload window
 * - Simpler, but slightly slower
 */

const DEFAULT_DEV_PORT = 3000;

/**
 * Get server PID and version info
 */
export async function getServerInfo(
  port: number = DEFAULT_DEV_PORT
): Promise<{ pid: number; startTime: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`http://localhost:${port}/api/version`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Wait for server to reload (PID change)
 * Call this after modifying server code
 *
 * @param previousPid - The PID before code change
 * @param options - Timeout and poll interval
 */
export async function waitForReload(
  previousPid?: number,
  options: { timeout?: number; interval?: number; port?: number } = {}
): Promise<{ pid: number; startTime: number }> {
  const { timeout = 10000, interval = 500, port = DEFAULT_DEV_PORT } = options;
  const start = Date.now();

  // Get initial PID if not provided
  if (!previousPid) {
    const initial = await getServerInfo(port);
    previousPid = initial?.pid;
  }

  console.log(`[Test] Waiting for server reload (PID: ${previousPid} → ?)...`);

  while (Date.now() - start < timeout) {
    const info = await getServerInfo(port);

    if (info && info.pid !== previousPid) {
      console.log(`[Test] Server reloaded (new PID: ${info.pid})`);
      return info;
    }

    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error(`Server did not reload within ${timeout}ms (PID still ${previousPid})`);
}

/**
 * Check if development server is running
 */
export async function isDevServerRunning(port: number = DEFAULT_DEV_PORT): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const response = await fetch(`http://localhost:${port}/api/models`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get the server URL to use for tests
 * Returns port 3000 if dev server is running, otherwise null
 */
export async function getTestServerUrl(): Promise<string | null> {
  if (await isDevServerRunning(DEFAULT_DEV_PORT)) {
    console.log(`[Test] Using existing dev server on port ${DEFAULT_DEV_PORT}`);
    return `http://localhost:${DEFAULT_DEV_PORT}`;
  }
  return null;
}

/**
 * Wait for server to be ready (any version)
 * Use this when you just need the server running, not specifically new code
 */
export async function waitForServer(
  url: string,
  maxAttempts: number = 30,
  interval: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/api/models`, {
        signal: AbortSignal.timeout(2000),
      });
      if (response.ok) {
        return true;
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  return false;
}

/**
 * Development workflow helpers
 */
export const DevWorkflow = {
  /**
   * Call this in test setup if you modified server code
   * Automatically handles initial case (no previous PID)
   */
  async ensureReloaded(port: number = DEFAULT_DEV_PORT) {
    return waitForReload(undefined, { port });
  },

  /**
   * Quick check - just verify server is running
   */
  async isReady(port: number = DEFAULT_DEV_PORT) {
    return isDevServerRunning(port);
  },

  /**
   * Get current server PID for manual tracking
   */
  async getPid(port: number = DEFAULT_DEV_PORT) {
    const info = await getServerInfo(port);
    return info?.pid;
  },
};
