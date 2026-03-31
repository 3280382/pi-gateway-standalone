/**
 * App - Gateway Main Application
 *
 * 使用统一的 AppLayout 布局系统：
 * - 布局行为全部由 AppLayout 控制
 * - 子组件只负责内容渲染
 * - Chat 视图和 Files 视图共享相同的布局框架
 */

import { useCallback, useEffect, useState } from "react";
import { websocketService } from "@/services/websocket.service";
import { useChatStore } from "@/stores/chatStore";
import { useNewChatStore } from "@/stores/new-chat.store";
import { useSessionStore } from "@/stores/sessionStore";
import { MessageList } from "./components/chat/MessageList/MessageList";
import { FileBrowser } from "./components/files/FileBrowser";
import {
	AppLayout,
	LayoutProvider,
	useLayout,
} from "./components/layout/AppLayout";
import { LlmLogPanel } from "./components/llm-log";
import { XTermPanel } from "./components/terminal";
import { fileController, sessionController } from "./controllers";
import "./styles/global.css";

function AppContent() {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const {
		currentView,
		isBottomPanelOpen,
		bottomPanelHeight,
		setBottomPanelHeight,
		closeBottomPanel,
	} = useLayout();

	const messages = useChatStore((s) => s.messages);
	const currentStreamingMessage = useChatStore(
		(s) => s.currentStreamingMessage,
	);
	const showThinking = useChatStore((s) => s.showThinking);
	const toggleMessageCollapse = useChatStore((s) => s.toggleMessageCollapse);
	const toggleThinkingCollapse = useChatStore((s) => s.toggleThinkingCollapse);

	// 终端输出状态（用于文件浏览器）
	const [terminalOutput, setTerminalOutput] = useState<string>("");
	const [terminalCommand, setTerminalCommand] = useState<string>("");

	// 初始化应用
	useEffect(() => {
		async function initApp() {
			try {
				// 从持久化存储获取之前的状态
				const persistedDir = useSessionStore.getState().currentDir;
				const persistedSessionId = useSessionStore.getState().currentSessionId;

				// 快速初始化显示（使用持久化的目录）
				if (persistedDir && persistedDir !== "/root") {
					useSessionStore.getState().setCurrentDir(persistedDir);
					fileController.setCurrentPath(persistedDir);
				}
				setIsLoading(false);

				// 后台完整初始化
				try {
					await sessionController.getUserSettings();
					const workspace = await sessionController.getCurrentWorkspace();

					// 只有在没有持久化目录时才使用服务器返回的目录
					if (!persistedDir || persistedDir === "/root") {
						useSessionStore.getState().setCurrentDir(workspace.path);
						fileController.setCurrentPath(workspace.path);
					}

					// WebSocket 连接
					let wsConnected = false;
					try {
						await websocketService.connect();
						wsConnected = websocketService.isConnected;
						console.log("[App] WebSocket connection status:", wsConnected);
					} catch (wsErr) {
						console.warn("[App] WebSocket connection failed:", wsErr);
						wsConnected = false;
					}

					if (wsConnected) {
						// 优先使用持久化的 sessionId，如果没有则从服务器获取
						let sessionId = persistedSessionId;

						if (!sessionId) {
							try {
								const sessionsRes = await fetch(
									`/api/sessions?cwd=${encodeURIComponent(workspace.path)}`,
								);
								if (sessionsRes.ok) {
									const sessionsData = await sessionsRes.json();
									if (sessionsData.sessions?.length > 0) {
										sessionId = sessionsData.sessions[0].id;
									}
								}
							} catch (e) {
								console.warn("[App] Failed to get sessions:", e);
							}
						}

						const currentDir = useSessionStore.getState().currentDir;
						const initData = await websocketService.initWorkingDirectory(
							currentDir,
							sessionId || undefined,
						);

						if (initData) {
							// 保存到 new-chat store
							useNewChatStore.getState().setSessionId(initData.sessionId);
							useNewChatStore.getState().setCurrentModel(initData.model);

							// 保存到 session store（会被持久化到 localStorage）
							useSessionStore.getState().setCurrentSession(initData.sessionId);
							useSessionStore.getState().setServerPid(initData.pid);
							useSessionStore.getState().setIsConnected(true);

							if (initData.model) {
								useNewChatStore.getState().setCurrentModel(initData.model);
								useSessionStore.getState().setCurrentModel(initData.model);
							}
							if (initData.thinkingLevel) {
								useSessionStore
									.getState()
									.setThinkingLevel(initData.thinkingLevel);
							}

							// 加载历史消息
							if (initData.sessionFile) {
								await loadSessionMessages(initData.sessionFile);
							}
						}
					}
				} catch (bgErr) {
					console.error("[App] Background init error:", bgErr);
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				setError(errorMsg);
				setIsLoading(false);
			}
		}

		initApp();
	}, []);

	// 加载会话消息
	async function loadSessionMessages(sessionFile: string) {
		try {
			const response = await fetch("/api/session/load", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ sessionPath: sessionFile }),
			});

			if (response.ok) {
				const data = await response.json();
				if (data.entries?.length > 0) {
					const loadedMessages = data.entries
						.filter((entry: any) => entry.type === "message" && entry.message)
						.map((entry: any) => ({
							id: entry.id || `msg-${Date.now()}-${Math.random()}`,
							role: entry.message.role || "assistant",
							content: Array.isArray(entry.message.content)
								? entry.message.content
								: [{ type: "text", text: String(entry.message.content) }],
							timestamp: new Date(
								entry.message.timestamp || entry.timestamp || Date.now(),
							),
							isStreaming: false,
							isThinkingCollapsed: true,
							isMessageCollapsed: false,
						}));
					useChatStore.getState().setMessages(loadedMessages);
				}
			}
		} catch (err) {
			console.error("[App] Failed to load messages:", err);
		}
	}

	// 处理文件执行输出
	const handleExecuteOutput = useCallback((output: string) => {
		setTerminalOutput(output);
	}, []);

	// 处理在底部面板打开
	const handleOpenBottomPanel = useCallback((command: string) => {
		setTerminalCommand(command);
	}, []);

	// 渲染聊天视图的底部面板内容
	const renderChatBottomPanel = () => {
		if (!isBottomPanelOpen) return null;
		return (
			<LlmLogPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
			/>
		);
	};

	// 渲染文件视图的底部面板内容
	const renderFilesBottomPanel = () => {
		if (!isBottomPanelOpen) return null;
		return (
			<XTermPanel
				height={bottomPanelHeight}
				onClose={closeBottomPanel}
				onHeightChange={setBottomPanelHeight}
				output={terminalOutput}
				initialCommand={terminalCommand}
				onExecuteCommand={(cmd) => {
					console.log("[Terminal] Executing:", cmd);
					// 这里可以添加实际的命令执行逻辑
					setTerminalOutput(`Executing: ${cmd}\n`);
				}}
			/>
		);
	};

	// 错误状态
	if (error) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					padding: 20,
					background: "#0f0f1a",
					color: "#ff6b6b",
				}}
			>
				<h2>❌ Error</h2>
				<pre style={{ maxWidth: "80%", overflow: "auto" }}>{error}</pre>
				<button
					onClick={() => window.location.reload()}
					style={{
						marginTop: 20,
						padding: "10px 20px",
						background: "#1f6feb",
						color: "white",
						border: "none",
						borderRadius: 6,
						cursor: "pointer",
					}}
				>
					Retry
				</button>
			</div>
		);
	}

	// 加载状态
	if (isLoading) {
		return (
			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					background: "#0d1117",
					color: "white",
				}}
			>
				<div>Loading...</div>
			</div>
		);
	}

	// 聊天视图 - 显示输入框和LLM日志底部面板
	if (currentView === "chat") {
		return (
			<AppLayout showInput={true} bottomPanelContent={renderChatBottomPanel()}>
				<MessageList
					messages={messages}
					currentStreamingMessage={currentStreamingMessage}
					showThinking={showThinking}
					onToggleMessageCollapse={toggleMessageCollapse}
					onToggleThinkingCollapse={toggleThinkingCollapse}
				/>
			</AppLayout>
		);
	}

	// 文件浏览器视图 - 不显示输入框，使用终端面板显示执行结果
	return (
		<AppLayout showInput={false} bottomPanelContent={renderFilesBottomPanel()}>
			<FileBrowser
				externalSidebarVisible={false}
				onToggleSidebar={() => {}}
				onExecuteOutput={handleExecuteOutput}
				onOpenBottomPanel={handleOpenBottomPanel}
			/>
		</AppLayout>
	);
}

function App() {
	return (
		<LayoutProvider>
			<AppContent />
		</LayoutProvider>
	);
}

export default App;
