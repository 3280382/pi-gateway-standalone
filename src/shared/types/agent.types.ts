/**
 * Agent-related type definitions
 * Complete coverage of pi SDK configurable parameters
 */

// ============================================================================
// Agent Configuration (complete pi SDK options)
// ============================================================================

export interface AgentConfig {
  id: string;
  name: string;
  description: string;

  // --- System Prompt ---
  /** If true, system prompt is loaded via default discovery (SYSTEM.md). */
  systemPromptUseDefault: boolean;
  /** Template name to use as system prompt override (only when systemPromptUseDefault=false) */
  systemPromptTemplate: string;

  // --- Append Prompt ---
  /** If true, append prompt is loaded via default discovery. */
  appendPromptUseDefault: boolean;
  /** Template name to use as append prompt override (only when appendPromptUseDefault=false) */
  appendPromptTemplate: string;

  // --- Extra Context (AGENTS.md) ---
  /** If true, AGENTS.md context is loaded via default discovery. */
  contextUseDefault: boolean;
  /** Template name to use as AGENTS.md override (only when contextUseDefault=false) */
  contextTemplate: string;

  // --- Model ---
  defaultModel: string;
  defaultProvider: string;
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

  // --- Tools ---
  tools: string[];

  // --- Skills ---
  skillNames: string[];

  // --- Prompt Templates (slash commands) ---
  promptTemplateNames: string[];

  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Agent Config Map
// ============================================================================

export interface AgentConfigMap {
  [id: string]: AgentConfig;
}
export interface AgentConfigStore {
  agents: AgentConfigMap;
}

// ============================================================================
// API Types
// ============================================================================

export interface CreateAgentRequest {
  name: string;
  description: string;
  systemPromptUseDefault: boolean;
  systemPromptTemplate: string;
  appendPromptUseDefault: boolean;
  appendPromptTemplate: string;
  contextUseDefault: boolean;
  contextTemplate: string;
  defaultModel: string;
  defaultProvider: string;
  thinkingLevel: AgentConfig["thinkingLevel"];
  tools?: string[];
  skillNames?: string[];
  promptTemplateNames?: string[];
}

export interface UpdateAgentRequest extends Partial<CreateAgentRequest> {}

export interface AgentListResponse {
  agents: AgentConfig[];
}
export interface AgentResponse {
  agent: AgentConfig;
}

// ============================================================================
// Reference types
// ============================================================================

export interface AgentModel {
  id: string;
  provider: string;
  name: string;
  contextWindow?: number;
}
export interface AgentTemplate {
  name: string;
  source: "global" | "local";
  path: string;
  content?: string;
}
export interface AgentSkill {
  name: string;
  description: string;
  path?: string;
}
