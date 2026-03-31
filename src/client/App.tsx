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
import { useChatStore, filterMessages } from "@/stores/chatStore";
import { useMemo } from "react";
import { useNewChatStore } from "@/stores/new-chat.store";
import { useSessionStore } from "@/stores/sessionStore";
import { useSidebarStore } from "@/stores/sidebarStore";
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
	
	// 搜索过滤
	const searchQuery = useChatStore((s) => s.searchQuery);
	const searchFilters = useChatStore((s) => s.searchFilters);
	const filteredMessages = useMemo(() => {
		console.log("[App] Filtering messages:", { 
			totalMessages: messages.length, 
			searchQuery, 
			searchFilters 
		});
		const result = filterMessages(messages, {
			query: searchQuery,
			filters: searchFilters,
		});
		console.log("[App] Filtered result:", result.length, "messages");
		return result;
	}, [messages, searchQuery, searchFilters]);

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

				console.log("[App] Loading persisted state:", {
					persistedDir,
					persistedSessionId,
				});

				// 快速初始化显示（使用持久化的目录）
				if (persistedDir) {
					fileController.setCurrentPath(persistedDir);
					// 同步到 sidebarStore 用于左侧面板高亮
					useSidebarStore.getState().setWorkingDir(persistedDir);
				}

				// 后台完整初始化
				try {
					await sessionController.getUserSettings();

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
						// 使用持久化的目录和sessionId初始化
						const currentDir = persistedDir;
						console.log("[App] Initializing with persisted state:", {
							currentDir,
							persistedSessionId,
						});

						try {
							const initData = await websocketService.initWorkingDirectory(
								currentDir,
								persistedSessionId || undefined,
							);
							console.log("[App] initWorkingDirectory succeeded:", initData);

							if (initData) {
								console.log("[App] Server returned:", {
									workingDir: initData.workingDir,
									sessionId: initData.sessionId,
								});

								// 同步服务器返回的状态到本地存储
								useSessionStore.getState().setCurrentDir(initData.workingDir);
								fileController.setCurrentPath(initData.workingDir);

								// 同步到 sidebarStore 用于左侧面板高亮
								useSidebarStore.getState().setWorkingDir(initData.workingDir);
								useSidebarStore.getState().selectSession(initData.sessionId);

								// 保存到 new-chat store
								useNewChatStore.getState().setSessionId(initData.sessionId);
								useNewChatStore.getState().setCurrentModel(initData.model);

								// 保存到 session store（会被持久化到 localStorage）
								useSessionStore
									.getState()
									.setCurrentSession(initData.sessionId);
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

								// 保存资源文件路径
								if (initData.resourceFiles) {
									useSessionStore
										.getState()
										.setResourceFiles(initData.resourceFiles);
								}

								// 加载历史消息 - 使用统一的 chatStore.loadSession
								if (initData.sessionFile) {
									const count = await useChatStore
										.getState()
										.loadSession(initData.sessionFile);
									console.log(`[App] Loaded ${count} messages via chatStore`);
								}
							}
						} catch (initErr) {
							console.error("[App] initWorkingDirectory error:", initErr);
						}
					}
				} catch (bgErr) {
					console.error("[App] Background init error:", bgErr);
				} finally {
					// 所有初始化完成后关闭 loading
					setIsLoading(false);
				}
			} catch (err) {
				const errorMsg = err instanceof Error ? err.message : String(err);
				setError(errorMsg);
				setIsLoading(false);
			}
		}

		initApp();
	}, []);

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
				<h2>Error</h2>
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

	// 加载状态 - 显示初始化进度
	if (isLoading) {
		return (
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					height: "100vh",
					background: "#0d1117",
					color: "white",
					gap: "20px",
				}}
			>
				<div style={{ fontSize: "48px", fontWeight: "bold", color: "#58a6ff" }}>
					π
				</div>
				<div style={{ fontSize: "18px", color: "#8b949e" }}>
					Initializing Pi Gateway...
				</div>
				<div
					style={{
						width: "200px",
						height: "4px",
						background: "#21262d",
						borderRadius: "2px",
						overflow: "hidden",
					}}
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							background: "#58a6ff",
							animation: "loading 1.5s infinite ease-in-out",
							transformOrigin: "left",
						}}
					/>
				</div>
				<style>{`
					@keyframes loading {
						0% { transform: scaleX(0); }
						50% { transform: scaleX(1); }
						100% { transform: scaleX(0); transform-origin: right; }
					}
				`}</style>
			</div>
		);
	}

	// 聊天视图 - 显示输入框和LLM日志底部面板
	if (currentView === "chat") {
		return (
			<AppLayout showInput={true} bottomPanelContent={renderChatBottomPanel()}>
				<MessageList
					messages={filteredMessages}
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
