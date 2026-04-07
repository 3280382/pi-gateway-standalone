/**
 * Session Utility Functions
 * Shared utilities for core session module
 */

import { homedir } from "node:os";
import { join } from "node:path";

// Constants
export const AGENT_DIR = join(homedir(), ".pi", "agent");

/**
 * Encode working directory as safe directory name (as pi coding agent does)
 */
export function encodeCwd(cwd: string): string {
	// Remove leading slashes and replace path separators with dashes
	return `--${cwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
}

/**
 * Get working directory's session directory (pi coding agent standard)
 */
export function getLocalSessionsDir(workingDir: string): string {
	const encodedDir = encodeCwd(workingDir);
	return join(AGENT_DIR, "sessions", encodedDir);
}

/**
 * Expand path (handle ~ and relative paths)
 */
export function expandPath(path: string): string {
	if (path.startsWith("~")) {
		return join(homedir(), path.slice(1));
	}
	if (!path.startsWith("/")) {
		return join(process.cwd(), path);
	}
	return path;
}

/**
 * Extract session ID from session file path
 */
export function extractSessionIdFromPath(sessionPath: string): string {
	const fileName = sessionPath.split("/").pop() || "";
	return fileName.replace(".jsonl", "");
}

/**
 * Generate safe file name
 */
export function safeFileName(name: string): string {
	return name
		.replace(/[^a-zA-Z0-9._-]/g, "_")
		.replace(/_{2,}/g, "_")
		.replace(/^_+|_+$/g, "");
}
