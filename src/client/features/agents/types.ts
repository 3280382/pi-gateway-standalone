/**
 * Frontend Agent Types
 */

export interface Agent {
  id: string;
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
  thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  tools: string[];
  skillNames: string[];
  promptTemplateNames: string[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentFormData {
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
  thinkingLevel: Agent["thinkingLevel"];
  tools: string[];
  skillNames: string[];
  promptTemplateNames: string[];
}
