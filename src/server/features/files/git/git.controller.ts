/**
 * Git Controller - Git API controller
 * Corresponds to /api/git/* routes
 */

import { exec } from "node:child_process";
import { join, normalize, relative } from "node:path";
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
 * Get Git repository root directory
 */
async function getGitRoot(workingDir: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --show-toplevel", {
      cwd: workingDir,
    });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Check if directory is Git repository
 */
async function isGitRepo(workingDir: string): Promise<boolean> {
  const root = await getGitRoot(workingDir);
  return root !== null;
}

/**
 * Get file path relative to Git repository root
 */
function getRelativePath(gitRoot: string, filePath: string): string {
  // If filePath is absolute, calculate relative path
  if (filePath.startsWith("/")) {
    return relative(gitRoot, filePath);
  }
  // If already relative path, return directly
  return filePath;
}

/**
 * Check if file has uncommitted modifications in working tree
 */
async function hasWorkingTreeChanges(gitRoot: string, relativePath: string): Promise<boolean> {
  try {
    // Check if working tree has modifications (unstaged)
    const { stdout } = await execAsync(`git diff --quiet "${relativePath}" || echo "modified"`, {
      cwd: gitRoot,
    });
    if (stdout.trim() === "modified") {
      return true;
    }
    // Check if staging area has modifications
    const { stdout: stagedStdout } = await execAsync(
      `git diff --cached --quiet "${relativePath}" || echo "staged"`,
      { cwd: gitRoot }
    );
    return stagedStdout.trim() === "staged";
  } catch {
    return false;
  }
}

/**
 * Get git history for a file - corresponds to /api/git/history
 * If uncommitted changes, add "Working Tree" item to top of history
 */
async function getGitHistory(workingDir: string, filePath: string): Promise<GitCommit[]> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(`[GitController] History: gitRoot=${gitRoot}, relativePath=${relativePath}`);

  try {
    const { stdout } = await execAsync(
      `git log --follow --format="%H|%s|%an|%ad" --date=unix "${relativePath}"`,
      { cwd: gitRoot }
    );

    const commits: GitCommit[] = [];

    // Check for uncommitted modifications
    const hasChanges = await hasWorkingTreeChanges(gitRoot, relativePath);
    if (hasChanges) {
      // Add "Working Tree" item to top of history list
      commits.push({
        hash: "WORKING",
        shortHash: "WORKING",
        message: "Current changes (not committed)",
        author: "Working Tree",
        date: new Date().toISOString(),
        timestamp: Math.floor(Date.now() / 1000),
      });
    }

    if (!stdout.trim()) {
      return commits;
    }

    const historyCommits = stdout
      .trim()
      .split("\n")
      .map((line) => {
        const parts = line.split("|");
        return {
          hash: parts[0],
          shortHash: parts[0].slice(0, 7),
          message: parts[1] || "",
          author: parts[2] || "",
          date: new Date(parseInt(parts[3], 10) * 1000).toISOString(),
          timestamp: parseInt(parts[3], 10),
        };
      });

    return [...commits, ...historyCommits];
  } catch (error) {
    console.error("[GitController] Error getting history:", error);
    return [];
  }
}

/**
 * Get file content at specific commit or working tree - corresponds to /api/git/content
 */
async function getFileContent(
  workingDir: string,
  filePath: string,
  commitHash: string
): Promise<string> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(
    `[GitController] Content: commit=${commitHash}, gitRoot=${gitRoot}, relativePath=${relativePath}`
  );

  try {
    // If working tree, read actual file
    if (commitHash === "WORKING") {
      const fullPath = join(gitRoot, relativePath);
      const { stdout } = await execAsync(`cat "${fullPath}"`);
      return stdout;
    }
    // Otherwise read from git
    const { stdout } = await execAsync(`git show "${commitHash}:${relativePath}"`, {
      cwd: gitRoot,
    });
    return stdout;
  } catch (error: any) {
    console.error(
      "[GitController] Error getting content:",
      error?.stderr || error?.message || error
    );
    throw new Error(
      `Failed to get file content: ${error?.stderr || error?.message || "Unknown error"}`
    );
  }
}

/**
 * Get diff between commit and working tree - corresponds to /api/git/diff
 * If commitHash is "WORKING", compare previous commit with working tree
 */
async function getFileDiff(
  workingDir: string,
  filePath: string,
  commitHash: string
): Promise<string> {
  const gitRoot = await getGitRoot(workingDir);
  if (!gitRoot) {
    throw new Error("Not a git repository");
  }

  const relativePath = getRelativePath(gitRoot, filePath);
  console.log(
    `[GitController] Diff: commit=${commitHash}, gitRoot=${gitRoot}, relativePath=${relativePath}`
  );

  try {
    let stdout = "";
    if (commitHash === "WORKING") {
      // Working tree vs HEAD (latest commit)
      const result = await execAsync(`git diff HEAD -- "${relativePath}"`, {
        cwd: gitRoot,
      });
      stdout = result.stdout;
    } else {
      // Commit vs working tree (not HEAD)
      const result = await execAsync(`git diff "${commitHash}" -- "${relativePath}"`, {
        cwd: gitRoot,
      });
      stdout = result.stdout;
    }
    return stdout || "No differences";
  } catch (error: any) {
    console.error("[GitController] Error getting diff:", error?.stderr || error?.message || error);
    throw new Error(`Failed to get diff: ${error?.stderr || error?.message || "Unknown error"}`);
  }
}

/**
 * GET /api/git/history - Get git history for a file
 */
export async function history(req: Request, res: Response): Promise<void> {
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
export async function content(req: Request, res: Response): Promise<void> {
  const { filePath, commitHash, workingDir } = req.query as {
    filePath: string;
    commitHash: string;
    workingDir: string;
  };

  console.log(
    `[GitController] Content request: filePath=${filePath}, commit=${commitHash}, workingDir=${workingDir}`
  );

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
      details: {
        filePath: !!filePath,
        commitHash: !!commitHash,
        workingDir: !!workingDir,
      },
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
export async function diff(req: Request, res: Response): Promise<void> {
  const { filePath, commitHash, workingDir } = req.query as {
    filePath: string;
    commitHash: string;
    workingDir: string;
  };

  console.log(
    `[GitController] Diff request: filePath=${filePath}, commit=${commitHash}, workingDir=${workingDir}`
  );

  if (!filePath || !commitHash || !workingDir) {
    res.status(400).json({
      error: "Missing required parameters",
      details: {
        filePath: !!filePath,
        commitHash: !!commitHash,
        workingDir: !!workingDir,
      },
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
export async function check(req: Request, res: Response): Promise<void> {
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
export async function status(req: Request, res: Response): Promise<void> {
  const { workingDir } = req.query as { workingDir: string };

  if (!workingDir) {
    res.status(400).json({
      error: "Missing workingDir parameter",
    });
    return;
  }

  try {
    // Check if git repository
    const gitRoot = await getGitRoot(workingDir);
    if (!gitRoot) {
      res.json({ statuses: {} });
      return;
    }

    // Get git status (short format)
    const { stdout } = await execAsync("git status --porcelain", {
      cwd: gitRoot,
    });

    const statuses: Record<string, string> = {};

    // Parse porcelain format output
    // Format: XY PATH
    // Where X is staging status, Y is working tree status
    const lines = stdout.trim().split("\n");
    for (const line of lines) {
      if (line.trim() === "") continue;

      // Parse status code and file path
      // Git porcelainFormat: XY PATH
      // But sometimes X may be space, causing inconsistent format
      // Better method: find all content after second space
      const firstSpaceIndex = line.indexOf(" ");
      let status, path;

      if (firstSpaceIndex >= 0) {
        // Next chars after first space is second part of status code
        // Status code is first 2 chars
        status = line.substring(0, 2);

        // Find space after status code
        // There may be one or more spaces after status code
        let pathStart = 2;
        while (pathStart < line.length && line[pathStart] === " ") {
          pathStart++;
        }
        path = line.substring(pathStart);
      } else {
        // 后备方案：使用原来的逻辑
        status = line.substring(0, 2);
        path = line.substring(3);
      }

      console.log("[Git] Parse line:", { line, status, path, firstSpaceIndex });

      // 如果Path wrapped in quotes, removing quotes
      let filePath = path.trim();
      console.log("[Git] Trimmed path:", filePath);

      if (filePath.startsWith('"') && filePath.endsWith('"')) {
        console.log("[Git] Path wrapped in quotes, removing quotes");
        filePath = filePath.slice(1, -1);
      }

      console.log("[Git] Processed file path:", filePath);

      // 将状态映射为更易读的格式
      let displayStatus = "";
      if (status === "??") {
        displayStatus = "untracked";
      } else if (status === " M" || status === "M ") {
        displayStatus = "modified";
      } else if (status === "A " || status === " A") {
        displayStatus = "added";
      } else if (status === "D " || status === " D") {
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

      // 规范化路径以处理尾部斜杠差异
      const normalizedGitRoot = normalize(gitRoot);
      const normalizedWorkingDir = normalize(workingDir);

      if (normalizedGitRoot !== normalizedWorkingDir) {
        const absolutePath = join(normalizedGitRoot, filePath);
        relativePath = relative(normalizedWorkingDir, absolutePath);

        // 如果相对路径以 ../ 开头，表示files不在 workingDir 下
        // 这种情况可能发生在子模块或特殊情况下
        // 暂时保持原始路径
        if (relativePath.startsWith("../")) {
          relativePath = filePath;
        }
      } else {
        // gitRoot 和 workingDir 相同，files路径已经是相对于根directories的
        relativePath = filePath;
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
