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
import { extractShortSessionId } from "./session-manager";
import {
  type AgentSession,
  type AgentSessionEvent,
  AuthStorage,
  createAgentSession,
  createCodingTools,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
  SettingsManager,
} from "@mariozechner/pi-coding-agent";
import { WebSocket } from "ws";
import type { LlmLogManager } from "../llm/log-manager";
import { AGENT_DIR, getLocalSessionsDir } from "./utils";

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

  /** Short session ID */
  shortId: string = "";

  /** Current runtime status */
  runtimeStatus: "idle" | "thinking" | "tooling" | "streaming" | "waiting" | "error" = "idle";

  /** Active tool execution tracking */
  private activeToolExecution: { toolCallId: string; toolName: string; startTime: Date } | null = null;

  /**
   * Create new PiAgentSession
   * @param ws WebSocket connection
   * @param llmLogManager LLM log manager
   */
  constructor(ws: WebSocket, llmLogManager: LlmLogManager) {
    this.ws = ws;
    this.llmLogManager = llmLogManager;
    this.authStorage = AuthStorage.create();
    this.modelRegistry = new ModelRegistry(this.authStorage, "/root/.pi/agent/models.json");
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
   * Set session verification callback
   * This callback is called before sending each message to verify 
   * the client has selected this session for receiving messages
   * 
   * @param callback Function that takes (ws, shortId) and returns true if client has selected this session
   */
  setSessionVerificationCallback(
    callback: (ws: WebSocket, shortId: string) => boolean
  ): void {
    this.sessionVerificationCallback = callback;
    console.log(`[PiAgentSession] Session verification callback set for ${this.shortId}`);
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
   * @returns Session information
   */
  async initialize(workingDir: string, sessionFile?: string) {
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

    const loader = new DefaultResourceLoader({
      cwd: workingDir,
      agentDir: AGENT_DIR,
      settingsManager: this.settingsManager,
    });
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

    const { session } = await createAgentSession({
      cwd: workingDir,
      agentDir: AGENT_DIR,
      authStorage: this.authStorage,
      modelRegistry: this.modelRegistry,
      settingsManager: this.settingsManager,
      sessionManager,
      tools: createCodingTools(workingDir),
      resourceLoader: loader,
    });

    this.session = session;
    this.setupEventHandlers();

    // Set short ID from session file
    this.shortId = extractShortSessionId(session.sessionFile);
    this.updateRuntimeStatus("idle");

    console.log(
      `[Gateway] Session created: shortId=${this.shortId}, sessionId=${session.sessionId}, sessionFile=${session.sessionFile}`
    );

    // Check if session has model setting, if not set default model
    if (!session.model) {
      const defaultModel = this.modelRegistry.find("deepseek", "deepseek-chat");
      if (defaultModel) {
        await session.setModel(defaultModel);
        console.log(`[Gateway] Default model set to: ${defaultModel.id}`);
      }
    } else {
      console.log(`[Gateway] Using session saved model: ${session.model.id}`);
    }

    // Set LLM log file for this session
    console.log(
      `[Gateway] Calling setLogFile with sessionFile=${session.sessionFile}, sessionId=${session.sessionId}`
    );
    this.llmLogManager.setLogFile(session.sessionFile, session.sessionId);
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
        path: session.sessionFile,
        exists: session.sessionFile ? existsSync(session.sessionFile) : false,
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
          path: s.path || "builtin",
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
    console.log(`[Gateway] Actual sessionFile: ${session.sessionFile}`);
    if (session.sessionFile && !session.sessionFile.startsWith(expectedDir)) {
      console.warn(
        `[Gateway] Path mismatch! Expected prefix: ${expectedDir}, actual: ${session.sessionFile}`
      );
    }
    console.log(
      `[Gateway] sessionFile exists:`,
      session.sessionFile ? existsSync(session.sessionFile) : false
    );

    return {
      sessionId: session.sessionId,
      sessionFile: session.sessionFile,
      workingDir: this.workingDir,
      model: session.model?.id || null,
      modelProvider: session.model?.provider || null,
      thinkingLevel: session.thinkingLevel,
      systemPrompt: systemPrompt || "",
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
        this.send({
          type: "toolcall_end",
          toolCallId: this.currentContentBlock.toolCallId,
          toolName: this.currentContentBlock.toolName,
          index: this.currentContentBlock.index,
          implicit: true,
        });
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
          this.send({
            type: "compaction_start",
            reason: event.reason,
          });
          break;
        }

        case "compaction_end": {
          console.log(`[${timestamp}] [SEND] compaction_end: ${event.reason}`);
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
                this.send({
                  type: "toolcall_start",
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  index: contentIndex,
                });
              }
              break;
            }
            case "toolcall_delta": {
              const toolCall = partial.content?.[contentIndex];
              if (toolCall?.type === "toolCall") {
                this.send({
                  type: "toolcall_delta",
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  delta: msgEvent.delta,
                  args: toolCall.arguments,
                  index: contentIndex,
                });
              }
              break;
            }
            case "toolcall_end": {
              const toolCall = partial.content?.[contentIndex];
              if (toolCall?.type === "toolCall") {
                this.send({
                  type: "toolcall_end",
                  toolCallId: toolCall.id,
                  toolName: toolCall.name,
                  index: contentIndex,
                });
              }
              this.currentContentBlock = { type: null, index: -1 };
              break;
            }
          }
          break;
        }

        // Tool actual execution event
        case "tool_execution_start": {
          this.activeToolExecution = {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            startTime: new Date(),
          };
          this.updateRuntimeStatus("tooling");
          this.send({
            type: "tool_execution_start",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });
          break;
        }

        case "tool_execution_end": {
          this.activeToolExecution = null;
          const toolResult = event.result;
          const toolName = event.toolName;
          const isWriteOperation =
            toolName &&
            writeFileTools.some((t) =>
              toolName.toLowerCase().includes(t.toLowerCase().replace("_", ""))
            );

          if (isWriteOperation && !event.isError) {
            const args = (event as any).args;
            const filePath = args?.path || args?.file_path || args?.filepath || args?.filePath;
            if (typeof filePath === "string") {
              this.sendToolEndWithFileContent(
                event.toolCallId,
                toolResult,
                event.isError,
                filePath
              );
              break;
            }
          }

          this.send({
            type: "tool_execution_end",
            toolCallId: event.toolCallId,
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
  async compactSession(customInstructions?: string): Promise<{ success: boolean; output: string; isError: boolean }> {
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
  async exportSession(outputPath?: string): Promise<{ success: boolean; output: string; isError: boolean }> {
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

      await this.session.newSession();
      this.send({
        type: "session_info",
        sessionId: this.session.sessionId,
        sessionFile: this.session.sessionFile,
      });
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
          type: "tool_end",
          toolCallId,
          result: `Tool "${toolName}" not found`,
          isError: true,
        });
        return;
      }

      // Send start event
      this.send({
        type: "tool_start",
        toolName,
        toolCallId,
        args,
      });

      // Execute tool (toolCallId, args, signal)
      const result = await tool.execute(toolCallId, args as Record<string, string>);

      // Send end event
      this.send({
        type: "tool_end",
        toolCallId,
        result: JSON.stringify(result),
        isError: false,
      });
    } catch (error) {
      this.send({
        type: "tool_end",
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
  async loadSession(sessionPath: string): Promise<{ success: boolean; cwdChanged: boolean; newCwd?: string; error?: string } | null> {
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
        const result = await this.session.switchSession(sessionPath);
        // Update session reference after successful switch
        if (result) {
          this.shortId = extractShortSessionId(sessionPath);
          // Update sessionFile reference if accessible
          if (this.session && 'sessionFile' in this.session) {
            (this.session as any).sessionFile = sessionPath;
          }
          console.log(`[PiAgentSession] Switched to session: ${this.shortId}, path: ${sessionPath}`);
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
    const cmd = command.startsWith("!") || command.startsWith("/") 
      ? command.slice(1).trim() 
      : command.trim();
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
  getCurrentModel() {
    if (!this.session) return null;
    return this.session.model;
  }

  /**
   * Get messages
   * @returns Message array
   */
  getMessages(): AgentMessage[] {
    if (!this.session) return [];
    return this.session.messages;
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

  /** Track if we're currently inside a message (between message_start and message_end) */
  private insideMessage: boolean = false;

  /** 
   * Session verification callback
   * Called before sending each message to verify the client has selected this session
   * If returns false, message is buffered instead of sent
   */
  private sessionVerificationCallback: ((ws: WebSocket, shortId: string) => boolean) | null = null;
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

    if (!this.isClientSelected()) {
      this.bufferMessage(message, `Client not selected session ${this.shortId}`);
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

  private isClientSelected(): boolean {
    if (!this.sessionVerificationCallback || !this.shortId) return true;
    return this.sessionVerificationCallback(this.ws!, this.shortId);
  }

  private bufferMessage(message: ServerMessage, reason: string): void {
    console.log(`[PiAgentSession] Buffering ${message.type}: ${reason}`);
    this.messageEventBuffer.push(message);
    this.isBuffering = true;
  }

  private doSend(message: ServerMessage): void {
    try {
      this.ws!.send(JSON.stringify(message));
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
      console.log(`[PiAgentSession.flushMessageBuffer] WebSocket not connected, keeping ${bufferSize} messages in buffer`);
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
   * Read file content and send with tool result (reuse tool_end message)
   * @param toolCallId Tool call ID
   * @param toolResult Tool execution result
   * @param isError Whether error
   * @param filePath File path
   */
  async sendToolEndWithFileContent(
    toolCallId: string,
    toolResult: string,
    isError: boolean,
    filePath: string
  ) {
    try {
      // Resolve file path (support relative and absolute paths)
      const fullPath = filePath.startsWith("/") ? filePath : join(this.workingDir, filePath);

      // Check if file exists
      const { existsSync } = await import("node:fs");
      if (!existsSync(fullPath)) {
        this.send({
          type: "tool_end",
          toolCallId,
          result: toolResult,
          isError,
        });
        return;
      }

      // Read file content
      const content = await readFile(fullPath, "utf-8");

      // Send tool end message with file content
      this.send({
        type: "tool_end",
        toolCallId,
        result: toolResult,
        isError,
        fileContent: content,
        filePath,
      });
    } catch (error) {
      // If read fails, only send tool result
      console.error(`[Gateway] Failed to read file content: ${filePath}`, error);
      this.send({
        type: "tool_end",
        toolCallId,
        result: toolResult,
        isError,
      });
    }
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
