/**
 * Process Tree - System process tree viewer
 * Get all OS process info and tree relationships
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Logger, LogLevel } from "../../lib/utils/logger.js";

const execAsync = promisify(exec);
const logger = new Logger({ level: LogLevel.INFO });

export interface ProcessInfo {
  pid: number;
  ppid: number;
  uid: number;
  gid: number;
  command: string;
  args: string;
  cpu: number;
  mem: number;
  vsz: number;
  rss: number;
  tty: string;
  stat: string;
  start: string;
  time: string;
  children?: ProcessInfo[];
  depth?: number;
  isServerProcess?: boolean;
  isSessionProcess?: boolean;
  sessionId?: string;
}

/**
 * Get all process info
 */
export async function getAllProcesses(): Promise<ProcessInfo[]> {
  try {
    // Use ps command to get all process details
    const { stdout } = await execAsync(
      "ps -eo pid,ppid,uid,gid,pcpu,pmem,vsz,rss,tty,stat,start,time,comm,args --no-headers"
    );

    const processes: ProcessInfo[] = [];
    const lines = stdout.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 13) continue;

      const pid = parseInt(parts[0], 10);
      const ppid = parseInt(parts[1], 10);
      const uid = parseInt(parts[2], 10);
      const gid = parseInt(parts[3], 10);
      const cpu = parseFloat(parts[4]);
      const mem = parseFloat(parts[5]);
      const vsz = parseInt(parts[6], 10);
      const rss = parseInt(parts[7], 10);
      const tty = parts[8];
      const stat = parts[9];
      const start = parts[10];
      const time = parts[11];
      const comm = parts[12];
      const args = parts.slice(13).join(" ");

      processes.push({
        pid,
        ppid,
        uid,
        gid,
        command: comm,
        args: args.length > 100 ? `${args.substring(0, 100)}...` : args,
        cpu,
        mem,
        vsz,
        rss,
        tty,
        stat,
        start,
        time,
      });
    }

    return processes;
  } catch (error) {
    logger.error(`[getAllProcesses] Failed: ${error}`);
    return [];
  }
}

/**
 * Build process tree
 */
export function buildProcessTree(processes: ProcessInfo[]): ProcessInfo[] {
  const processMap = new Map<number, ProcessInfo>();
  const rootProcesses: ProcessInfo[] = [];

  // First create mapping
  for (const proc of processes) {
    processMap.set(proc.pid, { ...proc, children: [] });
  }

  // Build tree structure
  for (const proc of processMap.values()) {
    const parent = processMap.get(proc.ppid);
    if (parent && proc.pid !== proc.ppid) {
      parent.children = parent.children || [];
      parent.children.push(proc);
    } else {
      rootProcesses.push(proc);
    }
  }

  // Calculate depth and sort
  const calculateDepth = (proc: ProcessInfo, depth: number) => {
    proc.depth = depth;
    if (proc.children) {
      for (const child of proc.children) {
        calculateDepth(child, depth + 1);
      }
    }
  };

  for (const root of rootProcesses) {
    calculateDepth(root, 0);
  }

  // Sort by PID
  const sortByPid = (a: ProcessInfo, b: ProcessInfo) => a.pid - b.pid;
  rootProcesses.sort(sortByPid);

  for (const proc of processMap.values()) {
    if (proc.children) {
      proc.children.sort(sortByPid);
    }
  }

  return rootProcesses;
}

/**
 * Get server process and its child processes
 */
export async function getServerProcessTree(serverPid: number): Promise<{
  server: ProcessInfo | null;
  sessions: ProcessInfo[];
  allChildren: ProcessInfo[];
}> {
  const allProcesses = await getAllProcesses();
  const processMap = new Map(allProcesses.map((p) => [p.pid, p]));

  // Find server process
  const server = processMap.get(serverPid) || null;

  // Find all child processes
  const allChildren: ProcessInfo[] = [];
  const sessions: ProcessInfo[] = [];

  const findChildren = (pid: number) => {
    for (const proc of allProcesses) {
      if (proc.ppid === pid) {
        allChildren.push(proc);

        // Detect if session-related process
        if (proc.args.includes("pi-coding-agent") || proc.args.includes("tsx")) {
          proc.isSessionProcess = true;
          sessions.push(proc);
        }

        findChildren(proc.pid);
      }
    }
  };

  if (server) {
    server.isServerProcess = true;
    findChildren(serverPid);
  }

  return { server, sessions, allChildren };
}

/**
 * Get process thread info
 */
export async function getProcessThreads(pid: number): Promise<
  {
    tid: number;
    pid: number;
    cpu: number;
    stat: string;
    time: string;
    command: string;
  }[]
> {
  try {
    const { stdout } = await execAsync(`ps -eLo tid,pid,pcpu,stat,time,comm | grep " ${pid} "`);

    const threads: {
      tid: number;
      pid: number;
      cpu: number;
      stat: string;
      time: string;
      command: string;
    }[] = [];

    const lines = stdout.split("\n").filter((line) => line.trim());
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 6) {
        threads.push({
          tid: parseInt(parts[0], 10),
          pid: parseInt(parts[1], 10),
          cpu: parseFloat(parts[2]),
          stat: parts[3],
          time: parts[4],
          command: parts[5],
        });
      }
    }

    return threads;
  } catch {
    return [];
  }
}

/**
 * Get files opened by process
 */
export async function getProcessOpenFiles(pid: number): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`lsof -p ${pid} 2>/dev/null | tail -n +2 | head -20`);
    return stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split(/\s+/);
        return parts[parts.length - 1]; // Return file path
      })
      .filter((path) => path?.startsWith("/"));
  } catch {
    return [];
  }
}

/**
 * Get complete process tree data (for WebSocket response)
 */
export async function getProcessTreeData(serverPid?: number): Promise<{
  processes: ProcessInfo[];
  tree: ProcessInfo[];
  serverProcess?: ProcessInfo | null;
  serverChildren?: ProcessInfo[];
  serverSessions?: ProcessInfo[];
  stats: {
    total: number;
    running: number;
    sleeping: number;
    zombie: number;
    serverChildren: number;
  };
}> {
  const processes = await getAllProcesses();
  const tree = buildProcessTree(processes);

  // Statistics
  const stats = {
    total: processes.length,
    running: processes.filter((p) => p.stat.includes("R")).length,
    sleeping: processes.filter((p) => p.stat.includes("S")).length,
    zombie: processes.filter((p) => p.stat.includes("Z")).length,
    serverChildren: 0,
  };

  let serverProcess: ProcessInfo | null = null;
  let serverChildren: ProcessInfo[] = [];
  let serverSessions: ProcessInfo[] = [];

  if (serverPid) {
    const serverTree = await getServerProcessTree(serverPid);
    serverProcess = serverTree.server;
    serverChildren = serverTree.allChildren;
    serverSessions = serverTree.sessions;
    stats.serverChildren = serverChildren.length;
  }

  return {
    processes,
    tree,
    serverProcess,
    serverChildren,
    serverSessions,
    stats,
  };
}
