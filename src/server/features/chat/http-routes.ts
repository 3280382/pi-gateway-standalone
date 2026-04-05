/**
 * Chat Feature HTTP 路由注册
 * 集中注册所有聊天相关的 HTTP API 路由
 */

import type { Application } from "express";
import type { LlmLogManager } from "./llm/log-manager";

/**
 * 注册 Chat Feature 的所有 HTTP 路由
 */
export async function registerChatHTTPRoutes(
	app: Application,
	llmLogManager: LlmLogManager,
	serverStartTime: number,
): Promise<void> {
	// System / 版本 / 状态 API
	const { createVersionController } = await import(
		"./controllers/version.controller"
	);
	const versionController = createVersionController(serverStartTime);

	app.get("/api/version", versionController.getVersion);
	app.get("/api/health", versionController.healthCheck);
	app.get("/api/ready", versionController.readinessCheck);
	app.get("/api/live", versionController.livenessCheck);
	app.get("/api/status", versionController.getStatus);

	// 用户设置 API
	app.get("/api/settings", (_req, res) => {
		res.json({
			theme: "dark",
			fontSize: "small",
			showThinking: true,
			language: "zh-CN",
		});
	});

	// LLM 日志 API
	const { createLlmLogController } = await import(
		"./controllers/llm-log.controller"
	);
	const llmLogController = createLlmLogController(llmLogManager);
	app.get("/api/llm-log", llmLogController.getLlmLog);
	app.post("/api/llm-log/enabled", llmLogController.setLlmLogEnabled);

	// 模型 API
	const { getModels } = await import("./controllers/model.controller");
	app.get("/api/models", getModels);
	app.post("/api/models", async (req, res) => {
		const { model, provider } = req.body;
		res.json({ success: true, model, provider });
	});

	// 会话 API
	const { getSessions, getSystemPrompt, loadSession } = await import(
		"./controllers/session.controller"
	);
	app.get("/api/sessions", getSessions);
	app.post("/api/session/load", loadSession);
	app.get("/api/system-prompt", getSystemPrompt);

	// OCR API
	const { performOCR } = await import("./controllers/ocr.controller");
	app.post("/api/ocr", performOCR);
}
