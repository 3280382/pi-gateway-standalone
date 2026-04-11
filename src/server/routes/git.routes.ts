/**
 * Git Routes - Git History API
 */

import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyInstance } from "fastify";

const execAsync = promisify(exec);

interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  timestamp: number;
}

interface GitHistoryParams {
  filePath: string;
  workingDir: string;
}

interface GitContentParams {
  filePath: string;
  commitHash: string;
  workingDir: string;
}

interface GitDiffParams {
  filePath: string;
  commitHash: string;
  workingDir: string;
}

/**
 * Get git history for a file
 */
async function getGitHistory(workingDir: string, filePath: string): Promise<GitCommit[]> {
  try {
    const { stdout } = await execAsync(
      `git log --follow --format="%H|%s|%an|%ad" --date=unix "${filePath}"`,
      { cwd: workingDir }
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
    console.error("[GitRoutes] Error getting history:", error);
    return [];
  }
}

/**
 * Get file content at specific commit
 */
async function getFileContent(
  workingDir: string,
  filePath: string,
  commitHash: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git show "${commitHash}:${filePath}"`, {
      cwd: workingDir,
    });
    return stdout;
  } catch (error) {
    console.error("[GitRoutes] Error getting content:", error);
    throw new Error("Failed to get file content");
  }
}

/**
 * Get diff between commit and current
 */
async function getFileDiff(
  workingDir: string,
  filePath: string,
  commitHash: string
): Promise<string> {
  try {
    const { stdout } = await execAsync(`git diff "${commitHash}" HEAD -- "${filePath}"`, {
      cwd: workingDir,
    });
    return stdout || "No differences";
  } catch (error) {
    console.error("[GitRoutes] Error getting diff:", error);
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

export async function gitRoutes(fastify: FastifyInstance): Promise<void> {
  // Get git history for a file
  fastify.get<{
    Querystring: { filePath: string; workingDir: string };
  }>("/git/history", async (request, reply) => {
    const { filePath, workingDir } = request.query;

    if (!filePath || !workingDir) {
      return reply.status(400).send({
        error: "Missing required parameters: filePath, workingDir",
      });
    }

    const isGit = await isGitRepo(workingDir);
    if (!isGit) {
      return reply.status(400).send({
        error: "Not a git repository",
      });
    }

    const history = await getGitHistory(workingDir, filePath);
    return { history };
  });

  // Get file content at specific commit
  fastify.get<{
    Querystring: { filePath: string; commitHash: string; workingDir: string };
  }>("/git/content", async (request, reply) => {
    const { filePath, commitHash, workingDir } = request.query;

    if (!filePath || !commitHash || !workingDir) {
      return reply.status(400).send({
        error: "Missing required parameters",
      });
    }

    try {
      const content = await getFileContent(workingDir, filePath, commitHash);
      return { content };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Failed to get content",
      });
    }
  });

  // Get diff between commit and current
  fastify.get<{
    Querystring: { filePath: string; commitHash: string; workingDir: string };
  }>("/git/diff", async (request, reply) => {
    const { filePath, commitHash, workingDir } = request.query;

    if (!filePath || !commitHash || !workingDir) {
      return reply.status(400).send({
        error: "Missing required parameters",
      });
    }

    try {
      const diff = await getFileDiff(workingDir, filePath, commitHash);
      return { diff };
    } catch (error) {
      return reply.status(500).send({
        error: error instanceof Error ? error.message : "Failed to get diff",
      });
    }
  });

  // Check if directory is git repo
  fastify.get<{
    Querystring: { workingDir: string };
  }>("/git/check", async (request, reply) => {
    const { workingDir } = request.query;

    if (!workingDir) {
      return reply.status(400).send({
        error: "Missing workingDir parameter",
      });
    }

    const isGit = await isGitRepo(workingDir);
    return { isGitRepo: isGit };
  });
}
