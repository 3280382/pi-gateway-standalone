/**
 * Files Feature HTTP 路由注册
 * 集中注册所有文件系统相关的 HTTP API 路由
 */

import type { Application } from "express";

/**
 * 注册 Files Feature 的所有 HTTP 路由
 */
export async function registerFilesHTTPRoutes(app: Application): Promise<void> {
	const {
		batchDeleteFiles,
		batchMoveFiles,
		browseDirectory,
		executeCommand,
		getDirectoryTree,
		getFileContent,
		getRawFile,
		writeFileContent,
	} = await import("./controllers/file.controller");

	app.post("/api/browse", browseDirectory);
	app.get("/api/files/tree", getDirectoryTree);
	app.get("/api/files/content", getFileContent);
	app.get("/api/files/raw", getRawFile);
	app.post("/api/files/write", writeFileContent);
	app.post("/api/files/batch-delete", batchDeleteFiles);
	app.post("/api/files/batch-move", batchMoveFiles);
	app.post("/api/execute", executeCommand);
}

/**
 * 注册 Workspace 相关路由
 */
export function registerWorkspaceRoutes(app: Application): void {
	// 内存中存储最近工作区（重启后丢失，后续可改为持久化）
	const recentWorkspaces = new Map<
		string,
		{ path: string; name: string; lastAccessed: string }
	>();

	app.get("/api/workspace/current", (_req, res) => {
		res.json({
			path: process.cwd(),
			name: process.cwd().split("/").pop() || "pi-gateway-standalone",
			isCurrent: true,
			sessionCount: 0,
			lastAccessed: new Date().toISOString(),
		});
	});

	app.get("/api/working-dir", (_req, res) => {
		res.json({
			cwd: process.cwd(),
		});
	});

	app.get("/api/workspace/recent", (_req, res) => {
		const workspaces = Array.from(recentWorkspaces.values())
			.sort(
				(a, b) =>
					new Date(b.lastAccessed).getTime() -
					new Date(a.lastAccessed).getTime(),
			)
			.slice(0, 10);
		res.json({ workspaces });
	});

	app.post("/api/workspace/recent", (req, res) => {
		const { path } = req.body;
		if (!path || typeof path !== "string") {
			return res.status(400).json({ error: "Path is required" });
		}
		const name = path.split("/").pop() || path;
		recentWorkspaces.set(path, {
			path,
			name,
			lastAccessed: new Date().toISOString(),
		});
		res.json({ success: true });
	});

	app.delete("/api/workspace/recent", (_req, res) => {
		recentWorkspaces.clear();
		res.json({ success: true });
	});
}
