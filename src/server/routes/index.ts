/**
 * API路由注册
 */

import type { LlmLogManager } from "@server/llm/log-manager";
import type { Application } from "express";
import {
	batchDeleteFiles,
	batchMoveFiles,
	browseDirectory,
	executeCommand,
	getDirectoryTree,
	getFileContent,
	getRawFile,
	writeFileContent,
} from "../controllers/file.controller";
import { createLlmLogController } from "../controllers/llm-log.controller";
import { getModels } from "../controllers/model.controller";
import {
	getSessions,
	getSystemPrompt,
	loadSession,
} from "../controllers/session.controller";
import { createVersionController } from "../controllers/version.controller";

/**
 * 注册所有API路由
 */
export function registerRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
) {
	// 创建控制器实例
	const versionController = createVersionController(serverStartTime);
	const llmLogController = createLlmLogController(llmLogManager);

	// 版本和状态API
	app.get("/api/version", versionController.getVersion);
	app.get("/api/health", versionController.healthCheck);
	app.get("/api/ready", versionController.readinessCheck);
	app.get("/api/live", versionController.livenessCheck);
	app.get("/api/status", versionController.getStatus);

	// 模型API
	app.get("/api/models", getModels);
	app.post("/api/models", async (req, res) => {
		const { model, provider } = req.body;
		// Model change is handled via WebSocket, this is just for confirmation
		res.json({ success: true, model, provider });
	});

	// 会话API
	app.get("/api/sessions", getSessions);
	app.post("/api/session/load", loadSession);
	app.get("/api/system-prompt", getSystemPrompt);

	// 文件系统API
	app.post("/api/browse", browseDirectory);
	app.get("/api/files/tree", getDirectoryTree);
	app.get("/api/files/content", getFileContent);
	app.get("/api/files/raw", getRawFile);
	app.post("/api/files/write", writeFileContent);
	app.post("/api/files/batch-delete", batchDeleteFiles);
	app.post("/api/files/batch-move", batchMoveFiles);
	app.post("/api/execute", executeCommand);

	// LLM日志API
	app.get("/api/llm-log", llmLogController.getLlmLog);
	app.post("/api/llm-log/enabled", llmLogController.setLlmLogEnabled);

	// 用户设置API
	app.get("/api/settings", (_req, res) => {
		res.json({
			theme: "dark",
			fontSize: "small",
			showThinking: true,
			language: "zh-CN",
		});
	});

	// 工作空间API
	app.get("/api/workspace/current", (_req, res) => {
		res.json({
			path: "/root/pi-gateway-standalone",
			name: "pi-gateway-standalone",
			isCurrent: true,
			sessionCount: 0,
			lastAccessed: new Date().toISOString(),
		});
	});

	app.get("/api/working-dir", (_req, res) => {
		res.json({
			cwd: "/root/pi-gateway-standalone",
		});
	});

	// 内存中存储最近工作区（重启后丢失，后续可改为持久化）
	const recentWorkspaces = new Map<
		string,
		{ path: string; name: string; lastAccessed: string }
	>();

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

	console.log("[API] 所有路由已注册");
}
