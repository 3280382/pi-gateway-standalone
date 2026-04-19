/**
 * Session Metadata Manager
 *
 * 职责：持久化 session 运行时状态到独立的 .meta.json 文件
 * - 服务器重启后恢复状态
 * - 异步写入，不阻塞主流程
 * - 与 session 文件一一对应
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Session metadata structure
 */
export interface SessionMetadata {
  /** Current runtime status */
  runtimeStatus: string;
  /** Last activity timestamp (ISO string) */
  lastActivity: string;
  /** Metadata file update timestamp */
  updatedAt: string;
  /** Optional: last message timestamp */
  lastMessageAt?: string;
}

/**
 * Get metadata file path from session file path
 * Example: /path/to/session.jsonl -> /path/to/session.meta.json
 */
function getMetadataPath(sessionFile: string): string {
  return sessionFile.replace(/\.jsonl$/, ".meta.json");
}

/**
 * Load session metadata from file
 * @returns metadata or null if not exists
 */
export async function loadSessionMetadata(
  sessionFile: string
): Promise<SessionMetadata | null> {
  const metaPath = getMetadataPath(sessionFile);

  if (!existsSync(metaPath)) {
    return null;
  }

  try {
    const content = await readFile(metaPath, "utf-8");
    const metadata = JSON.parse(content) as SessionMetadata;

    // Validate required fields
    if (!metadata.runtimeStatus || !metadata.lastActivity) {
      console.warn(`[SessionMetadata] Invalid metadata in ${metaPath}`);
      return null;
    }

    return metadata;
  } catch (error) {
    console.warn(`[SessionMetadata] Failed to load ${metaPath}:`, error);
    return null;
  }
}

/**
 * Save session metadata to file (async, non-blocking)
 */
export async function saveSessionMetadata(
  sessionFile: string,
  metadata: Partial<SessionMetadata>
): Promise<void> {
  const metaPath = getMetadataPath(sessionFile);

  try {
    // Load existing metadata if available
    const existing = await loadSessionMetadata(sessionFile);

    const newMetadata: SessionMetadata = {
      runtimeStatus: metadata.runtimeStatus || existing?.runtimeStatus || "idle",
      lastActivity: metadata.lastActivity || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastMessageAt: metadata.lastMessageAt || existing?.lastMessageAt,
    };

    await writeFile(metaPath, JSON.stringify(newMetadata, null, 2), "utf-8");
  } catch (error) {
    // Fail silently - metadata is best-effort
    console.warn(`[SessionMetadata] Failed to save ${metaPath}:`, error);
  }
}

/**
 * Batch load metadata for multiple sessions
 */
export async function batchLoadSessionMetadata(
  sessionFiles: string[]
): Promise<Map<string, SessionMetadata>> {
  const results = new Map<string, SessionMetadata>();

  await Promise.all(
    sessionFiles.map(async (file) => {
      const metadata = await loadSessionMetadata(file);
      if (metadata) {
        results.set(file, metadata);
      }
    })
  );

  return results;
}

/**
 * Delete metadata file (when session is deleted)
 */
export async function deleteSessionMetadata(sessionFile: string): Promise<void> {
  const metaPath = getMetadataPath(sessionFile);

  try {
    if (existsSync(metaPath)) {
      const { unlink } = await import("node:fs/promises");
      await unlink(metaPath);
    }
  } catch (error) {
    console.warn(`[SessionMetadata] Failed to delete ${metaPath}:`, error);
  }
}
