/**
 * File Controller - Filesystem API controller
 * Corresponds to /api/file/* routes
 */

import { homedir } from "node:os";
import * as path from "node:path";
import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";
import { expandPath, getMimeType, isBinaryFile, isHighlightable, isPathAllowed } from "../utils";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Browse directory - corresponds to /api/browse
 */
export async function browse(req: Request, res: Response) {
  const { path: browsePath } = req.body;
  const targetPath = browsePath || homedir();

  // Log request origin info
  const clientInfo = req.headers["user-agent"]?.substring(0, 50) || "unknown";
  logger.info(`[browse] Received request: path="${targetPath}", client="${clientInfo}"`);

  try {
    const startTime = Date.now();
    const { readdir, stat } = await import("node:fs/promises");
    const entries = await readdir(targetPath, { withFileTypes: true });

    logger.info(`[browse] Read directory successful: ${entries.length} entries`);

    // Fetch file status in parallel (limit concurrency)
    const concurrencyLimit = 10;
    const   items = [];

    for (let i = 0; i < entries.length; i += concurrencyLimit) {
      const batch = entries.slice(i, i + concurrencyLimit);
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          const fullPath = path.join(targetPath, entry.name);
          // Use stat instead of entry.isDirectory() to correctly identify symlinks
          const stats = await stat(fullPath).catch(() => null);
          const isDirectory = stats?.isDirectory() ?? entry.isDirectory();
          return {
            name: entry.name,
            path: fullPath,
            isDirectory,
            isSymlink: entry.isSymbolicLink(),
            size: stats?.size || 0,
            modified: stats?.mtime.toISOString() || new Date().toISOString(),
            extension: isDirectory
              ? undefined
              : entry.name.includes(".")
                ? entry.name.split(".").pop()?.toLowerCase()
                : undefined,
          };
        })
      );
        items.push(...batchResults);
    }

      items.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });

    const response = {
      currentPath: targetPath,
      parentPath: path.dirname(targetPath),
        items,
      metadata: {
        count:   items.length,
        directories:   items.filter((i) => i.isDirectory).length,
        files:   items.filter((i) => !i.isDirectory).length,
        processingTime: Date.now() - startTime,
      },
    };

    logger.info(
      `[browse] Response successful: ${targetPath}, ${  items.length}   items (${  items.filter((i) => i.isDirectory).length} directories, ${  items.filter((i) => !i.isDirectory).length} files), Time taken: ${Date.now() - startTime}ms`
    );
    res.json(response);
  } catch (error) {
    logger.error(`File browse error: ${error instanceof Error ? error.message : String(error)}`, {
      targetPath,
    });
    res.status(500).json({
      error: String(error),
      code: "BROWSE_ERROR",
      path: targetPath,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Get directory tree - corresponds to /api/files/tree
 */
export async function tree(req: Request, res: Response) {
  const rawPath = req.query.path as string;
  const filterMode = (req.query.filter as string) || "all"; // "all" | "normal"

  if (!rawPath) {
    res.status(400).json({ error: "path parameter required" });
    return;
  }

  const targetPath = expandPath(rawPath);

  if (!isPathAllowed(targetPath)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  // Default excluded directories and files
  const DEFAULT_EXCLUDES = [
    "node_modules",
    "__pycache__",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    ".next",
    ".nuxt",
    "coverage",
    ".coverage",
    ".idea",
    ".vscode",
    "log",
    "logs",
    "fonts",
  ];

  try {
    const { stat, readdir } = await import("node:fs/promises");
    const stats = await stat(targetPath);

    if (!stats.isDirectory()) {
      res.status(400).json({ error: "Path is not a directory" });
      return;
    }

    const buildTree = async (
      dirPath: string,
      depth: number,
      maxDepth: number = 10 // Max 10 directory levels supported
    ): Promise<any> => {
      if (depth >= maxDepth) {
        return {
          name: path.basename(dirPath),
          path: dirPath,
          isDirectory: true,
          truncated: true,
        };
      }

      const entries = await readdir(dirPath, { withFileTypes: true });
      const children = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        // Server filter: exclude hidden files and default exclusions
        if (filterMode === "normal") {
          if (entry.name.startsWith(".") || DEFAULT_EXCLUDES.includes(entry.name)) {
            continue;
          }
        }

        const childStats = await stat(fullPath).catch(() => null);

        if (!childStats) continue;

        if (entry.isDirectory()) {
          const childTree = await buildTree(fullPath, depth + 1, maxDepth);
          children.push(childTree);
        } else {
          children.push({
            name: entry.name,
            path: fullPath,
            isDirectory: false,
            size: childStats.size,
            modified: childStats.mtime.toISOString(),
            extension: entry.name.includes(".")
              ? entry.name.split(".").pop()?.toLowerCase()
              : undefined,
          });
        }
      }

      return {
        name: path.basename(dirPath),
        path: dirPath,
        isDirectory: true,
        children,
      };
    };

    const tree = await buildTree(targetPath, 0);
    logger.info(`Get directory tree: ${targetPath}, filter: ${filterMode}`);
    res.json(tree);
  } catch (error) {
    logger.error(`Get directory tree error: ${error instanceof Error ? error.message : String(error)}`, {
      targetPath,
    });
    res.status(500).json({ error: String(error) });
  }
}

/**
 * Get file content - corresponds to /api/files/content
 */
export async function content(req: Request, res: Response) {
  const rawPath = req.query.path as string;

  if (!rawPath) {
    res.status(400).json({ error: "path parameter required" });
    return;
  }

  const targetPath = expandPath(rawPath);

  if (!isPathAllowed(targetPath)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const { stat, readFile } = await import("node:fs/promises");
    const stats = await stat(targetPath);

    if (stats.isDirectory()) {
      res.status(400).json({ error: "Path is directory, use /api/files/tree" });
      return;
    }

    // Limit content API file size to 50MB
    if (stats.size > 50 * 1024 * 1024) {
      res.status(413).json({ error: "File too large, use /api/files/raw" });
      return;
    }

    const content = await readFile(targetPath, "utf-8");

    logger.info(`Get file content: ${targetPath}, Size: ${stats.size}bytes`);
    res.json({
      path: targetPath,
      content,
      size: stats.size,
      modified: stats.mtime.toISOString(),
      mimeType: getMimeType(targetPath),
      highlightable: isHighlightable(targetPath),
      binary: isBinaryFile(targetPath),
    });
  } catch (error) {
    logger.error(`Get file content error: ${error instanceof Error ? error.message : String(error)}`, {
      targetPath,
    });
    res.status(500).json({ error: String(error) });
  }
}

/**
 * Get raw file - corresponds to /api/files/raw
 */
export async function raw(req: Request, res: Response) {
  const rawPath = req.query.path as string;

  if (!rawPath) {
    res.status(400).json({ error: "path parameter required" });
    return;
  }

  const targetPath = expandPath(rawPath);

  if (!isPathAllowed(targetPath)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const { stat, readFile } = await import("node:fs/promises");
    const stats = await stat(targetPath);

    if (stats.isDirectory()) {
      res.status(400).json({ error: "Path is directory" });
      return;
    }

    const mimeType = getMimeType(targetPath);
    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stats.size.toString());
    res.setHeader("Last-Modified", stats.mtime.toUTCString());

    const content = await readFile(targetPath);

    logger.info(`Get raw file: ${targetPath}, MIME type: ${mimeType}, Size: ${stats.size}bytes`);
    res.send(content);
  } catch (error) {
    logger.error(`Get raw file error: ${error instanceof Error ? error.message : String(error)}`, {
      targetPath,
    });
    res.status(500).json({ error: String(error) });
  }
}

/**
 * Write file content - corresponds to /api/files/write
 */
export async function write(req: Request, res: Response) {
  const { path: filePath, content } = req.body;

  if (!filePath || content === undefined) {
    res.status(400).json({ error: "path and content parameters required" });
    return;
  }

  const targetPath = expandPath(filePath);

  if (!isPathAllowed(targetPath)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const { writeFile, mkdir } = await import("node:fs/promises");
    const { dirname } = path;

    // Ensure directory exists
    const dir = dirname(targetPath);
    await mkdir(dir, { recursive: true });

    // Write file
    await writeFile(targetPath, content, "utf-8");

    logger.info(`Write file: ${targetPath}, Size: ${content.length}chars`);
    res.json({ success: true, path: targetPath });
  } catch (error) {
    logger.error(`Write file error: ${error instanceof Error ? error.message : String(error)}`, {
      targetPath,
    });
    res.status(500).json({ error: String(error) });
  }
}

/**
 * Batch delete files - corresponds to /api/files/batch-delete
 */
// Prohibited system-critical directories（Only system directories, not user directories）
const PROTECTED_PATHS = [
  "/",
  "/bin",
  "/boot",
  "/dev",
  "/etc",
  "/lib",
  "/lib64",
  "/proc",
  "/run",
  "/sbin",
  "/sys",
  "/usr",
  "/var",
  // Note: /root and /home removed，Because users need to manage their own files
  // These paths protected by isPathAllowed
];

const MAX_DELETE_COUNT = 100;

export async function batchDelete(req: Request, res: Response) {
  const { paths } = req.body;

  // Parameter validation
  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ error: "paths parameter required and must be non-empty array" });
    return;
  }

  // Quantity limit
  if (paths.length > MAX_DELETE_COUNT) {
    res.status(400).json({
      error: `Can only delete max ${MAX_DELETE_COUNT}   items`,
      maxAllowed: MAX_DELETE_COUNT,
      requested: paths.length,
    });
    return;
  }

  const results = [];
  const errors = [];
  let totalSize = 0;

  try {
    const { unlink, stat, rmdir } = await import("node:fs/promises");

    // Stage 1: Validate all paths
    const validatedPaths = [];
    for (const filePath of paths) {
      const targetPath = expandPath(filePath);

      // Check if within allowed path range
      if (!isPathAllowed(targetPath)) {
        errors.push({
          path: filePath,
          error: "Access denied - Path not in allowed range",
        });
        continue;
      }

      // Check if protected system directory
      const isProtected = PROTECTED_PATHS.some(
        (protectedPath) =>
          targetPath === protectedPath || targetPath.startsWith(`${protectedPath}/`)
      );
      if (isProtected) {
        errors.push({
          path: filePath,
          error: "Access denied - System-critical directories protected",
        });
        logger.warn(`Attempt to delete protected path: ${targetPath}`);
        continue;
      }

      // Check if files/directories exist
      try {
        const stats = await stat(targetPath);
        validatedPaths.push({
          originalPath: filePath,
          resolvedPath: targetPath,
          isDirectory: stats.isDirectory(),
          size: stats.size,
        });
        totalSize += stats.size;
      } catch {
        errors.push({ path: filePath, error: "Files or directories don't exist" });
      }
    }

    // If no valid paths, return directly
    if (validatedPaths.length === 0) {
      res.status(400).json({
        error: "No valid files or directories to delete",
        validated: 0,
        requested: paths.length,
        errors,
      });
      return;
    }

    // Stage 2: Execute deletion
    logger.info(`Start batch delete: ${validatedPaths.length}   items, Total size: ${totalSize} bytes`);

    for (const { originalPath, resolvedPath, isDirectory, size } of validatedPaths) {
      try {
        if (isDirectory) {
          // Recursively delete directories
          await rmdir(resolvedPath, { recursive: true });
          logger.info(`Delete directory successful: ${resolvedPath}`);
        } else {
          // Delete files
          await unlink(resolvedPath);
          logger.info(`Delete filesSuccess: ${resolvedPath}, Size: ${size} bytes`);
        }

        results.push({
          path: originalPath,
          success: true,
          isDirectory,
          size,
        });
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ path: originalPath, error: errorMsg });
        logger.error(`Delete failed: ${resolvedPath}, Error: ${errorMsg}`);
      }
    }

    // Log complete results
    const success = errors.length === 0;
    const statusCode = success ? 200 : errors.length < paths.length ? 207 : 400;

    logger.info(
      `Batch delete complete: ${results.length} Success, ${errors.length} Failed, Total size: ${totalSize} bytes`
    );

    res.status(statusCode).json({
      success,
      deleted: results.length,
      failed: errors.length,
      totalSize,
      results: success ? undefined : results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error(`Batch delete system error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: "Delete operation failed",
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Batch move files - corresponds to /api/files/batch-move
 */
export async function batchMove(req: Request, res: Response) {
  const { paths, targetPath } = req.body;

  if (!paths || !Array.isArray(paths) || paths.length === 0) {
    res.status(400).json({ error: "paths parameter required and must be non-empty array" });
    return;
  }

  if (!targetPath) {
    res.status(400).json({ error: "targetPath parameter required" });
    return;
  }

  const expandedTarget = expandPath(targetPath);

  if (!isPathAllowed(expandedTarget)) {
    res.status(403).json({ error: "Target path access denied" });
    return;
  }

  const results = [];
  const errors = [];

  try {
    const { rename, stat, mkdir } = await import("node:fs/promises");

    // Ensure target directory exists
    try {
      const targetStats = await stat(expandedTarget);
      if (!targetStats.isDirectory()) {
        res.status(400).json({ error: "Target path must be directory" });
        return;
      }
    } catch {
      // Directory doesn't exist, create it
      await mkdir(expandedTarget, { recursive: true });
    }

    for (const filePath of paths) {
      const sourcePath = expandPath(filePath);

      if (!isPathAllowed(sourcePath)) {
        errors.push({ path: filePath, error: "Source path access denied" });
        continue;
      }

      try {
        const fileName = path.basename(sourcePath);
        const destPath = path.join(expandedTarget, fileName);

        // Check if target exists
        try {
          await stat(destPath);
          // File exists, add numeric suffix
          const ext = path.extname(fileName);
          const base = path.basename(fileName, ext);
          let newDestPath = destPath;
          let counter = 1;

          while (true) {
            const newName = `${base} (${counter})${ext}`;
            newDestPath = path.join(expandedTarget, newName);
            try {
              await stat(newDestPath);
              counter++;
            } catch {
              break;
            }
          }

          await rename(sourcePath, newDestPath);
          results.push({
            path: filePath,
            success: true,
            destination: newDestPath,
          });
        } catch {
          // Target doesn't exist, move directly
          await rename(sourcePath, destPath);
          results.push({
            path: filePath,
            success: true,
            destination: destPath,
          });
        }

        logger.info(`Move success: ${sourcePath} -> ${expandedTarget}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        errors.push({ path: filePath, error: errorMsg });
        logger.error(`Move failed: ${sourcePath}, Error: ${errorMsg}`);
      }
    }

    logger.info(`Batch move complete: ${results.length} Success, ${errors.length} Failed`);
    res.json({
      success: errors.length === 0,
      moved: results.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error(`Batch move error: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ error: String(error) });
  }
}

/**
 * Execute command - corresponds to /api/execute
 */
export async function execute(req: Request, res: Response) {
  const { command, cwd, streaming } = req.body;

  if (!command) {
    res.status(400).json({ error: "command parameter required" });
    return;
  }

  const workingDir = cwd ? expandPath(cwd) : process.cwd();

  if (!isPathAllowed(workingDir)) {
    res.status(403).json({ error: "Access denied" });
    return;
  }

  try {
    const { spawn } = await import("node:child_process");

    // Parse command
    const [cmd, ...args] = command
      .split(" ")
      .map((s: string) => s.replace(/^"|"$/g, "").replace(/^'|'$/g, ""));

    if (streaming) {
      // Stream execution
      const child = spawn(cmd, args, {
        cwd: workingDir,
        env: process.env,
        shell: false,
      });

      // Set streaming response
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("Transfer-Encoding", "chunked");

      child.stdout.on("data", (data: Buffer) => {
        res.write(data);
      });

      child.stderr.on("data", (data: Buffer) => {
        res.write(data);
      });

      child.on("close", (code: number | null) => {
        res.write(`\n\n[Process exited, code: ${code ?? "unknown"}]\n`);
        res.end();
      });

      child.on("error", (error: Error) => {
        res.write(`[Execute error: ${error.message}]\n`);
        res.end();
      });

      logger.info(`Streaming execute command: ${command}, Working directory: ${workingDir}`);
    } else {
      // Non-streaming execution
      const child = spawn(cmd, args, {
        cwd: workingDir,
        env: process.env,
        shell: false,
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on("close", (code: number | null) => {
        const isError = code !== 0;
        const result = errorOutput ? `${output}\n${errorOutput}`.trim() : output.trim();

        logger.info(`Execute command: ${command}, Working directory: ${workingDir}, Exit code: ${code}`);
        res.json({
          success: !isError,
          output: result || "(no output)",
          exitCode: code,
          isError,
        });
      });

      child.on("error", (error: Error) => {
        logger.error(`Execute command error: ${error.message}`, { command, workingDir });
        res.json({
          success: false,
          output: error.message,
          exitCode: null,
          isError: true,
        });
      });
    }
  } catch (error) {
    logger.error(`Execute command exception: ${error instanceof Error ? error.message : String(error)}`, {
      command,
      workingDir,
    });
    res.status(500).json({ error: String(error) });
  }
}
