/**
 * Git Controller - Git History API
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { relative } from "node:path";

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
