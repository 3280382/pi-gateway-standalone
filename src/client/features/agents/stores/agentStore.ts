/**
 * Agent Store - Agent state management
 */

import { create } from "zustand";
import {
  listAgents as fetchAgents,
  createAgent as createAgentApi,
  updateAgent as updateAgentApi,
  deleteAgent as deleteAgentApi,
  listModels as fetchModels,
  listTemplates as fetchTemplates,
  listSkills as fetchSkills,
  type ModelRef,
  type TemplateRef,
  type SkillRef,
} from "../services/agentApi";
import type { Agent, AgentFormData } from "../types";

interface AgentState {
  agents: Agent[];
  models: ModelRef[];
  templates: TemplateRef[];
  skills: SkillRef[];
  isLoading: boolean;
  error: string | null;
  editingAgent: Agent | null;
  isFormOpen: boolean;

  loadAgents: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadTemplates: (workingDir?: string) => Promise<void>;
  loadSkills: () => Promise<void>;
  loadAllRefData: (workingDir?: string) => Promise<void>;
  addAgent: (data: AgentFormData) => Promise<Agent>;
  editAgent: (id: string, data: Partial<AgentFormData>) => Promise<void>;
  removeAgent: (id: string) => Promise<void>;
  setEditingAgent: (agent: Agent | null) => void;
  setFormOpen: (open: boolean) => void;
  clearError: () => void;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  agents: [],
  models: [],
  templates: [],
  skills: [],
  isLoading: false,
  error: null,
  editingAgent: null,
  isFormOpen: false,

  loadAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const agents = await fetchAgents();
      set({ agents, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load agents",
        isLoading: false,
      });
    }
  },

  loadModels: async () => {
    try {
      set({ models: await fetchModels() });
    } catch {
      /* ignore */
    }
  },

  loadTemplates: async (workingDir?: string) => {
    try {
      set({ templates: await fetchTemplates(workingDir) });
    } catch {
      /* ignore */
    }
  },

  loadSkills: async () => {
    try {
      set({ skills: await fetchSkills() });
    } catch {
      /* ignore */
    }
  },

  loadAllRefData: async (workingDir?: string) => {
    await Promise.all([get().loadModels(), get().loadTemplates(workingDir), get().loadSkills()]);
  },

  addAgent: async (data: AgentFormData) => {
    set({ error: null });
    const agent = await createAgentApi(data as Record<string, unknown>);
    set((s) => ({ agents: [...s.agents, agent], isFormOpen: false, editingAgent: null }));
    return agent;
  },

  editAgent: async (id, data) => {
    set({ error: null });
    const updated = await updateAgentApi(id, data as Record<string, unknown>);
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? updated : a)),
      isFormOpen: false,
      editingAgent: null,
    }));
  },

  removeAgent: async (id) => {
    set({ error: null });
    await deleteAgentApi(id);
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) }));
  },

  setEditingAgent: (agent) => set({ editingAgent: agent, isFormOpen: true }),
  setFormOpen: (open) => set({ isFormOpen: open, editingAgent: open ? get().editingAgent : null }),
  clearError: () => set({ error: null }),
}));
