/**
 * Sidebar Extras Store - Additional Zustand State Management
 * For System Prompt, LLM Logs, Model Selection, Thinking Level
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// ============================================================================
// Types
// ============================================================================

export type ThinkingLevel =
	| "off"
	| "minimal"
	| "low"
	| "medium"
	| "high"
	| "xhigh";

export interface Model {
	id: string;
	name: string;
	provider: string;
	description?: string;
}

export interface LlmLogConfig {
	enabled: boolean;
	refreshInterval: number; // seconds
	truncateLength: number; // lines
}

export interface LlmLogEntry {
	timestamp: string;
	level: "info" | "warn" | "error" | "debug";
	message: string;
	metadata?: Record<string, unknown>;
}

export interface SystemPromptTab {
	id: string;
	label: string;
	content: string;
}

export interface SidebarExtrasState {
	// System Prompt Modal
	isSystemPromptOpen: boolean;
	activeSystemPromptTab: string;
	systemPrompts: SystemPromptTab[];

	// LLM Logs Modal
	isLlmLogOpen: boolean;
	llmLogs: LlmLogEntry[];
	llmLogConfig: LlmLogConfig;

	// Model Selector
	isModelSelectorOpen: boolean;
	availableModels: Model[];
	selectedModel: Model | null;

	// Thinking Level
	thinkingLevel: ThinkingLevel;

	// Status Bar
	connectionStatus: "connected" | "disconnected" | "connecting";
	pid: number | null;
}

interface SidebarExtrasActions {
	// System Prompt Actions
	openSystemPrompt: () => void;
	closeSystemPrompt: () => void;
	setActiveSystemPromptTab: (tabId: string) => void;
	setSystemPrompts: (prompts: SystemPromptTab[]) => void;
	updateSystemPromptContent: (tabId: string, content: string) => void;

	// LLM Log Actions
	openLlmLog: () => void;
	closeLlmLog: () => void;
	addLlmLog: (entry: LlmLogEntry) => void;
	clearLlmLogs: () => void;
	setLlmLogConfig: (config: Partial<LlmLogConfig>) => void;

	// Model Selector Actions
	openModelSelector: () => void;
	closeModelSelector: () => void;
	setAvailableModels: (models: Model[]) => void;
	selectModel: (model: Model) => void;

	// Thinking Level Actions
	setThinkingLevel: (level: ThinkingLevel) => void;

	// Status Bar Actions
	setConnectionStatus: (
		status: "connected" | "disconnected" | "connecting",
	) => void;
	setPid: (pid: number | null) => void;

	// Reset
	reset: () => void;
}

// ============================================================================
// Initial State Factory
// ============================================================================

const createInitialState = (): Omit<
	SidebarExtrasState,
	keyof SidebarExtrasActions
> => ({
	// System Prompt Modal
	isSystemPromptOpen: false,
	activeSystemPromptTab: "agents",
	systemPrompts: [
		{ id: "agents", label: "AGENTS.md", content: "" },
		{ id: "system", label: "SYSTEM.md", content: "" },
		{ id: "skills", label: "Skills", content: "" },
	],

	// LLM Logs Modal
	isLlmLogOpen: false,
	llmLogs: [],
	llmLogConfig: {
		enabled: true,
		refreshInterval: 5,
		truncateLength: 1000,
	},

	// Model Selector
	isModelSelectorOpen: false,
	availableModels: [],
	selectedModel: null,

	// Thinking Level
	thinkingLevel: "medium",

	// Status Bar
	connectionStatus: "disconnected",
	pid: null,
});

// ============================================================================
// Store Creation
// ============================================================================

export const useSidebarExtrasStore = create<
	SidebarExtrasState & SidebarExtrasActions
>()(
	devtools(
		persist(
			(set, _get) => ({
				...createInitialState(),

				// System Prompt Actions
				openSystemPrompt: () => {
					set({ isSystemPromptOpen: true }, false, "openSystemPrompt");
				},
				closeSystemPrompt: () => {
					set({ isSystemPromptOpen: false }, false, "closeSystemPrompt");
				},
				setActiveSystemPromptTab: (tabId: string) => {
					set(
						{ activeSystemPromptTab: tabId },
						false,
						"setActiveSystemPromptTab",
					);
				},
				setSystemPrompts: (prompts: SystemPromptTab[]) => {
					set({ systemPrompts: prompts }, false, "setSystemPrompts");
				},
				updateSystemPromptContent: (tabId: string, content: string) => {
					set(
						(state) => ({
							systemPrompts: state.systemPrompts.map((p) =>
								p.id === tabId ? { ...p, content } : p,
							),
						}),
						false,
						"updateSystemPromptContent",
					);
				},

				// LLM Log Actions
				openLlmLog: () => {
					set({ isLlmLogOpen: true }, false, "openLlmLog");
				},
				closeLlmLog: () => {
					set({ isLlmLogOpen: false }, false, "closeLlmLog");
				},
				addLlmLog: (entry: LlmLogEntry) => {
					set(
						(state) => {
							const newLogs = [entry, ...state.llmLogs].slice(
								0,
								state.llmLogConfig.truncateLength,
							);
							return { llmLogs: newLogs };
						},
						false,
						"addLlmLog",
					);
				},
				clearLlmLogs: () => {
					set({ llmLogs: [] }, false, "clearLlmLogs");
				},
				setLlmLogConfig: (config: Partial<LlmLogConfig>) => {
					set(
						(state) => ({
							llmLogConfig: { ...state.llmLogConfig, ...config },
						}),
						false,
						"setLlmLogConfig",
					);
				},

				// Model Selector Actions
				openModelSelector: () => {
					set({ isModelSelectorOpen: true }, false, "openModelSelector");
				},
				closeModelSelector: () => {
					set({ isModelSelectorOpen: false }, false, "closeModelSelector");
				},
				setAvailableModels: (models: Model[]) => {
					set({ availableModels: models }, false, "setAvailableModels");
				},
				selectModel: (model: Model) => {
					set({ selectedModel: model }, false, "selectModel");
				},

				// Thinking Level Actions
				setThinkingLevel: (level: ThinkingLevel) => {
					set({ thinkingLevel: level }, false, "setThinkingLevel");
				},

				// Status Bar Actions
				setConnectionStatus: (
					status: "connected" | "disconnected" | "connecting",
				) => {
					set({ connectionStatus: status }, false, "setConnectionStatus");
				},
				setPid: (pid: number | null) => {
					set({ pid }, false, "setPid");
				},

				// Reset
				reset: () => {
					set(createInitialState(), false, "reset");
				},
			}),
			{
				name: "sidebar-extras-storage",
				partialize: (state) => ({
					llmLogConfig: state.llmLogConfig,
					selectedModel: state.selectedModel,
					thinkingLevel: state.thinkingLevel,
				}),
			},
		),
		{ name: "SidebarExtrasStore" },
	),
);

// ============================================================================
// Selectors
// ============================================================================

export const selectIsSystemPromptOpen = (state: SidebarExtrasState) =>
	state.isSystemPromptOpen;
export const selectActiveSystemPromptTab = (state: SidebarExtrasState) =>
	state.activeSystemPromptTab;
export const selectSystemPrompts = (state: SidebarExtrasState) =>
	state.systemPrompts;
export const selectIsLlmLogOpen = (state: SidebarExtrasState) =>
	state.isLlmLogOpen;
export const selectLlmLogs = (state: SidebarExtrasState) => state.llmLogs;
export const selectLlmLogConfig = (state: SidebarExtrasState) =>
	state.llmLogConfig;
export const selectIsModelSelectorOpen = (state: SidebarExtrasState) =>
	state.isModelSelectorOpen;
export const selectAvailableModels = (state: SidebarExtrasState) =>
	state.availableModels;
export const selectSelectedModel = (state: SidebarExtrasState) =>
	state.selectedModel;
export const selectThinkingLevel = (state: SidebarExtrasState) =>
	state.thinkingLevel;
export const selectConnectionStatus = (state: SidebarExtrasState) =>
	state.connectionStatus;
export const selectPid = (state: SidebarExtrasState) => state.pid;
