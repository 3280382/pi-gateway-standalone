/**
 * Process Tree - 系统进程树查看
 * 获取操作系统所有进程信息及树状关系
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import { Logger, LogLevel } from "../../lib/utils/logger";

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
 * 获取所有进程信息
 */
export async function getAllProcesses(): Promise<ProcessInfo[]> {
  try {
    // 使用 ps 命令获取所有进程详细信息
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
        args: args.length > 100 ? args.substring(0, 100) + "..." : args,
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
    logger.error("[getAllProcesses] Failed:", error);
    return [];
  }
}

/**
 * 构建进程树
 */
export function buildProcessTree(processes: ProcessInfo[]): ProcessInfo[] {
  const processMap = new Map<number, ProcessInfo>();
  const rootProcesses: ProcessInfo[] = [];

  // 先创建映射
  for (const proc of processes) {
    processMap.set(proc.pid, { ...proc, children: [] });
  }

  // 构建树结构
  for (const proc of processMap.values()) {
    const parent = processMap.get(proc.ppid);
    if (parent && proc.pid !== proc.ppid) {
      parent.children = parent.children || [];
      parent.children.push(proc);
    } else {
      rootProcesses.push(proc);
    }
  }

  // 计算深度并排序
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

  // 按 PID 排序
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
 * 获取服务器进程及其子进程
 */
export async function getServerProcessTree(serverPid: number): Promise<{
  server: ProcessInfo | null;
  sessions: ProcessInfo[];
  allChildren: ProcessInfo[];
}> {
  const allProcesses = await getAllProcesses();
  const processMap = new Map(allProcesses.map((p) => [p.pid, p]));

  // 查找服务器进程
  const server = processMap.get(serverPid) || null;

  // 查找所有子进程
  const allChildren: ProcessInfo[] = [];
  const sessions: ProcessInfo[] = [];

  const findChildren = (pid: number) => {
    for (const proc of allProcesses) {
      if (proc.ppid === pid) {
        allChildren.push(proc);

        // 检测是否是 session 相关进程
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
 * 获取进程线程信息
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
    const { stdout } = await execAsync(
      `ps -eLo tid,pid,pcpu,stat,time,comm | grep " ${pid} "`
    );

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
 * 获取进程打开的文件
 */
export async function getProcessOpenFiles(pid: number): Promise<string[]> {
  try {
    const { stdout } = await execAsync(`lsof -p ${pid} 2>/dev/null | tail -n +2 | head -20`);
    return stdout
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split(/\s+/);
        return parts[parts.length - 1]; // 返回文件路径
      })
      .filter((path) => path && path.startsWith("/"));
  } catch {
    return [];
  }
}

/**
 * 获取完整进程树数据（用于 WebSocket 响应）
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

  // 统计
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
