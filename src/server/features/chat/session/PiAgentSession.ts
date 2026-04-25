/**
 * PiAgentSession Class
 * Manages a single pi-coding-agent session instance and its WebSocket message delivery
 *
 * Lifecycle:
 * - constructor(): Create instance with WebSocket and LLM log manager
 * - initialize(workingDir): Create NEW AgentSession (called once per workingDir)
 * - reconnect(ws): Reuse existing session with new WebSocket (re-subscribes events)
 * - dispose(): Cleanup resources
 *
 * Note: Session reuse decisions are made by ServerSessionManager, not this class.
 * This class focuses on managing one AgentSession instance and its event handling.
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  createCodingTools,
  createReadOnlyTools,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  createReadTool,
  createBashTool,
  createEditTool,
  createWriteTool,
  createGrepTool,
  createFindTool,
  createLsTool,
} from "@mariozechner/pi-coding-agent";
import { WebSocket } from "ws";
import type { LlmLogManager } from "../llm/log-manager.js";
import type { AgentConfig } from "@shared/types/agent.types.js";
import { createAgentTool } from "../../agents/agent-tool.js";

import { extractShortSessionId, serverSessionManager } from "./SessionRegistry.js";
import { AGENT_DIR, getLocalSessionsDir } from "./utils.js";

/**
 * Server message interface
 */
export interface ServerMessage extends Record<string, unknown> {
  type: string;
}

/**
 * List of file write-related tool names
 */
const writeFileTools = [
  "write_file",
  "create_file",
  "edit_file",
  "apply_diff",
  "writeFile",
  "createFile",
  "editFile",
  "applyDiff",
];

/**
 * PiAgentSession Class
 * Encapsulates the complete lifecycle management of pi-coding-agent sessions
 */
export class PiAgentSession {
  /** Agent session */
  session: AgentSession | null = null;

  /** WebSocket connection */
  ws: WebSocket;

  /** Current working directory */
  workingDir: string = process.cwd();

  /** Authentication storage */
  authStorage: ReturnType<typeof AuthStorage.create>;

  /** Model registry */
  modelRegistry: ModelRegistry;

  /** Settings manager */
  settingsManager: ReturnType<typeof SettingsManager.create>;

  /** Whether streaming is in progress */
  isStreaming: boolean = false;

  /** Message buffer */
  messageBuffer: string = "";

  /** Event unsubscribe function */
  unsubscribeFn: (() => void) | null = null;

  /** LLM log manager reference */
  readonly llmLogManager: LlmLogManager;

  /** Current content block tracking for start/end events */
  private currentContentBlock: {
    type: "thinking" | "text" | "tool" | null;
    index: number;
    toolCallId?: string;
    toolName?: string;
  } = { type: null, index: -1 };

  /** Track if message_start has been sent for current message */
  private messageStarted: boolean = false;

  /** Active tool execution tracking */
  private activeToolExecution: { toolCallId: string; toolName: string; startTime: Date } | null =
    null;

  /** Inside message flag for event handling */
  private insideMessage: boolean = false;

  /** Short session ID */
  shortId: string = "";

  /** Current runtime status */
  runtimeStatus:
    | "idle"
    | "thinking"
    | "tooling"
    | "streaming"
    | "waiting"
    | "error"
    | "retrying"
    | "compacting" = "idle";

  /**
   * Create new PiAgentSession
   * @param ws WebSocket connection
   * @param llmLogManager LLM log manager
   */
  constructor(ws: WebSocket, llmLogManager: LlmLogManager) {
    this.ws = ws;
    this.llmLogManager = llmLogManager;
    this.authStorage = AuthStorage.create();
    this.modelRegistry = ModelRegistry.create(this.authStorage, "/root/.pi/agent/models.json");
    this.settingsManager = SettingsManager.create();
  }

  /**
   * Set status update callback
   */
  setStatusUpdateCallback(callback: (shortId: string, status: string) => void): void {
    this.statusUpdateCallback = callback;
  }

  /**
   * Update runtime status via callback
   */
  private updateRuntimeStatus(status: typeof this.runtimeStatus): void {
    this.runtimeStatus = status;
    if (this.shortId && this.statusUpdateCallback) {
      this.statusUpdateCallback(this.shortId, status);
    }
  }

  /**
   * Get current runtime status
   */
  getRuntimeStatus(): typeof this.runtimeStatus {
    return this.runtimeStatus;
  }

  /**
   * Initialize a NEW session for the given working directory
   *
   * IMPORTANT: This method always creates a NEW AgentSession.
   * For reusing existing session with same workingDir, use reconnect() instead.
   *
   * The session reuse decision is made by ServerSessionManager.getOrCreateSession().
   *
   * @param workingDir Working directory
   * @param sessionFile Optional specific session file to open/create
   * @param agentConfig Optional agent configuration for custom system prompt and model
   * @returns Session information
   */
  async initialize(workingDir: string, sessionFile?: string, agentConfig?: AgentConfig) {
    console.log(`[PiAgentSession.initialize] ========== START ==========`);
    console.log(
      `[PiAgentSession.initialize] Input: workingDir="${workingDir}", sessionFile="${sessionFile || "auto"}"`
    );
    console.log(
      `[PiAgentSession.initialize] Current state: this.workingDir="${this.workingDir}", this.session exists: ${!!this.session}`
    );

    // Note: Session reuse check is now handled by ServerSessionManager.getOrCreateSession()
    // This method should only be called when creating a NEW session
    // For reconnecting, use reconnect() instead

    console.log(
      `[PiAgentSession.initialize] Creating new AgentSession for workingDir: ${workingDir}`
    );

    // Unsubscribe from old session events
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }

    // Cleanup old session
    if (this.session) {
      console.log(`[PiAgentSession.initialize] Disposing old session`);
      this.session.dispose();
      this.session = null;
    }

    this.workingDir = workingDir;
    const localSessionsDir = getLocalSessionsDir(workingDir);
    console.log(`[PiAgentSession.initialize] Set this.workingDir="${workingDir}"`);
    console.log(`[PiAgentSession.initialize] localSessionsDir="${localSessionsDir}"`);

    let sessionManager: ReturnType<typeof SessionManager.create> | undefined;

    // If specific sessionFile provided, use it directly
    if (sessionFile) {
      console.log(`[PiAgentSession.initialize] Using provided sessionFile: ${sessionFile}`);
      try {
        sessionManager = SessionManager.open(sessionFile, localSessionsDir);
        console.log(`[PiAgentSession.initialize] Successfully opened session file`);
      } catch (error) {
        console.warn(
          `[PiAgentSession.initialize] Failed to open session file: ${sessionFile}, error:`,
          error
        );
        // If sessionFile explicitly specified but opening failed，throw error
        // Should not fall back to recently used session，because user explicitly selected specific session
        throw new Error(`Failed to open specified session file: ${sessionFile}. Error: ${error}`);
      }
    }

    // If no sessionFile specified or opening failed，find recently used session
    if (!sessionManager) {
      // Get all sessions list
      console.log(
        `[PiAgentSession.initialize] Calling SessionManager.list("${workingDir}", "${localSessionsDir}")`
      );
      const sessions = await SessionManager.list(workingDir, localSessionsDir);
      console.log(`[PiAgentSession.initialize] Found ${sessions.length} sessions in directory`);
      sessions.forEach((s, i) =>
        console.log(
          `[PiAgentSession.initialize]   [${i}] id=${s.id}, path=${s.path}, modified=${s.modified}`
        )
      );

      // Always use most recent session（sorted by modification time）
      if (sessions.length > 0) {
        const mostRecent = sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];
        console.log(`[PiAgentSession.initialize] Using most recent session: ${mostRecent.path}`);
        sessionManager = SessionManager.open(mostRecent.path, localSessionsDir);
      }
    }

    if (!sessionManager) {
      console.log(
        `[PiAgentSession.initialize] Creating NEW session for workingDir="${workingDir}"`
      );
      sessionManager = SessionManager.create(workingDir, localSessionsDir);
    }

    // Build DefaultResourceLoader options from agent config
    const loaderOpts: Record<string, unknown> = {
      cwd: workingDir,
      agentDir: AGENT_DIR,
      settingsManager: this.settingsManager,
    };

    if (agentConfig) {
      // --- System Prompt ---
      if (!agentConfig.systemPromptUseDefault && agentConfig.systemPromptTemplate) {
        const content = await loadTemplateFile(agentConfig.systemPromptTemplate, workingDir);
        if (content) {
          // systemPromptOverride: (baseSystemPrompt: string) => string
          loaderOpts.systemPromptOverride = (_base: string) => content;
          console.log(
            `[Gateway] System prompt override: template=${agentConfig.systemPromptTemplate}`
          );
        }
      } else if (agentConfig.systemPromptUseDefault) {
        console.log(`[Gateway] System prompt: using default discovery`);
      }

      // --- Append Prompt ---
      if (!agentConfig.appendPromptUseDefault && agentConfig.appendPromptTemplate) {
        const content = await loadTemplateFile(agentConfig.appendPromptTemplate, workingDir);
        if (content) {
          // appendSystemPromptOverride: (base: string[]) => string[]
          loaderOpts.appendSystemPromptOverride = (base: string[]) => [...base, content];
          console.log(
            `[Gateway] Append prompt override: template=${agentConfig.appendPromptTemplate}`
          );
        }
      } else if (agentConfig.appendPromptUseDefault) {
        console.log(`[Gateway] Append prompt: using default discovery`);
      }

      // --- Extra Context (AGENTS.md) ---
      if (!agentConfig.contextUseDefault && agentConfig.contextTemplate) {
        const content = await loadTemplateFile(agentConfig.contextTemplate, workingDir);
        if (content) {
          // agentsFilesOverride: (current: { agentsFiles: Array<{path:string, content:string}> }) => { agentsFiles: [...] }
          loaderOpts.agentsFilesOverride = (current: {
            agentsFiles: Array<{ path: string; content: string }>;
          }) => ({
            agentsFiles: [
              ...current.agentsFiles,
              { path: `/virtual/agent-${agentConfig.contextTemplate}.md`, content },
            ],
          });
          console.log(`[Gateway] Context override: template=${agentConfig.contextTemplate}`);
        }
      } else if (agentConfig.contextUseDefault) {
        console.log(`[Gateway] Context: using default AGENTS.md discovery`);
      }

      // --- Skills ---
      if (agentConfig.skillNames?.length) {
        loaderOpts.skillsOverride = (current: {
          skills: Array<{ name: string; description: string; filePath: string; baseDir: string }>;
          diagnostics: unknown[];
        }) => {
          const filtered = current.skills.filter((s) => agentConfig.skillNames!.includes(s.name));
          console.log(
            `[Gateway] Skills filter: ${agentConfig.skillNames} -> ${filtered.length}/${current.skills.length}`
          );
          return { skills: filtered, diagnostics: current.diagnostics };
        };
      }

      // --- Prompt Templates (slash commands) ---
      if (agentConfig.promptTemplateNames?.length) {
        loaderOpts.promptsOverride = (current: {
          prompts: Array<{ name: string; description: string; content: string; source: string }>;
          diagnostics: unknown[];
        }) => {
          const filtered = current.prompts.filter((p) =>
            agentConfig.promptTemplateNames!.includes(p.name)
          );
          return { prompts: filtered, diagnostics: current.diagnostics };
        };
      }
    }

    const loader = new DefaultResourceLoader(loaderOpts as any);
    await loader.reload();

    // Log loaded resources for debugging
    const agentsFiles = loader.getAgentsFiles().agentsFiles;
    console.log(`[Gateway] Loaded ${agentsFiles.length} AGENTS.md files:`);
    for (const file of agentsFiles) {
      console.log(`  - ${file.path}`);
    }
    const systemPrompt = loader.getSystemPrompt();
    console.log(`[Gateway] System prompt: ${systemPrompt ? "custom" : "default"}`);
    const appendSystemPrompt = loader.getAppendSystemPrompt();
    if (appendSystemPrompt.length > 0) {
      console.log(`[Gateway] Append system prompt: ${appendSystemPrompt.length} files`);
    }

    // Resolve tools from agent config or use default coding tools
    const selectedTools = agentConfig?.tools?.length
      ? resolveTools(agentConfig.tools, workingDir)
      : createCodingTools(workingDir);
    console.log(`[Gateway] Tools: ${selectedTools.map((t: any) => t.name).join(", ")}`);

    // Extract shortId before creating tool (tool needs it in closure via sessionManager)
    const sessionShortId = extractShortSessionId((sessionManager as any).getSessionFile?.() || "");

    const { session: agentSession } = await createAgentSession({
      cwd: workingDir,
      agentDir: AGENT_DIR,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      sessionManager,
      tools: selectedTools,
      resourceLoader: loader,
      customTools: [createAgentTool(this.llmLogManager, sessionShortId)],
    });

    this.session = agentSession;
    this.setupEventHandlers();
    this.shortId = sessionShortId;
    this.updateRuntimeStatus("idle");

    console.log(
      `[Gateway] Session created: shortId=${this.shortId}, sessionId=${agentSession.sessionId}, sessionFile=${agentSession.sessionFile}`
    );

    // Check if session has model setting, if not set default model
    if (!agentSession.model) {
      if (agentConfig?.defaultProvider && agentConfig?.defaultModel) {
        const agentModel = this.modelRegistry.find(
          agentConfig.defaultProvider,
          agentConfig.defaultModel
        );
        if (agentModel) {
          await agentSession.setModel(agentModel);
          console.log(`[Gateway] Agent model set to: ${agentModel.id}`);
        } else {
          console.log(
            `[Gateway] Agent model not found: ${agentConfig.defaultProvider}/${agentConfig.defaultModel}`
          );
          const defaultModel = this.modelRegistry.find("deepseek", "deepseek-chat");
          if (defaultModel) {
            await agentSession.setModel(defaultModel);
            console.log(`[Gateway] Default model set to: ${defaultModel.id}`);
          }
        }
      } else {
        const defaultModel = this.modelRegistry.find("deepseek", "deepseek-chat");
        if (defaultModel) {
          await agentSession.setModel(defaultModel);
          console.log(`[Gateway] Default model set to: ${defaultModel.id}`);
        }
      }
    } else {
      console.log(`[Gateway] Using session saved model: ${agentSession.model.id}`);
    }

    // Set agent thinking level if provided
    if (agentConfig?.thinkingLevel && agentConfig.thinkingLevel !== agentSession.thinkingLevel) {
      agentSession.setThinkingLevel(agentConfig.thinkingLevel);
      console.log(`[Gateway] Agent thinking level set to: ${agentConfig.thinkingLevel}`);
    }

    // Set LLM log file for this session
    console.log(
      `[Gateway] Calling setLogFile with sessionFile=${agentSession.sessionFile}, sessionId=${agentSession.sessionId}`
    );
    this.llmLogManager.setLogFile(agentSession.sessionFile, agentSession.sessionId);
    console.log(
      `[Gateway] LLM log: ${this.llmLogManager.getLogFilePath() || "disabled (memory session)"}`
    );

    // Get skills list
    const skills = loader.getSkills().skills;

    // Collect all resource file paths
    const settingsPath = join(AGENT_DIR, "settings.json");
    const resourceFiles = {
      // System prompt files
      systemPrompt: {
        global: join(AGENT_DIR, "SYSTEM.md"),
        project: join(workingDir, ".pi", "SYSTEM.md"),
        loaded: systemPrompt ? "custom" : "default",
      },
      // Append system prompt files
      appendSystemPrompt: loader.getAppendSystemPrompt().map((f: any) => ({
        path: f.path,
        exists: existsSync(f.path),
      })),
      // AGENTS.md files
      agentsFiles: agentsFiles.map((f: any) => ({
        path: f.path,
        exists: existsSync(f.path),
        content: f.content || "",
      })),
      // Settings file
      settings: {
        path: settingsPath,
        exists: existsSync(settingsPath),
      },
      // Auth file
      auth: {
        path: join(AGENT_DIR, "auth.json"),
        exists: existsSync(join(AGENT_DIR, "auth.json")),
      },
      // Session file
      session: {
        path: agentSession.sessionFile,
        exists: agentSession.sessionFile ? existsSync(agentSession.sessionFile) : false,
      },
      // Model registry
      models: {
        path: join(AGENT_DIR, "models.json"),
        exists: existsSync(join(AGENT_DIR, "models.json")),
      },
      // Skills directory
      skills: {
        global: join(AGENT_DIR, "skills"),
        project: join(workingDir, ".pi", "skills"),
        loaded: skills.map((s: any) => ({
          name: s.name,
          description: s.description || "",
          path: s.filePath || s.path || "builtin",
        })),
      },
      // Prompt templates directory
      prompts: {
        global: join(AGENT_DIR, "prompts"),
        project: join(workingDir, ".pi", "prompts"),
      },
    };

    console.log("[Gateway] Resource file paths:", JSON.stringify(resourceFiles, null, 2));

    // Debug: check if paths are consistent
    const expectedDir = getLocalSessionsDir(workingDir);
    console.log(`[Gateway] Expected sessions directory: ${expectedDir}`);
    console.log(`[Gateway] Actual sessionFile: ${agentSession.sessionFile}`);
    if (agentSession.sessionFile && !agentSession.sessionFile.startsWith(expectedDir)) {
      console.warn(
        `[Gateway] Path mismatch! Expected prefix: ${expectedDir}, actual: ${agentSession.sessionFile}`
      );
    }
    console.log(
      `[Gateway] sessionFile exists:`,
      agentSession.sessionFile ? existsSync(agentSession.sessionFile) : false
    );

    // Store resourceFiles and agent info for live session info retrieval
    (this as any)._resourceFiles = resourceFiles;
    (this as any)._agentName = agentConfig?.name || null;
    (this as any)._agentId = agentConfig?.id || null;

    return {
      sessionId: agentSession.sessionId,
      sessionFile: agentSession.sessionFile,
      workingDir: this.workingDir,
      model: agentSession.model?.id || null,
      modelProvider: agentSession.model?.provider || null,
      thinkingLevel: agentSession.thinkingLevel,
      systemPrompt: systemPrompt || "",
      agentId: agentConfig?.id || null,
      agentName: agentConfig?.name || null,
      agentsFiles: agentsFiles.map((f: any) => ({
        path: f.path,
        content: f.content,
      })),
      skills: skills.map((s: any) => ({
        name: s.name,
        description: s.description,
      })),
      resourceFiles,
    };
  }

  /**
   * End current content block if any
   */
  private endCurrentContentBlock(timestamp: string): void {
    if (this.currentContentBlock.type === null) return;

    switch (this.currentContentBlock.type) {
      case "thinking":
        console.log(`[${timestamp}] [SEND] thinking_end (implicit)`);
        this.send({
          type: "thinking_end",
          index: this.currentContentBlock.index,
          implicit: true,
        });
        break;
      case "text":
        console.log(`[${timestamp}] [SEND] text_end (implicit)`);
        this.send({
          type: "text_end",
          index: this.currentContentBlock.index,
          implicit: true,
        });
        break;
      case "tool":
        console.log(
          `[${timestamp}] [SEND] toolcall_end (implicit): ${this.currentContentBlock.toolName}`
        );
        break;
    }
    this.currentContentBlock = { type: null, index: -1 };
  }

  /**
   * Setup event handlers - simplified version
   *
   * Core event flow:
   * message_start (assistant) -> content blocks -> message_end
   *
   * Content blocks:
   * - thinking_start -> thinking_delta* -> thinking_end
   * - text_start -> text_delta* -> text_end
   * - toolcall_start -> toolcall_delta* -> toolcall_end
   */
  setupEventHandlers() {
    if (!this.session) return;

    this.unsubscribeFn = this.session.subscribe((event: AgentSessionEvent) => {
      const timestamp = new Date().toISOString().split("T")[1].split(".")[0];

      switch (event.type) {
        // Turn boundary - indicates Pi coding agent turn start/end
        case "turn_start": {
          console.log(`[${timestamp}] [SEND] turn_start`);
          this.updateRuntimeStatus("thinking");
          this.send({ type: "turn_start" });
          break;
        }

        case "turn_end": {
          console.log(`[${timestamp}] [SEND] turn_end`);
          // AI enters waiting state after completing output（waiting for user input），not idle
          this.updateRuntimeStatus("waiting");
          this.send({ type: "turn_end" });
          break;
        }

        // Session events - forward to client
        case "queue_update": {
          console.log(`[${timestamp}] [SEND] queue_update`);
          this.send({
            type: "queue_update",
            steering: event.steering,
            followUp: event.followUp,
          });
          break;
        }

        case "compaction_start": {
          console.log(`[${timestamp}] [SEND] compaction_start: ${event.reason}`);
          this.updateRuntimeStatus("compacting");
          this.send({
            type: "compaction_start",
            reason: event.reason,
          });
          break;
        }

        case "compaction_end": {
          console.log(`[${timestamp}] [SEND] compaction_end: ${event.reason}`);
          // Return to previous status or idle if not retrying
          if (!event.willRetry) {
            this.updateRuntimeStatus("idle");
          }
          this.send({
            type: "compaction_end",
            reason: event.reason,
            result: event.result,
            aborted: event.aborted,
            willRetry: event.willRetry,
            errorMessage: event.errorMessage,
          });
          break;
        }

        case "auto_retry_start": {
          console.log(`[${timestamp}] [SEND] auto_retry_start: attempt ${event.attempt}`);
          this.updateRuntimeStatus("retrying");
          this.send({
            type: "auto_retry_start",
            attempt: event.attempt,
            maxAttempts: event.maxAttempts,
            delayMs: event.delayMs,
            errorMessage: event.errorMessage,
          });
          break;
        }

        case "auto_retry_end": {
          console.log(`[${timestamp}] [SEND] auto_retry_end: success=${event.success}`);
          // If retry failed, set error status
          if (!event.success) {
            this.updateRuntimeStatus("error");
          }
          this.send({
            type: "auto_retry_end",
            success: event.success,
            attempt: event.attempt,
            finalError: event.finalError,
          });
          break;
        }

        // Message boundary - only process assistant messages
        case "message_start": {
          const startMsg = event.message;
          if (startMsg.role === "assistant") {
            console.log(`[${timestamp}] [SEND] message_start: ${(startMsg as any).id || "new"}`);
            this.messageStarted = true;
            this.send({ type: "message_start", message: startMsg });
          }
          break;
        }

        case "message_end": {
          const endMsg = event.message;
          this.endCurrentContentBlock(timestamp);

          if (endMsg.role === "assistant" && this.messageStarted) {
            console.log(`[${timestamp}] [SEND] message_end: ${(endMsg as any).id}`);
            this.send({ type: "message_end", message: endMsg });

            // Send usage information if available
            const assistantMsg = endMsg as any;
            if (assistantMsg.usage) {
              this.send({
                type: "usage",
                usage: {
                  inputTokens: assistantMsg.usage.input,
                  outputTokens: assistantMsg.usage.output,
                  totalTokens: assistantMsg.usage.totalTokens,
                  cost: assistantMsg.usage.cost?.total || 0,
                  model: assistantMsg.model,
                },
              });
            }

            this.messageStarted = false;
          }
          break;
        }

        // Content blocks - actual message content
        case "message_update": {
          const msgEvent = event.assistantMessageEvent;
          const contentIndex = (msgEvent as any).contentIndex;
          const partial = (msgEvent as any).partial;

          switch (msgEvent.type) {
            case "thinking_start": {
              this.endCurrentContentBlock(timestamp);
              this.currentContentBlock = {
                type: "thinking",
                index: contentIndex,
              };
              this.updateRuntimeStatus("thinking");
              this.send({ type: "thinking_start", index: contentIndex });
              break;
            }
            case "thinking_delta": {
              this.send({
                type: "thinking_delta",
                thinking: msgEvent.delta,
                index: contentIndex,
              });
              break;
            }
            case "thinking_end": {
              this.send({ type: "thinking_end", index: contentIndex });
              this.currentContentBlock = { type: null, index: -1 };
              break;
            }
            case "text_start": {
              this.endCurrentContentBlock(timestamp);
              this.currentContentBlock = { type: "text", index: contentIndex };
              this.updateRuntimeStatus("streaming");
              this.send({ type: "text_start", index: contentIndex });
              break;
            }
            case "text_delta": {
              this.send({
                type: "text_delta",
                text: msgEvent.delta,
                index: contentIndex,
              });
              break;
            }
            case "text_end": {
              this.send({ type: "text_end", index: contentIndex });
              this.currentContentBlock = { type: null, index: -1 };
              break;
            }
            case "toolcall_start": {
              this.endCurrentContentBlock(timestamp);
              const toolCall = partial.content?.[contentIndex];
              if (toolCall?.type === "toolCall") {
                this.currentContentBlock = {
                  type: "tool",
                  index: contentIndex,
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                };
                this.updateRuntimeStatus("tooling");
              }
              break;
            }
            case "toolcall_delta": {
              break;
            }
            case "toolcall_end": {
              const toolCall = partial.content?.[contentIndex];
              if (toolCall?.type === "toolCall") {
                // no-op
              }
              this.currentContentBlock = { type: null, index: -1 };
              break;
            }
          }
          break;
        }

        // Tool actual execution event
        case "tool_execution_start": {
          // Use currentContentBlock's toolCallId to ensure consistency with toolcall_start
          const toolCallId = this.currentContentBlock?.toolCallId || event.toolCallId;
          this.activeToolExecution = {
            toolCallId,
            toolName: event.toolName,
            startTime: new Date(),
          };
          this.updateRuntimeStatus("tooling");
          this.send({
            type: "tool_execution_start",
            toolCallId,
            toolName: event.toolName,
            args: event.args,
          });
          break;
        }

        case "tool_execution_end": {
          this.activeToolExecution = null;
          // Use currentContentBlock's toolCallId to ensure consistency with toolcall_start
          const toolCallId = this.currentContentBlock?.toolCallId || event.toolCallId;
          const toolResult = event.result;
          const toolName = event.toolName;
          const isWriteOperation =
            toolName &&
            writeFileTools.some((t) =>
              toolName.toLowerCase().includes(t.toLowerCase().replace("_", ""))
            );

          this.send({
            type: "tool_execution_end",
            toolCallId,
            toolName,
            result: toolResult,
            isError: event.isError,
          });
          break;
        }
      }
    });
  }

  /**
   * Send prompt
   * @param text Prompt text
   * @param images Optional image array
   */
  async prompt(
    text: string,
    images?: Array<{
      type: "image";
      source: { type: "base64"; mediaType: string; data: string };
    }>
  ) {
    console.log(
      `[PiAgentSession.prompt] Starting processing, session exists: ${!!this.session}, isStreaming: ${this.isStreaming}`
    );
    if (!this.session) {
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }

    try {
      // Convert images to correct format
      const convertedImages: ImageContent[] | undefined = images?.map((img) => ({
        type: "image" as const,
        data: img.source.data,
        mimeType: img.source.mediaType,
      }));

      console.log(`[PiAgentSession.prompt] Calling session.prompt, text length: ${text.length}`);
      if (this.isStreaming) {
        await this.session.prompt(text, {
          images: convertedImages,
          streamingBehavior: "steer",
        });
      } else {
        await this.session.prompt(text, { images: convertedImages });
      }
      console.log("[PiAgentSession.prompt] session.prompt completed");
    } catch (error) {
      console.error("[PiAgentSession.prompt] Error:", error);
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Compact session via SDK
   * Called by WebSocket handler
   */
  async compactSession(
    customInstructions?: string
  ): Promise<{ success: boolean; output: string; isError: boolean }> {
    if (!this.session) {
      return { success: false, output: "Session not initialized", isError: true };
    }

    try {
      const stats = this.session.getSessionStats();
      if (stats.totalMessages < 2) {
        return { success: false, output: "Nothing to compact (no messages yet)", isError: true };
      }

      await this.session.compact(customInstructions);
      return { success: true, output: "Session compaction completed", isError: false };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Compaction failed";
      return { success: false, output: message, isError: true };
    }
  }

  /**
   * Export session via SDK
   * Called by WebSocket handler
   */
  async exportSession(
    outputPath?: string
  ): Promise<{ success: boolean; output: string; isError: boolean }> {
    if (!this.session) {
      return { success: false, output: "Session not initialized", isError: true };
    }

    try {
      if (outputPath?.endsWith(".jsonl")) {
        const filePath = this.session.exportToJsonl(outputPath);
        return { success: true, output: `Session exported to: ${filePath}`, isError: false };
      } else {
        const filePath = await this.session.exportToHtml(outputPath);
        return { success: true, output: `Session exported to: ${filePath}`, isError: false };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export failed";
      return { success: false, output: message, isError: true };
    }
  }

  /**
   * Steer (during streaming)
   * @param text Steer text
   */
  async steer(text: string) {
    if (!this.session) {
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }

    try {
      await this.session.steer(text);
    } catch (error) {
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Follow-up (during streaming, delivered after agent finishes)
   */
  async followUp(text: string) {
    if (!this.session) {
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }
    try {
      await this.session.followUp(text);
    } catch (error) {
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Abort current operation
   */
  async abort() {
    if (!this.session) return;
    try {
      await this.session.abort();
    } catch (error) {
      console.error("[Gateway] Abort error:", error);
    }
  }

  /**
   * Reload session resources (skills, extensions, prompts, themes)
   */
  async reload() {
    if (!this.session) {
      console.error("[Gateway] reload failed: session is null");
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }
    try {
      console.log("[Gateway] Calling session.reload()");
      await this.session.reload();
      console.log("[Gateway] session.reload() completed");
      this.send({ type: "reload_result", success: true });
    } catch (error) {
      console.error("[Gateway] Reload error:", error);
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to reload session",
      });
    }
  }

  /**
   * Create new session - ensures using current working directory
   */
  async newSession() {
    if (!this.session) return;
    try {
      // Check if we need to reinitialize to ensure correct working directory
      const currentSessionFile = this.session.sessionFile;
      const expectedSessionsDir = getLocalSessionsDir(this.workingDir);

      // If current session file is not in the expected directory, reinitialize
      if (currentSessionFile && !currentSessionFile.startsWith(expectedSessionsDir)) {
        console.log(
          `[Gateway] Session directory mismatch, reinitializing with: ${this.workingDir}`
        );
        await this.initialize(this.workingDir);
      }

      await (this.session as any).newSession();
    } catch (error) {
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to create new session",
      });
    }
  }

  /**
   * Set model
   * @param provider Provider
   * @param modelId Model ID
   * @param thinkingLevel Thinking level (optional)
   */
  async setModel(
    provider: string,
    modelId: string,
    thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
  ) {
    console.log(`[Gateway] setModel called: provider=${provider}, modelId=${modelId}`);

    if (!this.session) {
      console.error("[Gateway] setModel failed: session is null");
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }

    const model = this.modelRegistry.find(provider, modelId);
    console.log(`[Gateway] modelRegistry.find result:`, model);

    if (!model) {
      console.error(`[Gateway] Model not found: ${provider}/${modelId}`);
      this.send({
        type: "error",
        error: `Model ${provider}/${modelId} not found`,
      });
      return;
    }

    try {
      console.log(`[Gateway] Calling session.setModel with:`, model);
      await this.session.setModel(model);
      console.log(`[Gateway] session.setModel succeeded`);

      if (thinkingLevel) {
        await this.session.setThinkingLevel(thinkingLevel);
      }

      console.log(`[Gateway] Sending model_set response`);
      this.send({
        type: "model_set",
        model: `${model.provider}/${model.id}`,
        provider: model.provider,
        thinkingLevel: this.session.thinkingLevel,
      });
      console.log(`[Gateway] model_set response sent`);
    } catch (error) {
      console.error(`[Gateway] setModel error:`, error);
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to set model",
      });
    }
  }

  /**
   * Set thinking level
   * @param thinkingLevel Thinking level
   */
  async setThinkingLevel(thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh") {
    console.log(`[Gateway] setThinkingLevel called: ${thinkingLevel}`);
    if (!this.session) {
      console.error("[Gateway] setThinkingLevel failed: session is null");
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }
    try {
      console.log(`[Gateway] Calling session.setThinkingLevel with: ${thinkingLevel}`);
      this.session.setThinkingLevel(thinkingLevel);
      console.log(`[Gateway] Sending thinking_set response`);
      this.send({
        type: "thinking_set",
        data: { thinkingLevel },
      });
    } catch (error) {
      console.error(`[Gateway] setThinkingLevel error:`, error);
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to set thinking level",
      });
    }
  }

  /**
   * Execute tool
   * @param toolName Tool name
   * @param args Arguments
   * @param toolCallId Tool call ID
   */
  async executeTool(toolName: string, args: Record<string, unknown>, toolCallId: string) {
    if (!this.session) {
      this.send({ type: "error", error: "Session not initialized" });
      return;
    }

    try {
      const tools = createCodingTools(this.workingDir);
      const tool = tools.find((t) => t.name === toolName);

      if (!tool) {
        this.send({
          type: "tool_execution_end",
          toolCallId,
          result: `Tool "${toolName}" not found`,
          isError: true,
        });
        return;
      }

      // Execute tool (toolCallId, args, signal)
      const result = await tool.execute(toolCallId, args as Record<string, string>);

      // Send end event
      this.send({
        type: "tool_execution_end",
        toolCallId,
        result: JSON.stringify(result),
        isError: false,
      });
    } catch (error) {
      this.send({
        type: "tool_execution_end",
        toolCallId,
        result: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      });
    }
  }

  /**
   * List available models
   */
  async listModels() {
    try {
      // Read directly from /root/.pi/agent/models.json
      const modelsJsonPath = "/root/.pi/agent/models.json";
      const models: any[] = [];

      if (existsSync(modelsJsonPath)) {
        try {
          const content = await readFile(modelsJsonPath, "utf-8");
          const config = JSON.parse(content);

          if (config.providers) {
            for (const [providerName, providerConfig] of Object.entries(config.providers)) {
              const provider = providerConfig as any;
              if (provider.models && Array.isArray(provider.models)) {
                for (const model of provider.models) {
                  models.push({
                    id: `${providerName}/${model.id}`,
                    provider: providerName,
                    name: model.name || model.id,
                    contextWindow: model.contextWindow || 0,
                    maxTokens: model.maxTokens || 0,
                    reasoning: model.reasoning || false,
                    input: model.input || ["text"],
                  });
                }
              }
            }
          }
        } catch (err) {
          console.error("[PiAgentSession] Failed to read models.json:", err);
        }
      }

      console.log(
        `[PiAgentSession] listModels: returning ${models.length} models, first id: ${models[0]?.id}`
      );

      this.send({
        type: "models_list",
        models,
      });
    } catch (error) {
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to list models",
      });
    }
  }

  /**
   * List sessions
   * @param cwd Working directory
   */
  async listSessions(cwd: string) {
    try {
      const localSessionsDir = getLocalSessionsDir(cwd);
      const sessions = await SessionManager.list(cwd, localSessionsDir);
      this.send({
        type: "sessions_list",
        sessions: sessions.map((s) => ({
          id: s.id,
          path: s.path,
          firstMessage: s.firstMessage,
          messageCount: s.messageCount,
          cwd: s.cwd,
          modified: s.modified.toISOString(),
        })),
      });
    } catch (error) {
      this.send({
        type: "error",
        error: error instanceof Error ? error.message : "Failed to list sessions",
      });
    }
  }

  /**
   * Load session
   * @param sessionPath Session file path
   * @returns Object with success status and cwd change info, or null if no session
   */
  async loadSession(
    sessionPath: string
  ): Promise<{ success: boolean; cwdChanged: boolean; newCwd?: string; error?: string } | null> {
    if (!this.session) return null;
    try {
      // Get target session's cwd from session file
      const targetSessionManager = SessionManager.open(
        sessionPath,
        getLocalSessionsDir(this.workingDir)
      );
      const targetCwd = targetSessionManager.getCwd();

      // If cwd is different, need to reinitialize to load correct AGENTS.md/SYSTEM.md
      if (targetCwd !== this.workingDir) {
        console.log(
          `[Gateway] Session cwd mismatch: ${this.workingDir} -> ${targetCwd}, reinitializing...`
        );
        await this.initialize(targetCwd);
        return { success: true, cwdChanged: true, newCwd: targetCwd };
      } else {
        // Same cwd, use switchSession
        const result = await (this.session as any).switchSession(sessionPath);
        // Update session reference after successful switch
        if (result) {
          this.shortId = extractShortSessionId(sessionPath);
          // Update sessionFile reference if accessible
          if (this.session && "sessionFile" in this.session) {
            (this.session as any).sessionFile = sessionPath;
          }
          console.log(
            `[PiAgentSession] Switched to session: ${this.shortId}, path: ${sessionPath}`
          );
        }
        return { success: result, cwdChanged: false };
      }
    } catch (error) {
      return {
        success: false,
        cwdChanged: false,
        error: error instanceof Error ? error.message : "Failed to load session",
      };
    }
  }

  /**
   * Execute bash command using SDK
   * @param command Command string (with or without ! prefix)
   */
  async executeCommand(command: string) {
    if (!this.session) {
      this.send({
        type: "command_result",
        command,
        output: "Session not initialized",
        isError: true,
      });
      return;
    }

    // Remove leading ! or / if present
    const cmd =
      command.startsWith("!") || command.startsWith("/") ? command.slice(1).trim() : command.trim();
    if (!cmd) {
      this.send({
        type: "command_result",
        command,
        output: "Empty command",
        isError: true,
      });
      return;
    }

    try {
      this.send({
        type: "tool_execution",
        tool: "bash",
        command: cmd,
        status: "running",
      });

      const result = await this.session.executeBash(cmd);

      this.send({
        type: "command_result",
        command: `!${cmd}`,
        output: result.output || "(no output)",
        isError: result.exitCode !== 0,
        exitCode: result.exitCode,
      });
    } catch (error) {
      this.send({
        type: "command_result",
        command: `!${cmd}`,
        output: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      });
    }
  }

  /**
   * Get current model
   * @returns Current model or null
   */
  /**
   * Get current session info (system prompt, model, tools, skills, agent)
   */
  getSessionInfo(): Record<string, unknown> {
    if (!this.session) return {};
    const model = this.session.model;
    const tools = (this.session.agent?.state?.tools || []).map((t: any) => ({
      name: t.name,
      label: t.label || t.name,
      description: t.description || "",
      promptSnippet: t.promptSnippet || "",
      promptGuidelines: t.promptGuidelines || [],
      parameters: t.parameters,
    }));
    return {
      systemPrompt: this.session.agent?.state?.systemPrompt || "",
      model: model ? `${model.provider}/${model.id}` : null,
      thinkingLevel: this.session.thinkingLevel,
      tools,
      workingDir: this.workingDir,
      sessionFile: this.session.sessionFile,
      isStreaming: this.isStreaming,
      agentName: (this as any)._agentName || null,
      agentId: (this as any)._agentId || null,
      resourceFiles: (this as any)._resourceFiles || null,
    };
  }

  /** WebSocket connection state */
  private wsConnected: boolean = false;

  /**
   * Message buffer for disconnected mode
   * When WebSocket is not connected, events are cached here
   * Cleared on each message_start, only keeps the most recent complete message
   */
  private messageEventBuffer: ServerMessage[] = [];

  /**
   * Whether currently buffering messages (WebSocket not connected)
   * Set to true when disconnected, false when connected
   */
  private isBuffering: boolean = false;

  private statusUpdateCallback: ((shortId: string, status: string) => void) | null = null;

  /**
   * Send message to WebSocket client
   * Core logic:
   * - If WebSocket is connected: send immediately
   * - If WebSocket is NOT connected: cache to messageEventBuffer
   * - On message_start: clear previous buffer, start new caching
   * - On message_end: keep the complete message in buffer
   * Fail-safe: any WebSocket error is caught and logged, never throws
   * @param message Message object
   */
  send(message: ServerMessage): void {
    this.trackMessageBoundary(message);

    if (!this.canSend()) {
      this.bufferMessage(message, "WebSocket not available");
      return;
    }

    // Route: only send if client is VIEWING this session
    // Background sessions buffer messages until viewed again
    if (!this.isClientViewing()) {
      this.bufferMessage(message, `Client viewing other session, buffering for ${this.shortId}`);
      return;
    }

    this.doSend(message);
  }

  private trackMessageBoundary(message: ServerMessage): void {
    if (message.type === "message_start") {
      this.clearBuffer();
      this.insideMessage = true;
    } else if (message.type === "message_end") {
      this.insideMessage = false;
    }
  }

  private clearBuffer(): void {
    if (this.messageEventBuffer.length === 0) return;
    console.log(`[PiAgentSession] Clearing ${this.messageEventBuffer.length} buffered events`);
    this.messageEventBuffer = [];
  }

  private canSend(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  private isClientViewing(): boolean {
    if (!this.shortId || !this.ws) return true;
    const viewingShortId = serverSessionManager.getViewingSession(this.ws);
    // If no viewing session set yet, allow send (backward compat)
    if (!viewingShortId) return true;
    return viewingShortId === this.shortId;
  }

  private bufferMessage(message: ServerMessage, reason: string): void {
    console.log(`[PiAgentSession] Buffering ${message.type}: ${reason}`);
    this.messageEventBuffer.push(message);
    this.isBuffering = true;
  }

  private doSend(message: ServerMessage): void {
    try {
      this.ws?.send(JSON.stringify(message));
      this.wsConnected = true;
      this.isBuffering = false;
    } catch (error) {
      console.error(`[PiAgentSession] Send failed for ${message.type}:`, error);
      this.bufferMessage(message, "Send error");
      this.wsConnected = false;
    }
  }

  /**
   * Flush buffered messages to WebSocket
   * Called when reconnecting to send cached events first
   * @returns Number of messages flushed
   */
  flushMessageBuffer(): number {
    const bufferSize = this.messageEventBuffer.length;
    if (bufferSize === 0) {
      return 0;
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log(
        `[PiAgentSession.flushMessageBuffer] WebSocket not connected, keeping ${bufferSize} messages in buffer`
      );
      return 0;
    }

    console.log(`[PiAgentSession.flushMessageBuffer] Flushing ${bufferSize} buffered messages`);

    // Send all buffered messages
    for (const message of this.messageEventBuffer) {
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[PiAgentSession.flushMessageBuffer] Error sending buffered message:`, error);
      }
    }

    // Clear the buffer after successful flush
    this.messageEventBuffer = [];
    this.isBuffering = false;

    return bufferSize;
  }

  /**
   * Get current buffer size (for debugging/monitoring)
   */
  getBufferSize(): number {
    return this.messageEventBuffer.length;
  }

  /**
   * Get buffered messages without clearing (for session loading)
   * Used to merge buffer with file messages for seamless experience
   */
  getBufferedMessages(): ServerMessage[] {
    return [...this.messageEventBuffer];
  }

  /**
   * Check if currently buffering messages
   */
  isCurrentlyBuffering(): boolean {
    return this.isBuffering;
  }

  /**
   * Check if WebSocket is currently connected
   */
  isWebSocketConnected(): boolean {
    return this.wsConnected && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current WebSocket instance (for reconnect checking)
   */
  getWebSocket(): WebSocket | null {
    return this.ws;
  }

  /**
   * Reconnect session with new WebSocket
   * Called when reusing existing session with same workingDir but different WebSocket
   * This is the complete reconnection logic that replaces updateWebSocket
   *
   * @param ws New WebSocket connection
   */
  reconnect(ws: WebSocket) {
    console.log(`[PiAgentSession.reconnect] ========== START ==========`);
    console.log(`[PiAgentSession.reconnect] Updating WebSocket and re-subscribing events`);

    // Update WebSocket reference
    this.ws = ws;
    this.wsConnected = true;

    // Unsubscribe from old event handlers (cleanup old subscriptions)
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }

    // Re-setup event handlers (re-subscribe to AgentSession events)
    this.setupEventHandlers();

    // Notify client that session is reconnected FIRST
    // This allows client to prepare for receiving buffered messages
    const bufferSize = this.messageEventBuffer.length;
    this.send({
      type: "session_reconnected",
      message: "Session reconnected, resuming...",
      workingDir: this.workingDir,
      flushedMessages: bufferSize, // Inform client how many messages will be replayed
    });

    // Flush buffered messages AFTER sending reconnected notification
    // This ensures client is ready to handle potentially incomplete message sequences
    const flushedCount = this.flushMessageBuffer();
    if (flushedCount > 0) {
      console.log(`[PiAgentSession.reconnect] Flushed ${flushedCount} buffered messages to client`);
    }

    console.log(`[PiAgentSession.reconnect] ========== END ==========`);
  }

  /**
   * Update WebSocket connection only (legacy method, use reconnect instead)
   * @param ws New WebSocket connection
   * @deprecated Use reconnect() instead
   */
  updateWebSocket(ws: WebSocket) {
    console.log(`[PiAgentSession] Updating WebSocket connection (legacy)`);
    this.ws = ws;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    if (this.unsubscribeFn) {
      this.unsubscribeFn();
      this.unsubscribeFn = null;
    }
    if (this.session) {
      this.session.dispose();
      this.session = null;
    }
  }
}

/**
 * Load a single prompt template file and return its content (stripped of YAML frontmatter)
 */
async function loadTemplateFile(templateName: string, workingDir: string): Promise<string | null> {
  const { existsSync } = await import("node:fs");
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");

  const home = process.env.HOME || homedir();
  const projectPrompts = join(process.cwd(), "prompts");
  const dirs = [
    join(home, ".pi", "agent", "prompts"),
    join(workingDir, ".pi", "prompts"),
    projectPrompts,
  ];

  for (const dir of dirs) {
    const path = join(dir, `${templateName}.md`);
    if (existsSync(path)) {
      try {
        const content = await readFile(path, "utf-8");
        return content.replace(/^---[\s\S]*?---\n?/, "").trim();
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

/**
 * Load prompt template files and concatenate their contents
 */
async function loadPromptTemplates(
  templateNames: string[],
  workingDir: string
): Promise<string | null> {
  const { existsSync } = await import("node:fs");
  const { readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { homedir } = await import("node:os");

  const home = process.env.HOME || homedir();
  const dirs = [join(home, ".pi", "agent", "prompts"), join(workingDir, ".pi", "prompts")];
  const contents: string[] = [];

  for (const name of templateNames) {
    for (const dir of dirs) {
      const path = join(dir, `${name}.md`);
      if (existsSync(path)) {
        try {
          const content = await readFile(path, "utf-8");
          const body = content.replace(/^---[\s\S]*?---\n?/, "").trim();
          if (body) contents.push(body);
        } catch {
          /* skip */
        }
      }
    }
  }

  return contents.length > 0 ? contents.join("\n\n---\n\n") : null;
}

/**
 * Resolve tool names to tool instances for a specific working directory
 */
function resolveTools(toolNames: string[], cwd: string) {
  const toolMap: Record<string, () => any> = {
    read: () => createReadTool(cwd),
    bash: () => createBashTool(cwd),
    edit: () => createEditTool(cwd),
    write: () => createWriteTool(cwd),
    grep: () => createGrepTool(cwd),
    find: () => createFindTool(cwd),
    ls: () => createLsTool(cwd),
  };
  return toolNames.filter((name) => name in toolMap).map((name) => toolMap[name]());
}
