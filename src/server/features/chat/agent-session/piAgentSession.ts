/**
 * PiAgentSession Class
 * Manages WebSocket connections, pi-coding-agent sessions, and message delivery
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
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
		// Unsubscribe from old session events
		if (this.unsubscribeFn) {
			this.unsubscribeFn();
			this.unsubscribeFn = null;
		}

		// Cleanup old session
		if (this.session) {
			this.session.dispose();
			this.session = null;
		}

		this.workingDir = workingDir;
		const localSessionsDir = getLocalSessionsDir(workingDir);
		console.log(
			`[Gateway] Initializing with workingDir: ${workingDir}, localSessionsDir: ${localSessionsDir}`,
		);

		let sessionManager: ReturnType<typeof SessionManager.create> | undefined;
		console.log(`[Gateway] Looking for sessionId: ${sessionId}`);

		if (sessionId) {
			// Try to find session by partial UUID in local sessions directory
			const sessions = await SessionManager.list(workingDir, localSessionsDir);
			console.log(`[Gateway] Found ${sessions.length} sessions`);
			sessions.forEach((s, i) =>
				console.log(`[Gateway]   [${i}] id=${s.id}, path=${s.path}`),
			);

			const matching = sessions.find(
				(s) => s.id.startsWith(sessionId) || s.path.includes(sessionId),
			);
			console.log(
				`[Gateway] Matching result:`,
				matching ? `id=${matching.id}, path=${matching.path}` : "null",
			);

			if (matching) {
				sessionManager = SessionManager.open(matching.path, localSessionsDir);
			}
		}

		if (!sessionManager) {
			console.log(`[Gateway] No match found, creating new session`);
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
			console.log(
				`[Gateway] Append system prompt: ${appendSystemPrompt.length} files`,
			);
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
			`[Gateway] Session created: sessionId=${session.sessionId}, sessionFile=${session.sessionFile}`,
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
			`[Gateway] Calling setLogFile with sessionFile=${session.sessionFile}, sessionId=${session.sessionId}`,
		);
		this.llmLogManager.setLogFile(session.sessionFile, session.sessionId);
		console.log(
			`[Gateway] LLM log: ${this.llmLogManager.getLogFilePath() || "disabled (memory session)"}`,
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

		console.log(
			"[Gateway] Resource file paths:",
			JSON.stringify(resourceFiles, null, 2),
		);

		// Debug: check if paths are consistent
		const expectedDir = getLocalSessionsDir(workingDir);
		console.log(`[Gateway] Expected sessions directory: ${expectedDir}`);
		console.log(`[Gateway] Actual sessionFile: ${session.sessionFile}`);
		if (session.sessionFile && !session.sessionFile.startsWith(expectedDir)) {
			console.warn(`[Gateway] Path mismatch! Expected prefix: ${expectedDir}, actual: ${session.sessionFile}`);
		}
		console.log(
			`[Gateway] sessionFile exists:`,
			session.sessionFile ? existsSync(session.sessionFile) : false,
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
	 * Setup event handlers
	 */
	setupEventHandlers() {
		if (!this.session) return;

		this.unsubscribeFn = this.session.subscribe((event: AgentSessionEvent) => {
			const timestamp = new Date().toISOString().split("T")[1].split(".")[0];
			switch (event.type) {
				case "message_update": {
					const msgEvent = event.assistantMessageEvent;
					if (msgEvent.type === "text_delta") {
						console.log(`[${timestamp}] [SEND] content_delta`);
						this.send({
							type: "content_delta",
							text: msgEvent.delta,
						});
					} else if (msgEvent.type === "thinking_delta") {
						console.log(`[${timestamp}] [SEND] thinking_delta`);
						this.send({
							type: "thinking_delta",
							thinking: msgEvent.delta,
						});
					} else if (msgEvent.type === "toolcall_delta") {
						const toolCall = msgEvent.partial.content?.[msgEvent.contentIndex];
						if (toolCall?.type === "toolCall") {
							console.log(
								`[${timestamp}] [SEND] toolcall_delta: ${toolCall.name}`,
							);
							this.send({
								type: "toolcall_delta",
								toolCallId: toolCall.id,
								toolName: toolCall.name,
								delta: msgEvent.delta,
								args: toolCall.arguments,
							});
						}
					}
					break;
				}
				case "tool_execution_start": {
					console.log(`[${timestamp}] [SEND] tool_start: ${event.toolName}`);
					this.send({
						type: "tool_start",
						toolName: event.toolName,
						toolCallId: event.toolCallId,
						args: event.args,
					});
					break;
				}
				case "tool_execution_update": {
					console.log(`[${timestamp}] [SEND] tool_update: ${event.toolCallId}`);
					this.send({
						type: "tool_update",
						toolCallId: event.toolCallId,
						chunk:
							(event as unknown as { partialResult?: string }).partialResult ??
							"",
					});
					break;
				}
				case "tool_execution_end": {
					console.log(`[${timestamp}] [SEND] tool_end: ${event.toolCallId}`);
					const toolResult = event.result;
					const toolName = event.toolName;
					const isWriteOperation =
						toolName &&
						(writeFileTools.includes(toolName) ||
							toolName.toLowerCase().includes("write") ||
							toolName.toLowerCase().includes("create"));
					if (isWriteOperation && !event.isError) {
						const args = (
							event as unknown as { args?: Record<string, unknown> }
						).args;
						const filePath =
							args?.path || args?.file_path || args?.filepath || args?.filePath;
						if (typeof filePath === "string") {
							this.sendToolEndWithFileContent(
								event.toolCallId,
								toolResult,
								event.isError,
								filePath,
							);
						} else {
							this.send({
								type: "tool_end",
								toolCallId: event.toolCallId,
								result: toolResult,
								isError: event.isError,
							});
						}
					} else {
						this.send({
							type: "tool_end",
							toolCallId: event.toolCallId,
							result: toolResult,
							isError: event.isError,
						});
					}
					break;
				}
				case "message_start": {
					console.log(`[${timestamp}] [SEND] message_start`);
					this.send({ type: "message_start" });
					break;
				}
				case "message_end": {
					console.log(`[${timestamp}] [SEND] message_end`);
					this.send({ type: "message_end" });
					break;
				}
				case "agent_start": {
					console.log(`[${timestamp}] [SEND] agent_start`);
					this.isStreaming = true;
					this.send({ type: "agent_start" });
					break;
				}
				case "agent_end": {
					console.log(`[${timestamp}] [SEND] agent_end`);
					this.isStreaming = false;
					this.send({ type: "agent_end" });
					break;
				}
				case "turn_start": {
					console.log(`[${timestamp}] [SEND] turn_start`);
					this.send({ type: "turn_start" });
					break;
				}
				case "turn_end": {
					console.log(`[${timestamp}] [SEND] turn_end`);
					this.send({
						type: "turn_end",
						message: event.message,
						toolResults: event.toolResults,
					});
					break;
				}
				case "auto_compaction_start": {
					console.log(`[${timestamp}] [SEND] compaction_start`);
					this.send({ type: "compaction_start" });
					break;
				}
				case "auto_compaction_end": {
					console.log(`[${timestamp}] [SEND] compaction_end`);
					this.isStreaming = false;
					this.send({ type: "compaction_end" });
					break;
				}
				case "auto_retry_start": {
					console.log(`[${timestamp}] [SEND] retry_start`);
					this.send({ type: "retry_start" });
					break;
				}
				case "auto_retry_end": {
					console.log(`[${timestamp}] [SEND] retry_end`);
					this.send({ type: "retry_end" });
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
		}>,
	) {
		console.log(
			`[PiAgentSession.prompt] Starting processing, session exists: ${!!this.session}, isStreaming: ${this.isStreaming}`,
		);
		if (!this.session) {
			this.send({ type: "error", error: "Session not initialized" });
			return;
		}

		try {
			// Convert images to correct format
			const convertedImages: ImageContent[] | undefined = images?.map(
				(img) => ({
					type: "image" as const,
					data: img.source.data,
					mimeType: img.source.mediaType,
				}),
			);

			console.log(
				`[PiAgentSession.prompt] Calling session.prompt, text length: ${text.length}`,
			);
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
	 * Create new session
	 */
	async newSession() {
		if (!this.session) return;
		try {
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
		thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
	) {
		console.log(
			`[Gateway] setModel called: provider=${provider}, modelId=${modelId}`,
		);

		if (!this.session) {
			console.error("[Gateway] setModel failed: session is null");
			this.send({ type: "error", error: "Session not initialized" });
			return;
		}

		const model = this.modelRegistry.find(provider, modelId);
		console.log(`[Gateway] modelRegistry.find result:`, model);

		if (!model) {
			console.error(`[Gateway] Model not found: ${provider}/${modelId}`);
			this.send({ type: "error", error: `Model ${provider}/${modelId} not found` });
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
	async setThinkingLevel(
		thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
	) {
		console.log(`[Gateway] setThinkingLevel called: ${thinkingLevel}`);
		if (!this.session) {
			console.error("[Gateway] setThinkingLevel failed: session is null");
			this.send({ type: "error", error: "Session not initialized" });
			return;
		}
		try {
			console.log(
				`[Gateway] Calling session.setThinkingLevel with: ${thinkingLevel}`,
			);
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
	async executeTool(
		toolName: string,
		args: Record<string, unknown>,
		toolCallId: string,
	) {
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
			const result = await tool.execute(
				toolCallId,
				args as Record<string, string>,
			);

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
				getLocalSessionsDir(this.workingDir),
			);
			const targetCwd = targetSessionManager.getCwd();

			// If cwd is different, need to reinitialize to load correct AGENTS.md/SYSTEM.md
			if (targetCwd !== this.workingDir) {
				console.log(
					`[Gateway] Session cwd mismatch: ${this.workingDir} -> ${targetCwd}, reinitializing...`,
				);
				const info = await this.initialize(
					targetCwd,
					targetSessionManager.getSessionId(),
				);
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
				const result = errorOutput
					? `${output}\n${errorOutput}`.trim()
					: output.trim();
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
		filePath: string,
	) {
		try {
			// Resolve file path (support relative and absolute paths)
			const fullPath = filePath.startsWith("/")
				? filePath
				: join(this.workingDir, filePath);

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
