/**
 * Port Usage - System port usage viewer
 * Get all listening ports and their associated processes
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Logger, LogLevel } from "../../lib/utils/logger.js";

const execAsync = promisify(exec);
const logger = new Logger({ level: LogLevel.INFO });

export interface PortUsageInfo {
  protocol: string;
  state: string;
  localAddress: string;
  localPort: number;
  peerAddress: string;
  peerPort: string;
  pid: number | null;
  processName: string | null;
  user: string | null;
  fd: string | null;
}

export interface PortUsageStats {
  total: number;
  tcp: number;
  udp: number;
  listening: number;
  established: number;
}

/**
 * Get all port usage info using ss command
 */
export async function getPortUsageData(): Promise<{
  ports: PortUsageInfo[];
  stats: PortUsageStats;
}> {
  try {
    // Use ss command to get all socket info with process details
    const { stdout } = await execAsync("ss -tunlp 2>/dev/null || ss -tunl 2>/dev/null || echo ''");

    const ports: PortUsageInfo[] = [];
    const lines = stdout.split("\n").filter((line) => line.trim());

    // Skip header line
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parsed = parseSsLine(line);
      if (parsed) {
        ports.push(parsed);
      }
    }

    // If ss -tunlp didn't return process info, try lsof as fallback
    if (ports.length > 0 && ports.every((p) => p.pid === null)) {
      try {
        const { stdout: lsofOutput } = await execAsync(
          "lsof -i -P -n 2>/dev/null | grep -E 'LISTEN|UDP' || echo ''"
        );
        const lsofPorts = parseLsofOutput(lsofOutput);
        mergePortInfo(ports, lsofPorts);
      } catch {
        // lsof failed, use what we have
      }
    }

    // Statistics
    const stats: PortUsageStats = {
      total: ports.length,
      tcp: ports.filter((p) => p.protocol === "tcp").length,
      udp: ports.filter((p) => p.protocol === "udp").length,
      listening: ports.filter((p) => p.state === "LISTEN").length,
      established: ports.filter((p) => p.state === "ESTAB").length,
    };

    return { ports, stats };
  } catch (error) {
    logger.error(`[getPortUsageData] Failed: ${error}`);
    return { ports: [], stats: { total: 0, tcp: 0, udp: 0, listening: 0, established: 0 } };
  }
}

/**
 * Parse a single line of ss -tunlp output
 */
function parseSsLine(line: string): PortUsageInfo | null {
  // Format: Netid State Recv-Q Send-Q Local Address:Port Peer Address:Port Process
  // Example: tcp   LISTEN 0      4096   0.0.0.0:3000      0.0.0.0:*        users:(("node",pid=1234,fd=19))
  const parts = line.trim().split(/\s+/);
  if (parts.length < 6) return null;

  const protocol = parts[0].toLowerCase();
  const state = parts[1];
  const localAddrPart = parts[4];
  const peerAddrPart = parts[5];
  const processPart = parts.slice(6).join(" ");

  // Parse local address and port
  const localMatch = localAddrPart.match(/^(.+):(\d+)$/);
  if (!localMatch) return null;

  const localAddress = localMatch[1];
  const localPort = parseInt(localMatch[2], 10);

  // Parse peer address and port
  const peerMatch = peerAddrPart.match(/^(.+):(.+)$/);
  const peerAddress = peerMatch ? peerMatch[1] : "";
  const peerPort = peerMatch ? peerMatch[2] : "";

  // Parse process info
  let pid: number | null = null;
  let processName: string | null = null;
  const user: string | null = null;
  let fd: string | null = null;

  if (processPart.includes("users:")) {
    const processMatch = processPart.match(/users:\(\("([^"]+)",pid=(\d+),fd=(\d+)\)\)/);
    if (processMatch) {
      processName = processMatch[1];
      pid = parseInt(processMatch[2], 10);
      fd = processMatch[3];
    }
  }

  return {
    protocol,
    state,
    localAddress,
    localPort,
    peerAddress,
    peerPort,
    pid,
    processName,
    user,
    fd,
  };
}

/**
 * Parse lsof output as fallback
 */
function parseLsofOutput(output: string): Map<number, { pid: number; name: string; user: string }> {
  const result = new Map<number, { pid: number; name: string; user: string }>();
  const lines = output.split("\n").filter((line) => line.trim());

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 9) {
      const name = parts[0];
      const pid = parseInt(parts[1], 10);
      const user = parts[2];

      if (!Number.isNaN(pid)) {
        result.set(pid, { pid, name, user });
      }
    }
  }

  return result;
}

/**
 * Merge lsof process info into ss port info
 */
function mergePortInfo(
  ports: PortUsageInfo[],
  lsofData: Map<number, { pid: number; name: string; user: string }>
): void {
  for (const port of ports) {
    if (port.pid) {
      const info = lsofData.get(port.pid);
      if (info) {
        port.processName = info.name;
        port.user = info.user;
      }
    }
  }
}

/**
 * Get process details for a specific PID
 */
export async function getProcessInfoForPid(pid: number): Promise<{
  pid: number;
  name: string;
  command: string;
  cpu: number;
  mem: number;
  user: string;
  startTime: string;
} | null> {
  try {
    const { stdout } = await execAsync(
      `ps -p ${pid} -o pid,comm,pcpu,pmem,user,start_time,args --no-headers 2>/dev/null || echo ''`
    );

    const line = stdout.trim();
    if (!line) return null;

    const parts = line.split(/\s+/);
    if (parts.length < 6) return null;

    return {
      pid: parseInt(parts[0], 10),
      name: parts[1],
      cpu: parseFloat(parts[2]) || 0,
      mem: parseFloat(parts[3]) || 0,
      user: parts[4],
      startTime: parts[5],
      command: parts.slice(6).join(" "),
    };
  } catch (error) {
    logger.error(`[getProcessInfoForPid] Failed for pid ${pid}: ${error}`);
    return null;
  }
}
