/**
 * Orchestration API Service
 */
import { fetchApi } from "@/services/client";

// Types
export interface ResourceItem {
  id: string;
  name: string;
  description?: string;
  path?: string;
  source?: string;
  provider?: string;
  contextWindow?: number;
  agentId?: string;
  skillNames?: string[];
  promptTemplateNames?: string[];
  workingDir?: string;
  createdAt?: string;
  updatedAt?: string;
  // From agents
  defaultModel?: string;
  defaultProvider?: string;
  thinkingLevel?: string;
  tools?: string[];
  skillNames?: string[];
  promptTemplateNames?: string[];
  systemPromptUseDefault?: boolean;
  systemPromptTemplate?: string;
  appendPromptUseDefault?: boolean;
  appendPromptTemplate?: string;
  contextUseDefault?: boolean;
  contextTemplate?: string;
}

// ========== Prompts ==========
export const promptApi = {
  list: (wd?: string) =>
    fetchApi<{ prompts: ResourceItem[] }>(
      `/orchestration/prompts${wd ? `?workingDir=${encodeURIComponent(wd)}` : ""}`
    ).then((r) => r.prompts),
  get: (name: string, wd?: string) =>
    fetchApi<ResourceItem & { content: string }>(
      `/orchestration/prompts/${name}${wd ? `?workingDir=${encodeURIComponent(wd)}` : ""}`
    ),
  create: (data: { name: string; content: string }) =>
    fetchApi<ResourceItem>("/orchestration/prompts", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (name: string, data: { content: string }) =>
    fetchApi<ResourceItem>(`/orchestration/prompts/${name}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  del: (name: string) => fetchApi(`/orchestration/prompts/${name}`, { method: "DELETE" }),
};

// ========== Skills ==========
export const skillApi = {
  list: () => fetchApi<{ skills: ResourceItem[] }>("/orchestration/skills").then((r) => r.skills),
  get: (name: string) =>
    fetchApi<ResourceItem & { content: string }>(`/orchestration/skills/${name}`),
  create: (data: { name: string; content: string }) =>
    fetchApi<ResourceItem>("/orchestration/skills", { method: "POST", body: JSON.stringify(data) }),
  update: (name: string, data: { content: string }) =>
    fetchApi<ResourceItem>(`/orchestration/skills/${name}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  del: (name: string) => fetchApi(`/orchestration/skills/${name}`, { method: "DELETE" }),
};

// ========== Models ==========
export const modelApi = {
  list: () => fetchApi<{ models: ResourceItem[] }>("/orchestration/models").then((r) => r.models),
};

// ========== Workflows ==========
export const workflowApi = {
  list: () =>
    fetchApi<{ workflows: ResourceItem[] }>("/orchestration/workflows").then((r) => r.workflows),
  create: (data: Record<string, unknown>) =>
    fetchApi<{ workflow: ResourceItem }>("/orchestration/workflows", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((r) => r.workflow),
  update: (id: string, data: Record<string, unknown>) =>
    fetchApi<{ workflow: ResourceItem }>(`/orchestration/workflows/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }).then((r) => r.workflow),
  del: (id: string) => fetchApi(`/orchestration/workflows/${id}`, { method: "DELETE" }),
};
