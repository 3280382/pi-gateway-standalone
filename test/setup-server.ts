/**
 * Vitest Global Setup for Server Tests
 * Starts a shared server instance before all tests
 */

import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";

let serverProcess: ReturnType<typeof spawn> | null = null;
const PORT = 3456;

export async function setup(): Promise<void> {
  console.log("[GlobalSetup] Starting test server on port", PORT);

  // Kill any existing process on the test port only
  try {
    await new Promise((resolve) => {
      // Only kill processes on the specific test port, not the dev server on port 3000
      const p = spawn("sh", ["-c", `lsof -ti:${PORT} | xargs kill 2>/dev/null || true`], { stdio: "ignore" });
      p.on("close", resolve);
    });
    await setTimeout(500);
  } catch {
    // Ignore
  }

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
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await setTimeout(2000);
    serverProcess.kill("SIGKILL");
  }
}
