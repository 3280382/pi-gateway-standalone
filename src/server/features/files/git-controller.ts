/**
 * Git Controller - Git History API
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Request, Response } from "express";

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
    const { stdout } = await execAsync(
      `git log --follow --format="%H|%s|%an|%ad" --date=unix "${filePath}"`,
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
    const { stdout } = await execAsync(
      `git show "${commitHash}:${filePath}"`,
      { cwd: workingDir },
    );
    return stdout;
  } catch (error) {
    console.error("[GitController] Error getting content:", error);
    throw new Error("Failed to get file content");
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
    const { stdout } = await execAsync(
      `git diff "${commitHash}" HEAD -- "${filePath}"`,
      { cwd: workingDir },
    );
    return stdout || "No differences";
  } catch (error) {
    console.error("[GitController] Error getting diff:", error);
    throw new Error("Failed to get diff");
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

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
    });
    return;
  }

  try {
    const content = await getFileContent(workingDir, filePath, commitHash);
    res.json({ content });
  } catch (error) {
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

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
    });
    return;
  }

  try {
    const diff = await getFileDiff(workingDir, filePath, commitHash);
    res.json({ diff });
  } catch (error) {
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
