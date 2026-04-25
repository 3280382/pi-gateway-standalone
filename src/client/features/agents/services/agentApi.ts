/**
 * Agent API Service
 */

import { fetchApi } from "@/services/client";
import type { Agent } from "../types";

export async function listAgents(): Promise<Agent[]> {
  const res = await fetchApi<{ agents: Agent[] }>("/agents");
  return res.agents;
}

export async function createAgent(data: Record<string, unknown>): Promise<Agent> {
  const res = await fetchApi<{ agent: Agent }>("/agents", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return res.agent;
}

export async function updateAgent(id: string, data: Record<string, unknown>): Promise<Agent> {
  const res = await fetchApi<{ agent: Agent }>(`/agents/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.agent;
}

export async function deleteAgent(id: string): Promise<void> {
  await fetchApi(`/agents/${id}`, { method: "DELETE" });
}

// Reference data for forms
export interface ModelRef {
  id: string;
  provider: string;
  name: string;
  contextWindow?: number;
}
export interface TemplateRef {
  name: string;
  path: string;
  source: string;
  content?: string;
}
export interface SkillRef {
  name: string;
  description: string;
  path: string;
  source: string;
}

export async function listModels(): Promise<ModelRef[]> {
  const res = await fetchApi<{ models: ModelRef[] }>("/agents/models");
  return res.models;
}

export async function listTemplates(workingDir?: string): Promise<TemplateRef[]> {
  const qs = workingDir ? `?workingDir=${encodeURIComponent(workingDir)}` : "";
  const res = await fetchApi<{ templates: TemplateRef[] }>(`/agents/templates${qs}`);
  return res.templates;
}

export async function listSkills(): Promise<SkillRef[]> {
  const res = await fetchApi<{ skills: SkillRef[] }>("/agents/skills");
  return res.skills;
}
