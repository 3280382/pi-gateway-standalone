/**
 * HTTP 路由注册
 * 按 Feature 组织路由注册
 */

import type { Application } from "express";
import type { LlmLogManager } from "../llm/log-manager";

// ============================================================================
// Feature 路由注册函数类型
// ============================================================================

// ============================================================================
// Feature: System（系统/版本相关）
// ============================================================================

async function registerSystemRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
): Promise<void> {
	const { createVersionController } = await import(
		"../controllers/version.controller"
	);
	const versionController = createVersionController(serverStartTime);

	// 版本和状态 API
	app.get("/api/version", versionController.getVersion);
	app.get("/api/health", versionController.healthCheck);
	app.get("/api/ready", versionController.readinessCheck);
	app.get("/api/live", versionController.livenessCheck);
	app.get("/api/status", versionController.getStatus);

	// LLM 日志 API
	const { createLlmLogController } = await import(
		"../controllers/llm-log.controller"
	);
	const llmLogController = createLlmLogController(llmLogManager);
	app.get("/api/llm-log", llmLogController.getLlmLog);
	app.post("/api/llm-log/enabled", llmLogController.setLlmLogEnabled);

	// 用户设置 API
	app.get("/api/settings", (_req, res) => {
		res.json({
			theme: "dark",
			fontSize: "small",
			showThinking: true,
			language: "zh-CN",
		});
	});
}

// ============================================================================
// Feature: Models（模型相关）
// ============================================================================

async function registerModelRoutes(app: Application): Promise<void> {
	const { getModels } = await import("../controllers/model.controller");

	app.get("/api/models", getModels);
	app.post("/api/models", async (req, res) => {
		const { model, provider } = req.body;
		// Model change is handled via WebSocket, this is just for confirmation
		res.json({ success: true, model, provider });
	});
}

// ============================================================================
// Feature: Sessions（会话相关）
// ============================================================================

async function registerSessionRoutes(app: Application): Promise<void> {
	const { getSessions, getSystemPrompt, loadSession } = await import(
		"../controllers/session.controller"
	);

	app.get("/api/sessions", getSessions);
	app.post("/api/session/load", loadSession);
	app.get("/api/system-prompt", getSystemPrompt);
}

// ============================================================================
// Feature: Files（文件系统相关）
// ============================================================================

async function registerFileRoutes(app: Application): Promise<void> {
	const {
		batchDeleteFiles,
		batchMoveFiles,
		browseDirectory,
		executeCommand,
		getDirectoryTree,
		getFileContent,
		getRawFile,
		writeFileContent,
	} = await import("../controllers/file.controller");

	app.post("/api/browse", browseDirectory);
	app.get("/api/files/tree", getDirectoryTree);
	app.get("/api/files/content", getFileContent);
	app.get("/api/files/raw", getRawFile);
	app.post("/api/files/write", writeFileContent);
	app.post("/api/files/batch-delete", batchDeleteFiles);
	app.post("/api/files/batch-move", batchMoveFiles);
	app.post("/api/execute", executeCommand);
}

// ============================================================================
// Feature: OCR
// ============================================================================

async function registerOCRRoutes(app: Application): Promise<void> {
	const { performOCR } = await import("../controllers/ocr.controller");
	app.post("/api/ocr", performOCR);
}

// ============================================================================
// Feature: Workspace（工作区相关）
// ============================================================================

function registerWorkspaceRoutes(app: Application): void {
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

// ============================================================================
// 主注册函数
// ============================================================================

/**
 * 注册所有 API 路由
 * @param app Express 应用实例
 * @param llmLogManager LLM 日志管理器
 * @param serverStartTime 服务器启动时间
 */
export async function registerRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
): Promise<void> {
	// 并行注册所有路由
	await Promise.all([
		registerSystemRoutes(app, llmLogManager, serverStartTime),
		registerModelRoutes(app),
		registerSessionRoutes(app),
		registerFileRoutes(app),
		registerOCRRoutes(app),
	]);

	// 同步注册（不依赖异步导入）
	registerWorkspaceRoutes(app);

	console.log("[API] 所有路由已注册");
}
