/**
 * PiAgentSession Class
 * Manages WebSocket connections, pi-coding-agent sessions, and message delivery
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

  /**
   * Create new PiAgentSession
   * @param ws WebSocket connection
   * @param llmLogManager LLM log manager
   */
  constructor(ws: WebSocket, llmLogManager: LlmLogManager) {
    this.ws = ws;
    this.llmLogManager = llmLogManager;
    this.authStorage = AuthStorage.create();
    this.modelRegistry = new ModelRegistry(this.authStorage);
    this.settingsManager = SettingsManager.create();
  }

  /**
   * Initialize session
   * @param workingDir Working directory
   * @param sessionId Optional session ID (partial UUID)
   * @returns Session information
   */
  async initialize(workingDir: string, sessionId?: string) {
    console.log(`[PiAgentSession.initialize] ========== START ==========`);
    console.log(
      `[PiAgentSession.initialize] Input: workingDir="${workingDir}", sessionId="${sessionId || "not provided"}"`
    );
    console.log(
      `[PiAgentSession.initialize] Current state: this.workingDir="${this.workingDir}", this.session exists: ${!!this.session}`
    );

    // Check if we have an existing session with the same working directory
    if (this.session && this.workingDir === workingDir) {
      console.log(`[PiAgentSession.initialize] SAME DIRECTORY - Reconnecting to existing session`);

      // Unsubscribe from old event handlers
      if (this.unsubscribeFn) {
        this.unsubscribeFn();
        this.unsubscribeFn = null;
      }

      // Re-setup event handlers (re-subscribe)
      this.setupEventHandlers();

      // Return current session info
      const loader = new DefaultResourceLoader({
        cwd: workingDir,
        agentDir: AGENT_DIR,
        settingsManager: this.settingsManager,
      });
      await loader.reload();

      const result = {
        sessionId: this.session.sessionId,
        sessionFile: this.session.sessionFile,
        workingDir: this.workingDir,
        model: this.session.model?.id || null,
        modelProvider: this.session.model?.provider || null,
        thinkingLevel: this.session.thinkingLevel,
        systemPrompt: loader.getSystemPrompt() || "",
        agentsFiles: loader.getAgentsFiles().agentsFiles.map((f: any) => ({
          path: f.path,
          content: f.content,
        })),
        skills: loader.getSkills().skills.map((s: any) => ({
          name: s.name,
          description: s.description,
        })),
      };
      console.log(`[PiAgentSession.initialize] ========== END (same dir reconnect) ==========`);
      return result;
    }

    // Different working directory or no existing session - use original logic
    console.log(`[PiAgentSession.initialize] NEW DIRECTORY - Creating new session`);

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
    console.log(
      `[PiAgentSession.initialize] Looking for sessionId: "${sessionId || "not provided"}"`
    );

    if (sessionId) {
      // Try to find session by partial UUID in local sessions directory
      console.log(
        `[PiAgentSession.initialize] Calling SessionManager.list("${workingDir}", "${localSessionsDir}")`
      );
      const sessions = await SessionManager.list(workingDir, localSessionsDir);
      console.log(`[PiAgentSession.initialize] Found ${sessions.length} sessions in directory`);
      sessions.forEach((s, i) =>
        console.log(`[PiAgentSession.initialize]   [${i}] id=${s.id}, path=${s.path}`)
      );

      const matching = sessions.find(
        (s) => s.id.startsWith(sessionId) || s.path.includes(sessionId)
      );
      console.log(
        `[PiAgentSession.initialize] Matching result for sessionId "${sessionId}":`,
        matching ? `FOUND id=${matching.id}, path=${matching.path}` : "NOT FOUND"
      );

      if (matching) {
        console.log(`[PiAgentSession.initialize] Opening existing session: ${matching.path}`);
        sessionManager = SessionManager.open(matching.path, localSessionsDir);
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

    console.log(
      `[Gateway] Session created: sessionId=${session.sessionId}, sessionFile=${session.sessionFile}`
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
   * Setup event handlers - 简化版本
   *
   * 核心事件流:
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
        // Message 边界 - 只处理 assistant 消息
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
            this.messageStarted = false;
          }
          break;
        }

        // Content blocks - 实际的消息内容
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

        // Tool 实际执行事件
        case "tool_execution_start": {
          this.send({
            type: "tool_execution_start",
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
          });
          break;
        }

        case "tool_execution_end": {
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
        model: model.id,
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
      const available = await this.modelRegistry.getAvailable();
      // Handle case where m.id might be an object
      const models = available.map((m) => ({
        id: typeof m.id === "object" ? (m as any).id?.id || String(m.id) : m.id,
        provider: m.provider,
        name: m.name ?? (typeof m.id === "object" ? String(m.id) : m.id),
        description: "",
      }));
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
   */
  async loadSession(sessionPath: string) {
    if (!this.session) return;
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
        const info = await this.initialize(targetCwd, targetSessionManager.getSessionId());
        this.send({
          type: "session_loaded",
          success: true,
          sessionId: info.sessionId,
          sessionFile: info.sessionFile,
          cwdChanged: true,
          newCwd: targetCwd,
          pid: process.pid,
        });
      } else {
        // Same cwd, use switchSession
        const result = await this.session.switchSession(sessionPath);
        this.send({
          type: "session_loaded",
          success: result,
          sessionId: this.session.sessionId,
          sessionFile: this.session.sessionFile,
          cwdChanged: false,
          pid: process.pid,
        });
      }
    } catch (error) {
      this.send({
        type: "session_loaded",
        success: false,
        error: error instanceof Error ? error.message : "Failed to load session",
      });
    }
  }

  /**
   * Execute command
   * @param command Command string
   */
  async executeCommand(command: string) {
    // Remove leading /
    const cmd = command.slice(1).trim();
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
      const { spawn } = await import("node:child_process");
      const [executable, ...args] = cmd.split(/\s+/);

      const child = spawn(executable, args, {
        cwd: this.workingDir,
        env: process.env,
        shell: false,
      });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data: Buffer) => {
        output += data.toString();
      });

      child.stderr.on("data", (data: Buffer) => {
        errorOutput += data.toString();
      });

      child.on("close", (code: number | null) => {
        const isError = code !== 0;
        const result = errorOutput ? `${output}\n${errorOutput}`.trim() : output.trim();
        this.send({
          type: "command_result",
          command,
          output: result || "(no output)",
          isError,
        });
      });

      child.on("error", (error: Error) => {
        this.send({
          type: "command_result",
          command,
          output: error.message,
          isError: true,
        });
      });
    } catch (error) {
      this.send({
        type: "command_result",
        command,
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

  /**
   * Send message to WebSocket client
   * @param message Message object
   */
  send(message: ServerMessage) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
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
