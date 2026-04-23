/**
 * Chat Feature HTTP Route Registration
 * Centralized registration of all chat-related HTTP API routes
 */

import type { Application } from "express";
import type { LlmLogManager } from "./llm/log-manager.js";

/**
 * Register all Chat Feature HTTP routes
 */
export async function registerChatHTTPRoutes(
  app: Application,
  llmLogManager: LlmLogManager,
  serverStartTime: number
): Promise<void> {
  // System / Version / Status API
  const { createVersionController } = await import("./controllers/version.controller.js");
  const versionController = createVersionController(serverStartTime);

  app.get("/api/version", versionController.getVersion);
  app.get("/api/health", versionController.healthCheck);
  app.get("/api/ready", versionController.readinessCheck);
  app.get("/api/live", versionController.livenessCheck);
  app.get("/api/status", versionController.getStatus);

  // User settings API
  app.get("/api/settings", (_req, res) => {
    res.json({
      theme: "dark",
      fontSize: "small",
      showThinking: true,
      language: "en-US",
    });
  });

  // LLM log API (read-only via HTTP; write via WebSocket: set_llm_log)
  const { createLlmLogController } = await import("./controllers/llm-log.controller.js");
  const llmLogController = createLlmLogController(llmLogManager);
  app.get("/api/llm-log", llmLogController.getLlmLog);

  // Model API (WebSocket only: list_models, set_model)

  // Session API (WebSocket only: list_sessions, load_session, change_dir, new_session)
  const { getSystemPrompt } = await import("./controllers/session.controller.js");
  app.get("/api/system-prompt", getSystemPrompt);

  // Extensions API
  const { getExtensions } = await import("./controllers/extension.controller.js");
  app.get("/api/extensions", getExtensions);

  // OCR API
  const { performOCR } = await import("./controllers/ocr.controller.js");
  app.post("/api/ocr", performOCR);
}
