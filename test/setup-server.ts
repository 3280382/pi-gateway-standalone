/**
 * Vitest Global Setup - Unified Development Environment
 *
 * All testing uses the shared tmux 3-pane development environment.
 * Backend: port 3000, Frontend: port 5173
 * Do NOT start separate test servers.
 */

import { createConnection } from "node:net";
import { setTimeout } from "node:timers/promises";

const BACKEND_PORT = 3000;
const FRONTEND_PORT = 5173;

/** Check if a port is already in use */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const conn = createConnection(port, "127.0.0.1");
    conn.on("connect", () => {
      conn.destroy();
      resolve(true);
    });
    conn.on("error", () => resolve(false));
    conn.setTimeout(1000, () => {
      conn.destroy();
      resolve(false);
    });
  });
}

/** Wait for dev server to be ready */
async function waitForDevServer(port: number, label: string, maxWaitMs = 30000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    if (await isPortInUse(port)) {
      console.log(`[GlobalSetup] ${label} is ready on port ${port}`);
      return;
    }
    await setTimeout(500);
  }
  throw new Error(`${label} not available on port ${port} after ${maxWaitMs}ms`);
}

export async function setup(): Promise<void> {
  console.log("[GlobalSetup] Using unified development environment");
  console.log(`[GlobalSetup] Checking backend (port ${BACKEND_PORT})...`);
  await waitForDevServer(BACKEND_PORT, "Backend");

  console.log(`[GlobalSetup] Checking frontend (port ${FRONTEND_PORT})...`);
  await waitForDevServer(FRONTEND_PORT, "Frontend");

  console.log("[GlobalSetup] Development environment ready for testing");
}

export async function teardown(): Promise<void> {
  // Do NOT stop the dev servers - they are managed by tmux
  console.log("[GlobalSetup] Tests complete. Dev servers remain running.");
}
