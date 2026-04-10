/**
 * Git Controller - Git History API
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Request, Response } from "express";
import { resolve, relative } from "node:path";

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
 * Get git history for a file
 */
async function getGitHistory(
  workingDir: string,
  filePath: string,
): Promise<GitCommit[]> {
  try {
    // 获取相对于 workingDir 的路径
    const relativePath = relative(workingDir, filePath);
    const { stdout } = await execAsync(
      `git log --follow --format="%H|%s|%an|%ad" --date=unix "${relativePath}"`,
      { cwd: workingDir },
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
  try {
    // 获取相对于 workingDir 的路径
    const relativePath = relative(workingDir, filePath);
    console.log(`[GitController] Getting content: commit=${commitHash}, path=${relativePath}, cwd=${workingDir}`);
    
    const { stdout } = await execAsync(
      `git show "${commitHash}:${relativePath}"`,
      { cwd: workingDir },
    );
    return stdout;
  } catch (error: any) {
    console.error("[GitController] Error getting content:", error?.message || error);
    // 尝试使用绝对路径
    try {
      const { stdout } = await execAsync(
        `git show "${commitHash}:${filePath}"`,
        { cwd: workingDir },
      );
      return stdout;
    } catch (error2: any) {
      console.error("[GitController] Error with absolute path:", error2?.message || error2);
      throw new Error(`Failed to get file content: ${error2?.message || "Unknown error"}`);
    }
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
  try {
    // 获取相对于 workingDir 的路径
    const relativePath = relative(workingDir, filePath);
    console.log(`[GitController] Getting diff: commit=${commitHash}, path=${relativePath}, cwd=${workingDir}`);
    
    const { stdout } = await execAsync(
      `git diff "${commitHash}" HEAD -- "${relativePath}"`,
      { cwd: workingDir },
    );
    return stdout || "No differences";
  } catch (error: any) {
    console.error("[GitController] Error getting diff:", error?.message || error);
    // 尝试使用绝对路径
    try {
      const { stdout } = await execAsync(
        `git diff "${commitHash}" HEAD -- "${filePath}"`,
        { cwd: workingDir },
      );
      return stdout || "No differences";
    } catch (error2: any) {
      console.error("[GitController] Error with absolute path:", error2?.message || error2);
      throw new Error(`Failed to get diff: ${error2?.message || "Unknown error"}`);
    }
  }
}

/**
 * Check if directory is a git repository
 */
async function isGitRepo(workingDir: string): Promise<boolean> {
  try {
    await execAsync("git rev-parse --git-dir", { cwd: workingDir });
    return true;
  } catch {
    return false;
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
