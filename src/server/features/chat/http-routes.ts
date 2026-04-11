/**
 * Chat Feature HTTP Route Registration
 * Centralized registration of all chat-related HTTP API routes
 */

import type { Application } from "express";
import type { LlmLogManager } from "./llm/log-manager";

/**
 * Register all Chat Feature HTTP routes
 */
export async function registerChatHTTPRoutes(
  app: Application,
  llmLogManager: LlmLogManager,
  serverStartTime: number
): Promise<void> {
  // System / Version / Status API
  const { createVersionController } = await import("./controllers/version.controller");
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

  // LLM log API
  const { createLlmLogController } = await import("./controllers/llm-log.controller");
  const llmLogController = createLlmLogController(llmLogManager);
  app.get("/api/llm-log", llmLogController.getLlmLog);
  app.post("/api/llm-log/enabled", llmLogController.setLlmLogEnabled);

  // Model API
  const { getModels } = await import("./controllers/model.controller");
  app.get("/api/models", getModels);
  app.post("/api/models", async (req, res) => {
    const { model, provider } = req.body;
    res.json({ success: true, model, provider });
  });

  // Session API
  const { getSessions, getSystemPrompt, loadSession } = await import(
    "./controllers/session.controller"
  );
  app.get("/api/sessions", getSessions);
  app.post("/api/session/load", loadSession);
  app.get("/api/system-prompt", getSystemPrompt);

  // Extensions API
  const { getExtensions } = await import("./controllers/extension.controller");
  app.get("/api/extensions", getExtensions);

  // OCR API
  const { performOCR } = await import("./controllers/ocr.controller");
  app.post("/api/ocr", performOCR);
}
