/**
 * Gateway会话类
 * 管理WebSocket连接、pi-coding-agent会话和消息传递
 */

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
import type { LlmLogManager } from "@server/llm/log-manager";
import { WebSocket } from "ws";
import { AGENT_DIR, getLocalSessionsDir } from "./utils";

/**
 * 服务器消息接口
 */
export interface ServerMessage extends Record<string, unknown> {
	type: string;
}

/**
 * Gateway会话类
 * 封装了pi-coding-agent会话的完整生命周期管理
 */
export class GatewaySession {
	/** 代理会话 */
	session: AgentSession | null = null;

	/** WebSocket连接 */
	ws: WebSocket;

	/** 当前工作目录 */
	workingDir: string = process.cwd();

	/** 认证存储 */
	authStorage: ReturnType<typeof AuthStorage.create>;

	/** 模型注册表 */
	modelRegistry: ModelRegistry;

	/** 设置管理器 */
	settingsManager: ReturnType<typeof SettingsManager.create>;

	/** 是否正在流式传输 */
	isStreaming: boolean = false;

	/** 消息缓冲区 */
	messageBuffer: string = "";

	/** 事件取消订阅函数 */
	unsubscribeFn: (() => void) | null = null;

	/** LLM日志管理器引用 */
	private llmLogManager: LlmLogManager;

	/**
	 * 创建新的Gateway会话
	 * @param ws WebSocket连接
	 * @param llmLogManager LLM日志管理器
	 */
	constructor(ws: WebSocket, llmLogManager: LlmLogManager) {
		this.ws = ws;
		this.llmLogManager = llmLogManager;
		this.authStorage = AuthStorage.create();
		this.modelRegistry = new ModelRegistry(this.authStorage);
		this.settingsManager = SettingsManager.create();
	}

	/**
	 * 初始化会话
	 * @param workingDir 工作目录
	 * @param sessionId 可选会话ID（部分UUID）
	 * @returns 会话信息
	 */
	async initialize(workingDir: string, sessionId?: string) {
		// 取消订阅旧会话事件
		if (this.unsubscribeFn) {
			this.unsubscribeFn();
			this.unsubscribeFn = null;
		}

		// 清理旧会话
		if (this.session) {
			this.session.dispose();
			this.session = null;
		}

		this.workingDir = workingDir;
		const localSessionsDir = getLocalSessionsDir(workingDir);
		console.log(
			`[Gateway] 使用workingDir初始化: ${workingDir}, localSessionsDir: ${localSessionsDir}`,
		);

		let sessionManager: ReturnType<typeof SessionManager.create> | undefined;
		if (sessionId) {
			// 尝试在本地会话目录中按部分UUID查找会话
			const sessions = await SessionManager.list(workingDir, localSessionsDir);
			const matching = sessions.find(
				(s) => s.id.startsWith(sessionId) || s.path.includes(sessionId),
			);
			if (matching) {
				sessionManager = SessionManager.open(matching.path, localSessionsDir);
			}
		}

		if (!sessionManager) {
			sessionManager = SessionManager.create(workingDir, localSessionsDir);
		}

		const loader = new DefaultResourceLoader({
			cwd: workingDir,
			agentDir: AGENT_DIR,
			settingsManager: this.settingsManager,
		});
		await loader.reload();

		// 记录加载的资源用于调试
		const agentsFiles = loader.getAgentsFiles().agentsFiles;
		console.log(`[Gateway] 加载了 ${agentsFiles.length} 个AGENTS.md文件:`);
		for (const file of agentsFiles) {
			console.log(`  - ${file.path}`);
		}
		const systemPrompt = loader.getSystemPrompt();
		console.log(`[Gateway] 系统提示: ${systemPrompt ? "自定义" : "默认"}`);
		const appendSystemPrompt = loader.getAppendSystemPrompt();
		if (appendSystemPrompt.length > 0) {
			console.log(
				`[Gateway] 附加系统提示: ${appendSystemPrompt.length} 个文件`,
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
			`[Gateway] 会话已创建: sessionId=${session.sessionId}, sessionFile=${session.sessionFile}`,
		);

		// 如果可用，设置默认模型为kimi-k2.5
		const defaultModel = this.modelRegistry.find("deepseek", "deepseek-chat");
		if (defaultModel) {
			await session.setModel(defaultModel);
			console.log(`[Gateway] 默认模型设置为: ${defaultModel.id}`);
		}

		// 为此会话设置LLM日志文件
		console.log(
			`[Gateway] 使用sessionFile=${session.sessionFile}, sessionId=${session.sessionId}调用setLogFile`,
		);
		this.llmLogManager.setLogFile(session.sessionFile, session.sessionId);
		console.log(
			`[Gateway] LLM日志: ${this.llmLogManager.getLogFilePath() || "禁用（内存会话）"}`,
		);

		// 获取技能列表
		const skills = loader.getSkills().skills;

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
		};
	}

	/**
	 * 设置事件处理器
	 */
	setupEventHandlers() {
		if (!this.session) return;

		this.unsubscribeFn = this.session.subscribe((event: AgentSessionEvent) => {
			switch (event.type) {
				case "message_update": {
					const msgEvent = event.assistantMessageEvent;
					if (msgEvent.type === "text_delta") {
						this.send({
							type: "text_delta",
							delta: msgEvent.delta,
						});
					} else if (msgEvent.type === "thinking_delta") {
						this.send({
							type: "thinking_delta",
							delta: msgEvent.delta,
						});
					} else if (msgEvent.type === "toolcall_delta") {
						// 转发工具调用增量以逐步构建工具参数
						const toolCall = msgEvent.partial.content?.[msgEvent.contentIndex];
						if (toolCall?.type === "toolCall") {
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
					this.send({
						type: "tool_start",
						toolName: event.toolName,
						toolCallId: event.toolCallId,
						args: event.args,
					});
					break;
				}
				case "tool_execution_update": {
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
					this.send({
						type: "tool_end",
						toolCallId: event.toolCallId,
						result: event.result,
						isError: event.isError,
					});
					break;
				}
				case "message_start": {
					this.send({ type: "message_start" });
					break;
				}
				case "message_end": {
					this.send({ type: "message_end" });
					break;
				}
				case "agent_start": {
					this.isStreaming = true;
					this.send({ type: "agent_start" });
					break;
				}
				case "agent_end": {
					this.isStreaming = false;
					this.send({ type: "agent_end" });
					break;
				}
				case "turn_start": {
					this.send({ type: "turn_start" });
					break;
				}
				case "turn_end": {
					this.send({
						type: "turn_end",
						message: event.message,
						toolResults: event.toolResults,
					});
					break;
				}
				case "auto_compaction_start": {
					this.send({ type: "compaction_start" });
					break;
				}
				case "auto_compaction_end": {
					this.isStreaming = false;
					this.send({ type: "compaction_end" });
					break;
				}
				case "auto_retry_start": {
					this.send({ type: "retry_start" });
					break;
				}
				case "auto_retry_end": {
					this.send({ type: "retry_end" });
					break;
				}
			}
		});
	}

	/**
	 * 发送提示
	 * @param text 提示文本
	 * @param images 可选图像数组
	 */
	async prompt(
		text: string,
		images?: Array<{
			type: "image";
			source: { type: "base64"; mediaType: string; data: string };
		}>,
	) {
		if (!this.session) {
			this.send({ type: "error", error: "会话未初始化" });
			return;
		}

		try {
			// 转换图像为正确格式
			const convertedImages: ImageContent[] | undefined = images?.map(
				(img) => ({
					type: "image" as const,
					data: img.source.data,
					mimeType: img.source.mediaType,
				}),
			);

			if (this.isStreaming) {
				await this.session.prompt(text, {
					images: convertedImages,
					streamingBehavior: "steer",
				});
			} else {
				await this.session.prompt(text, { images: convertedImages });
			}
		} catch (error) {
			this.send({
				type: "error",
				error: error instanceof Error ? error.message : "未知错误",
			});
		}
	}

	/**
	 * 引导（流式传输时）
	 * @param text 引导文本
	 */
	async steer(text: string) {
		if (!this.session) {
			this.send({ type: "error", error: "会话未初始化" });
			return;
		}

		try {
			await this.session.steer(text);
		} catch (error) {
			this.send({
				type: "error",
				error: error instanceof Error ? error.message : "未知错误",
			});
		}
	}

	/**
	 * 中止当前操作
	 */
	async abort() {
		if (!this.session) return;
		try {
			await this.session.abort();
		} catch (error) {
			console.error("[Gateway] 中止错误:", error);
		}
	}

	/**
	 * 创建新会话
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
				error: error instanceof Error ? error.message : "创建新会话失败",
			});
		}
	}

	/**
	 * 设置模型
	 * @param provider 提供商
	 * @param modelId 模型ID
	 * @param thinkingLevel 思考级别（可选）
	 */
	async setModel(
		provider: string,
		modelId: string,
		thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
	) {
		if (!this.session) return;

		const model = this.modelRegistry.find(provider, modelId);
		if (!model) {
			this.send({ type: "error", error: `模型 ${provider}/${modelId} 未找到` });
			return;
		}

		try {
			await this.session.setModel(model);
			if (thinkingLevel) {
				this.session.setThinkingLevel(thinkingLevel);
			}

			this.send({
				type: "model_set",
				model: model.id,
				provider: model.provider,
				thinkingLevel: this.session.thinkingLevel,
			});
		} catch (error) {
			this.send({
				type: "error",
				error: error instanceof Error ? error.message : "设置模型失败",
			});
		}
	}

	/**
	 * 设置思考级别
	 * @param thinkingLevel 思考级别
	 */
	async setThinkingLevel(
		thinkingLevel: "off" | "minimal" | "low" | "medium" | "high" | "xhigh",
	) {
		if (!this.session) return;
		try {
			this.session.setThinkingLevel(thinkingLevel);
			this.send({
				type: "thinking_set",
				thinkingLevel,
			});
		} catch (error) {
			this.send({
				type: "error",
				error: error instanceof Error ? error.message : "设置思考级别失败",
			});
		}
	}

	/**
	 * 执行工具
	 * @param toolName 工具名称
	 * @param args 参数
	 * @param toolCallId 工具调用ID
	 */
	async executeTool(
		toolName: string,
		args: Record<string, unknown>,
		toolCallId: string,
	) {
		if (!this.session) {
			this.send({ type: "error", error: "会话未初始化" });
			return;
		}

		try {
			const tools = createCodingTools(this.workingDir);
			const tool = tools.find((t) => t.name === toolName);

			if (!tool) {
				this.send({
					type: "tool_end",
					toolCallId,
					result: `工具 "${toolName}" 未找到`,
					isError: true,
				});
				return;
			}

			// 发送开始事件
			this.send({
				type: "tool_start",
				toolName,
				toolCallId,
				args,
			});

			// 执行工具（toolCallId, args, signal）
			const result = await tool.execute(
				toolCallId,
				args as Record<string, string>,
			);

			// 发送结束事件
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
				result: error instanceof Error ? error.message : "未知错误",
				isError: true,
			});
		}
	}

	/**
	 * 列出可用模型
	 */
	async listModels() {
		try {
			const available = await this.modelRegistry.getAvailable();
			this.send({
				type: "models_list",
				models: available.map((m) => ({
					id: m.id,
					provider: m.provider,
					name: m.name ?? m.id,
					description: "", // 模型类型没有描述
				})),
			});
		} catch (error) {
			this.send({
				type: "error",
				error: error instanceof Error ? error.message : "列出模型失败",
			});
		}
	}

	/**
	 * 列出会话
	 * @param cwd 工作目录
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
				error: error instanceof Error ? error.message : "列出会话失败",
			});
		}
	}

	/**
	 * 加载会话
	 * @param sessionPath 会话文件路径
	 */
	async loadSession(sessionPath: string) {
		if (!this.session) return;
		try {
			// 从会话文件获取目标会话的cwd
			const targetSessionManager = SessionManager.open(
				sessionPath,
				getLocalSessionsDir(this.workingDir),
			);
			const targetCwd = targetSessionManager.getCwd();

			// 如果cwd不同，需要重新初始化以加载正确的AGENTS.md/SYSTEM.md
			if (targetCwd !== this.workingDir) {
				console.log(
					`[Gateway] 会话cwd不匹配: ${this.workingDir} -> ${targetCwd}, 重新初始化...`,
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
				// 相同的cwd，使用switchSession
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
				error: error instanceof Error ? error.message : "加载会话失败",
			});
		}
	}

	/**
	 * 执行命令
	 * @param command 命令字符串
	 */
	async executeCommand(command: string) {
		// 移除前导/
		const cmd = command.slice(1).trim();
		if (!cmd) {
			this.send({
				type: "command_result",
				command,
				output: "空命令",
				isError: true,
			});
			return;
		}

		try {
			const { spawn } = await import("child_process");
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
					output: result || "(无输出)",
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
				output: error instanceof Error ? error.message : "未知错误",
				isError: true,
			});
		}
	}

	/**
	 * 获取当前模型
	 * @returns 当前模型或null
	 */
	getCurrentModel() {
		if (!this.session) return null;
		return this.session.model;
	}

	/**
	 * 获取消息
	 * @returns 消息数组
	 */
	getMessages(): AgentMessage[] {
		if (!this.session) return [];
		return this.session.messages;
	}

	/**
	 * 发送消息到WebSocket客户端
	 * @param message 消息对象
	 */
	send(message: ServerMessage) {
		if (this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(JSON.stringify(message));
		}
	}

	/**
	 * 清理资源
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
