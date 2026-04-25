/**
 * Agents Feature HTTP Route Registration
 */

import type { Application } from "express";

export async function registerAgentsHTTPRoutes(app: Application): Promise<void> {
  const {
    listAgents,
    getAgent,
    createAgent,
    updateAgent,
    deleteAgent,
    listModels,
    listTemplates,
    listSkills,
  } = await import("./agent.controller.js");

  // Reference data (MUST be before :id to avoid route conflict)
  app.get("/api/agents/models", listModels);
  app.get("/api/agents/templates", listTemplates);
  app.get("/api/agents/skills", listSkills);

  // Agent CRUD
  app.get("/api/agents", listAgents);
  app.get("/api/agents/:id", getAgent);
  app.post("/api/agents", createAgent);
  app.put("/api/agents/:id", updateAgent);
  app.delete("/api/agents/:id", deleteAgent);

  console.log("[API] Agents routes registered (CRUD + models/templates/skills)");
}
