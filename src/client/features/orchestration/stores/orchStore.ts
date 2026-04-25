/**
 * Orchestration Store
 */
import { create } from "zustand";
import { promptApi, skillApi, modelApi, workflowApi, type ResourceItem } from "../services/api";
import { listAgents as fetchAgents } from "@/features/agents/services/agentApi";

export type OrchView = "agents" | "prompts" | "skills" | "models" | "workflows";
export type EditorType = "agent" | "content" | "model";

interface OrchState {
  view: OrchView;
  items: ResourceItem[];
  loading: boolean;
  error: string | null;
  editingItem: ResourceItem | null;
  isEditorOpen: boolean;
  editorType: EditorType;

  setView: (v: OrchView) => void;
  loadItems: (workingDir?: string) => Promise<void>;
  createItem: (name: string, content: string, extra?: Record<string, unknown>) => Promise<void>;
  updateItem: (id: string, content: string) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  openEditor: (item?: ResourceItem) => void;
  closeEditor: () => void;
  clearError: () => void;
}

export const useOrchStore = create<OrchState>((set, get) => ({
  view: "agents",
  items: [],
  loading: false,
  error: null,
  editingItem: null,
  isEditorOpen: false,
  editorType: "agent",

  setView: (v) => {
    const editorType: EditorType = v === "agents" ? "agent" : v === "models" ? "model" : "content";
    set({ view: v, items: [], editingItem: null, editorType });
    get().loadItems();
  },

  loadItems: async (wd) => {
    set({ loading: true, error: null });
    try {
      const { view } = get();
      let items: ResourceItem[] = [];
      switch (view) {
        case "agents": {
          const agents = await fetchAgents();
          items = agents.map((a: any) => ({
            id: a.id,
            name: a.name,
            description: a.description,
            defaultModel: a.defaultModel,
            defaultProvider: a.defaultProvider,
            thinkingLevel: a.thinkingLevel,
            tools: a.tools,
            skillNames: a.skillNames,
            promptTemplateNames: a.promptTemplateNames,
            systemPromptUseDefault: a.systemPromptUseDefault,
            systemPromptTemplate: a.systemPromptTemplate,
            appendPromptUseDefault: a.appendPromptUseDefault,
            appendPromptTemplate: a.appendPromptTemplate,
            contextUseDefault: a.contextUseDefault,
            contextTemplate: a.contextTemplate,
            createdAt: a.createdAt,
            updatedAt: a.updatedAt,
          }));
          break;
        }
        case "prompts": {
          const prompts = await promptApi.list(wd);
          items = prompts.map((p: any) => ({
            id: p.name,
            name: p.name,
            path: p.path,
            source: p.source,
          }));
          break;
        }
        case "skills": {
          const skills = await skillApi.list();
          items = skills.map((s: any) => ({
            id: s.name,
            name: s.name,
            description: s.description,
            path: s.path,
          }));
          break;
        }
        case "models": {
          const models = await modelApi.list();
          items = models.map((m: any) => ({
            id: m.id,
            name: m.name,
            provider: m.provider,
            contextWindow: m.contextWindow,
          }));
          break;
        }
        case "workflows": {
          const wfs = await workflowApi.list();
          items = wfs.map((w: any) => ({
            id: w.id,
            name: w.name,
            description: w.description,
            agentId: w.agentId,
            skillNames: w.skillNames,
            promptTemplateNames: w.promptTemplateNames,
            workingDir: w.workingDir,
            createdAt: w.createdAt,
          }));
          break;
        }
      }
      set({ items, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed", loading: false });
    }
  },

  createItem: async (name, content, extra) => {
    const { view } = get();
    set({ error: null });
    try {
      switch (view) {
        case "prompts":
          await promptApi.create({ name, content });
          break;
        case "skills":
          await skillApi.create({ name, content });
          break;
        case "workflows":
          await workflowApi.create({ name, ...extra } as any);
          break;
        default:
          throw new Error("Not supported");
      }
      set({ isEditorOpen: false, editingItem: null });
      await get().loadItems();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed" });
    }
  },

  updateItem: async (id, content) => {
    const { view } = get();
    set({ error: null });
    try {
      switch (view) {
        case "prompts":
          await promptApi.update(id, { content });
          break;
        case "skills":
          await skillApi.update(id, { content });
          break;
        case "workflows":
          await workflowApi.update(id, { content } as any);
          break;
        default:
          throw new Error("Not supported");
      }
      set({ isEditorOpen: false, editingItem: null });
      await get().loadItems();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed" });
    }
  },

  deleteItem: async (id) => {
    const { view } = get();
    set({ error: null });
    try {
      switch (view) {
        case "agents":
          await (await import("@/features/agents/services/agentApi")).deleteAgent(id);
          break;
        case "prompts":
          await promptApi.del(id);
          break;
        case "skills":
          await skillApi.del(id);
          break;
        case "workflows":
          await workflowApi.del(id);
          break;
        default:
          return;
      }
      await get().loadItems();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed" });
    }
  },

  openEditor: (item) => set({ editingItem: item || null, isEditorOpen: true }),
  closeEditor: () => set({ isEditorOpen: false, editingItem: null }),
  clearError: () => set({ error: null }),
}));
