/**
 * Git Controller - Git History API
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { relative, join } from "node:path";

const execAsync = promisify(exec);

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  timestamp: number;
}

/**
 * 获取 Git 仓库根目录
 */
async function getGitRoot(workingDir: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --show-toplevel", { cwd: workingDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * 检查目录是否是 Git 仓库
 */
async function isGitRepo(workingDir: string): Promise<boolean> {
  const root = await getGitRoot(workingDir);
  return root !== null;
}

/**
 * 获取文件相对于 Git 仓库根目录的路径
 */
function getRelativePath(gitRoot: string, filePath: string): string {
  // 如果 filePath 是绝对路径，计算相对路径
  if (filePath.startsWith("/")) {
    return relative(gitRoot, filePath);
  }
  // 如果已经是相对路径，直接返回
  return filePath;
}

/**
 * Get git history for a file
 */
async function getGitHistory(
  workingDir: string,
  filePath: string,
): Promise<GitCommit[]> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(`[GitController] History: gitRoot=${gitRoot}, relativePath=${relativePath}`);

  try {
    const { stdout } = await execAsync(
      `git log --follow --format="%H|%s|%an|%ad" --date=unix "${relativePath}"`,
      { cwd: gitRoot },
    );

    if (!stdout.trim()) {
      return [];
    }

    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.split("|");
        return {
          hash: parts[0],
          shortHash: parts[0].slice(0, 7),
          message: parts[1] || "",
          author: parts[2] || "",
          date: new Date(parseInt(parts[3]) * 1000).toISOString(),
          timestamp: parseInt(parts[3]),
        };
      });
  } catch (error) {
    console.error("[GitController] Error getting history:", error);
    return [];
  }
}

/**
 * Get file content at specific commit
 */
async function getFileContent(
  workingDir: string,
  filePath: string,
  commitHash: string,
): Promise<string> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(`[GitController] Content: commit=${commitHash}, gitRoot=${gitRoot}, relativePath=${relativePath}`);

  try {
    const { stdout } = await execAsync(
      `git show "${commitHash}:${relativePath}"`,
      { cwd: gitRoot },
    );
    return stdout;
  } catch (error: any) {
    console.error("[GitController] Error getting content:", error?.stderr || error?.message || error);
    throw new Error(`Failed to get file content: ${error?.stderr || error?.message || "Unknown error"}`);
  }
}

/**
 * Get diff between commit and current
 */
async function getFileDiff(
  workingDir: string,
  filePath: string,
  commitHash: string,
): Promise<string> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(`[GitController] Diff: commit=${commitHash}, gitRoot=${gitRoot}, relativePath=${relativePath}`);

  try {
    const { stdout } = await execAsync(
      `git diff "${commitHash}" HEAD -- "${relativePath}"`,
      { cwd: gitRoot },
    );
    return stdout || "No differences";
  } catch (error: any) {
    console.error("[GitController] Error getting diff:", error?.stderr || error?.message || error);
    throw new Error(`Failed to get diff: ${error?.stderr || error?.message || "Unknown error"}`);
  }
}

/**
 * GET /api/git/history - Get git history for a file
 */
export async function getGitHistoryHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { filePath, workingDir } = req.query as {
    filePath: string;
    workingDir: string;
  };

  console.log(`[GitController] History request: filePath=${filePath}, workingDir=${workingDir}`);

  if (!filePath || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters: filePath, workingDir",
    });
    return;
  }

  const isGit = await isGitRepo(workingDir);
  if (!isGit) {
    res.status(400).json({
      error: "Not a git repository",
    });
    return;
  }

  const history = await getGitHistory(workingDir, filePath);
  res.json({ history });
}

/**
 * GET /api/git/content - Get file content at specific commit
 */
export async function getGitContentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { filePath, commitHash, workingDir } = req.query as {
    filePath: string;
    commitHash: string;
    workingDir: string;
  };

  console.log(`[GitController] Content request: filePath=${filePath}, commit=${commitHash}, workingDir=${workingDir}`);

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
      details: { filePath: !!filePath, commitHash: !!commitHash, workingDir: !!workingDir },
    });
    return;
  }

  try {
    const content = await getFileContent(workingDir, filePath, commitHash);
    res.json({ content });
  } catch (error: any) {
    console.error(`[GitController] Content error: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get content",
    });
  }
}

/**
 * GET /api/git/diff - Get diff between commit and current
 */
export async function getGitDiffHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { filePath, commitHash, workingDir } = req.query as {
    filePath: string;
    commitHash: string;
    workingDir: string;
  };

  console.log(`[GitController] Diff request: filePath=${filePath}, commit=${commitHash}, workingDir=${workingDir}`);

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
      details: { filePath: !!filePath, commitHash: !!commitHash, workingDir: !!workingDir },
    });
    return;
  }

  try {
    const diff = await getFileDiff(workingDir, filePath, commitHash);
    res.json({ diff });
  } catch (error: any) {
    console.error(`[GitController] Diff error: ${error.message}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get diff",
    });
  }
}

/**
 * GET /api/git/check - Check if directory is git repo
 */
export async function checkGitRepoHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { workingDir } = req.query as { workingDir: string };

  if (!workingDir) {
    res.status(400).json({
      error: "Missing workingDir parameter",
    });
    return;
  }

  const isGit = await isGitRepo(workingDir);
  res.json({ isGitRepo: isGit });
}

/**
 * GET /api/git/status - Get git status for files in a directory
 */
export async function getGitStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { workingDir } = req.query as { workingDir: string };

  if (!workingDir) {
    res.status(400).json({
      error: "Missing workingDir parameter",
    });
    return;
  }

  try {
    // 检查是否为git仓库
    const gitRoot = await getGitRoot(workingDir);
    if (!gitRoot) {
      res.json({ statuses: {} });
      return;
    }

    // 获取git状态（简洁格式）
    const { stdout } = await execAsync("git status --porcelain", { cwd: gitRoot });
    
    const statuses: Record<string, string> = {};
    
    // 解析porcelain格式的输出
    // 格式: XY PATH
    // 其中X为暂存区状态，Y为工作区状态
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;
      
      // 解析状态代码和文件路径
      const status = line.substring(0, 2);
      const path = line.substring(3);
      
      // 如果路径被引号包裹，去除引号
      let filePath = path.trim();
      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        filePath = filePath.slice(1, -1);
      }
      
      // 将状态映射为更易读的格式
      let displayStatus = "";
      if (status === "??") {
        displayStatus = "untracked";
      } else if (status.startsWith("M")) {
        displayStatus = "modified";
      } else if (status.startsWith("A")) {
        displayStatus = "added";
      } else if (status.startsWith("D")) {
        displayStatus = "deleted";
      } else if (status.startsWith("R")) {
        displayStatus = "renamed";
      } else if (status.startsWith("C")) {
        displayStatus = "copied";
      } else if (status.startsWith("U")) {
        displayStatus = "conflict";
      } else {
        displayStatus = "other";
      }
      
      // 计算相对于 workingDir 的路径
      let relativePath = filePath;
      if (gitRoot !== workingDir) {
        const absolutePath = join(gitRoot, filePath);
        relativePath = relative(workingDir, absolutePath);
        
        // 如果相对路径以 ../ 开头，表示文件不在 workingDir 下
        // 这种情况可能发生在子模块或特殊情况下
        // 暂时保持原始路径
        if (relativePath.startsWith("../")) {
          relativePath = filePath;
        }
      }
      
      statuses[relativePath] = displayStatus;
    }
    
    res.json({ statuses });
  } catch (error) {
    console.error("[Git] Failed to get git status:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to get git status",
    });
  }
}
