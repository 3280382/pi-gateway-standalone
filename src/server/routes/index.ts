/**
 * API路由注册
 */

import type { Application } from "express";
import type { LlmLogManager } from "../lib/llm/log-manager";
import {
	browseDirectory,
	executeCommand,
	getDirectoryTree,
	getFileContent,
	getRawFile,
	writeFileContent,
} from "../controllers/file.controller";
import { createLlmLogController } from "../controllers/llm-log.controller";
import { getModels } from "../controllers/model.controller";
import { getSystemPrompt, loadSession } from "../controllers/session.controller";
import { createVersionController } from "../controllers/version.controller";

/**
 * 注册所有API路由
 */
export function registerRoutes(app: Application, llmLogManager: LlmLogManager, serverStartTime: number) {
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

	// 会话API
	app.get("/api/sessions", (_req, res) => {
		res.json({
			sessions: [],
		});
	});
	app.post("/api/session/load", loadSession);
	app.get("/api/system-prompt", getSystemPrompt);

	// 文件系统API
	app.post("/api/browse", browseDirectory);
	app.get("/api/files/tree", getDirectoryTree);
	app.get("/api/files/content", getFileContent);
	app.get("/api/files/raw", getRawFile);
	app.post("/api/files/write", writeFileContent);
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
			path: "/root/pi-mono/packages/gateway",
			name: "gateway",
			isCurrent: true,
			sessionCount: 0,
			lastAccessed: new Date().toISOString(),
		});
	});

	app.get("/api/working-dir", (_req, res) => {
		res.json({
			cwd: "/root/pi-mono/packages/gateway",
		});
	});

	app.get("/api/workspace/recent", (_req, res) => {
		res.json({
			workspaces: [
				{
					path: "/root/pi-mono/packages/gateway",
					name: "gateway",
					isCurrent: true,
					sessionCount: 0,
					lastAccessed: new Date().toISOString(),
				},
			],
		});
	});

	console.log("[API] 所有路由已注册");
}
