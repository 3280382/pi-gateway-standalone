/**
 * Vitest Global Setup - Development Environment
 *
 * Automatically starts development services before tests if not already running.
 * Backend: port 3000, Frontend: port 5173
 */

import { spawn } from "node:child_process";
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
async function waitForDevServer(port: number, label: string, maxWaitMs = 60000): Promise<void> {
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

/** Start dev services */
async function startDevServices(): Promise<void> {
  console.log("[GlobalSetup] Starting development services...");

  const child = spawn("bash", ["scripts/dev.sh", "start"], {
    cwd: "/root/pi-gateway-standalone",
    detached: true,
    stdio: "ignore",
  });

  child.unref();

  // Wait for services
  await waitForDevServer(BACKEND_PORT, "Backend");
  await waitForDevServer(FRONTEND_PORT, "Frontend");
}

export async function setup(): Promise<void> {
  console.log("[GlobalSetup] Checking development environment...");

  const backendUp = await isPortInUse(BACKEND_PORT);
  const frontendUp = await isPortInUse(FRONTEND_PORT);

  if (!backendUp || !frontendUp) {
    console.log("[GlobalSetup] Services not running, starting them...");
    await startDevServices();
  } else {
    console.log("[GlobalSetup] Development services already running");
  }

  console.log("[GlobalSetup] Development environment ready for testing");
}

export async function teardown(): Promise<void> {
  // Do NOT stop the dev servers - they are shared
  console.log("[GlobalSetup] Tests complete. Dev servers remain running.");
}
