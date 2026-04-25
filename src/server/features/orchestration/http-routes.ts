/**
 * Orchestration HTTP Routes
 */

import type { Application } from "express";

export async function registerOrchestrationHTTPRoutes(app: Application): Promise<void> {
  const c = await import("./orchestration.controller.js");
  const m = await import("./models.controller.js");

  // Prompts
  app.get("/api/orchestration/prompts", c.listPrompts);
  app.get("/api/orchestration/prompts/:name", c.getPrompt);
  app.post("/api/orchestration/prompts", c.createPrompt);
  app.put("/api/orchestration/prompts/:name", c.updatePrompt);
  app.delete("/api/orchestration/prompts/:name", c.deletePrompt);

  // Skills
  app.get("/api/orchestration/skills", c.listSkills);
  app.get("/api/orchestration/skills/:name", c.getSkill);
  app.post("/api/orchestration/skills", c.createSkill);
  app.put("/api/orchestration/skills/:name", c.updateSkill);
  app.delete("/api/orchestration/skills/:name", c.deleteSkill);

  // Models (list + raw edit with backups)
  app.get("/api/orchestration/models", c.listOrchModels);
  app.get("/api/orchestration/models/raw", m.getRawModels);
  app.put("/api/orchestration/models/raw", m.saveRawModels);
  app.post("/api/orchestration/models/add", m.addModel);
  app.delete("/api/orchestration/models/:provider/:modelId", m.deleteModel);

  // Backups
  app.get("/api/orchestration/models/backups", m.listBackups);
  app.post("/api/orchestration/models/backups/:file/restore", m.restoreBackup);

  // Workflows
  app.get("/api/orchestration/workflows", c.listWorkflows);
  app.post("/api/orchestration/workflows", c.createWorkflow);
  app.put("/api/orchestration/workflows/:id", c.updateWorkflow);
  app.delete("/api/orchestration/workflows/:id", c.deleteWorkflow);

  console.log("[API] Orchestration routes registered");
}
