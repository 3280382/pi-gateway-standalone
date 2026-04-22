/**
 * Vitest Global Setup for Server Tests
 * Starts a shared server instance before all tests
 */

import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { setTimeout } from "node:timers/promises";

let serverProcess: ReturnType<typeof spawn> | null = null;
const PORT = 3200;

/** Check if test port is already in use (non-blocking) */
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

/** Kill process occupying the test port using Termux-compatible methods.
 *  Only targets the test port (3200), never the dev ports (3000/5173). */
async function killPortOccupier(port: number): Promise<void> {
  const inUse = await isPortInUse(port);
  if (!inUse) return;

  console.log(`[GlobalSetup] Port ${port} is occupied, attempting to free it...`);

  // Try Termux-compatible methods in order of preference
  const killers = [
    // fuser is lightweight and often available in Termux
    `fuser -k ${port}/tcp 2>/dev/null || true`,
    // ss is part of iproute2, usually available
    `pid=$(ss -tlnp 2>/dev/null | grep ":${port} " | sed 's/.*pid=\\([0-9]*\\).*/\\1/' | head -1); [ -n "$pid" ] && kill "$pid" 2>/dev/null || true`,
    // netstat fallback
    `pid=$(netstat -tlnp 2>/dev/null | grep ":${port} " | awk '{print $7}' | cut -d'/' -f1 | head -1); [ -n "$pid" ] && kill "$pid" 2>/dev/null || true`,
  ];

  for (const cmd of killers) {
    try {
      await new Promise<void>((resolve) => {
        const p = spawn("sh", ["-c", cmd], { stdio: "ignore" });
        p.on("close", () => resolve());
        p.on("error", () => resolve());
      });
      await setTimeout(300);
      if (!(await isPortInUse(port))) {
        console.log(`[GlobalSetup] Port ${port} freed.`);
        return;
      }
    } catch {
      // Try next method
    }
  }

  console.warn(`[GlobalSetup] Warning: could not free port ${port}. Test server may fail to start.`);
}

export async function setup(): Promise<void> {
  console.log("[GlobalSetup] Starting test server on port", PORT);

  // Only kill processes on the specific test port, never the dev server (3000/5173)
  await killPortOccupier(PORT);
  await setTimeout(500);

  return new Promise((resolve, reject) => {
    serverProcess = spawn("npx", ["tsx", "src/server/server.ts"], {
      env: {
        ...process.env,
        PORT: String(PORT),
        NODE_ENV: "test",
      },
      cwd: "/root/pi-gateway-standalone",
      detached: false,
    });

    let output = "";
    let resolved = false;

    const checkReady = (data: Buffer) => {
      const str = data.toString();
      output += str;
      process.stdout.write(str);

      if (
        !resolved &&
        (output.includes("Web UI:") ||
          output.includes("Server ready") ||
          output.includes(`port ${PORT}`))
      ) {
        resolved = true;
        console.log(`\n[GlobalSetup] Server ready on port ${PORT}`);
        setTimeout(2000).then(resolve);
      }
    };

    serverProcess.stdout?.on("data", checkReady);
    serverProcess.stderr?.on("data", checkReady);

    serverProcess.on("error", (err) => {
      console.error("[GlobalSetup] Server error:", err);
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });

    serverProcess.on("exit", (code) => {
      if (!resolved && code !== 0) {
        resolved = true;
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // Timeout
    setTimeout(90000).then(() => {
      if (!resolved) {
        resolved = true;
        console.error("[GlobalSetup] Server output:\n", output.slice(-1000));
        reject(new Error("Server startup timeout (90s)"));
      }
    });
  });
}

export async function teardown(): Promise<void> {
  console.log("[GlobalSetup] Stopping test server...");
  if (!serverProcess) return;

  // Graceful shutdown with fallback to force kill
  const pid = serverProcess.pid;
  serverProcess.kill("SIGTERM");
  await setTimeout(2000);

  // Check if process is still alive (Termux-compatible: no `ps -p`, use /proc)
  const stillAlive = pid ? await new Promise<boolean>((resolve) => {
    const check = spawn("sh", ["-c", `[ -d /proc/${pid} ] && echo alive || echo dead`], { stdio: "pipe" });
    let out = "";
    check.stdout?.on("data", (d) => { out += d.toString(); });
    check.on("close", () => resolve(out.includes("alive")));
    check.on("error", () => resolve(false));
  }) : false;

  if (stillAlive && pid) {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // Already dead or permission denied
    }
  }

  serverProcess = null;
}
