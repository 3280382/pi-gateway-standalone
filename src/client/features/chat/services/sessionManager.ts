/**
 * Session Manager - 统一会话管理模块
 * 
 * 职责：
 * 1. 封装 session 生命周期管理（切换目录、选择 session、恢复 session）
 * 2. 协调 sidebarStore、sessionStore、workspaceStore、chatStore 的更新
 * 3. 提供类型安全的 session 操作方法
 * 4. 隐藏 WebSocket 通信细节
 */

import { useChatStore } from "@/features/chat/stores/chatStore";
import { useSessionStore } from "@/features/chat/stores/sessionStore";
import { useSidebarStore } from "@/features/chat/stores/sidebarStore";
import type { Session } from "@/features/chat/types/sidebar";
import { useWorkspaceStore } from "@/features/files/stores";
import { fetchApi } from "@/services/client";
import { websocketService } from "@/services/websocket.service";
import {
	changeChatDirectory,
	createNewChatSession,
	initChatWorkingDirectory,
} from "./chatWebSocket";

// ============================================================================
// Types
// ============================================================================

export interface SwitchDirOptions {
	/** 是否清空当前 sessions 列表（切换目录时通常 true） */
	clearSessions?: boolean;
	/** 是否加载新目录的 sessions 列表（切换目录时通常 true） */
	loadSessions?: boolean;
	/** 是否优先恢复上次使用的 session（切换目录时通常 true） */
	restoreLastSession?: boolean;
}

export interface SessionManagerAPI {
	/** 切换工作目录 */
	switchDirectory: (dir: string, options?: SwitchDirOptions) => Promise<void>;
	/** 选择指定 session */
	selectSession: (sessionId: string) => Promise<void>;
	/** 创建新 session */
	createNewSession: () => Promise<void>;
	/** 获取当前目录上次使用的 session ID */
	getLastSessionForDir: (dir: string) => string | undefined;
	/** 检查 session 是否存在于当前列表 */
	sessionExists: (sessionId: string) => boolean;
}

// ============================================================================
// Private Helpers
// ============================================================================

/**
 * 从 session ID 或 path 中提取可匹配的标识
 */
function extractSessionId(pathOrId: string): string {
	// 如果是 path（如 /root/.pi/.../xxx.jsonl），提取文件名中的 UUID
	if (pathOrId.includes("/")) {
		const fileName = pathOrId.split("/").pop() || "";
		return fileName.replace(".jsonl", "").split("_").pop() || pathOrId;
	}
	return pathOrId;
}

/**
 * 在 sessions 列表中查找匹配的 session
 */
function findSessionInList(sessions: Session[], sessionId: string): Session | undefined {
	const normalizedId = extractSessionId(sessionId);
	return sessions.find((s) => 
		s.id === sessionId || 
		s.path.includes(normalizedId) ||
		extractSessionId(s.path) === normalizedId
	);
}

// ============================================================================
// Store Accessors (避免重复获取 getState)
// ============================================================================

function getStores() {
	return {
		sidebar: useSidebarStore.getState(),
		session: useSessionStore.getState(),
		workspace: useWorkspaceStore.getState(),
		chat: useChatStore.getState(),
	};
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * 切换工作目录
 */
async function switchDirectory(
	targetDir: string,
	options: SwitchDirOptions = {},
): Promise<void> {
	const { clearSessions = true, loadSessions = true, restoreLastSession = true } = options;
	const stores = getStores();

	console.log("[SessionManager] 切换目录:", targetDir, options);

	// 1. 更新 loading 状态
	stores.sidebar.setLoading(true);

	try {
		// 2. 发送 WebSocket 请求
		const response = await new Promise<{
			cwd: string;
			sessionId?: string;
			sessionFile?: string;
			pid?: number;
		}>((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("切换目录超时")), 5000);
			
			changeChatDirectory(targetDir);
			
			const unsub = websocketService.on("dir_changed", (data) => {
				clearTimeout(timeout);
				unsub();
				resolve(data);
			});
		});

		console.log("[SessionManager] 目录切换响应:", response);

		// 3. 更新各 store 的工作目录和连接状态
		stores.sidebar.setWorkingDir(response.cwd);
		stores.workspace.setCurrentDir(response.cwd);
		stores.workspace.addRecentWorkspace(response.cwd);
		stores.session.setIsConnected(true);
		if (response.pid) {
			stores.session.setServerPid(response.pid);
		}

		// 4. 处理 sessions 列表
		if (clearSessions) {
			stores.sidebar.setSessions([]);
			stores.sidebar.setSelectedSessionId(null);
		}

		let sessionsList: Session[] = [];
		if (loadSessions) {
			const data = await fetchApi<{ sessions: any[] }>(
				`/sessions?cwd=${encodeURIComponent(response.cwd)}`,
			);
			sessionsList = (data.sessions || []).map((s) => ({
				id: s.path,
				path: s.path,
				name: s.firstMessage?.slice(0, 35) || s.path.split("/").pop() || "Untitled",
				messageCount: s.messageCount || 0,
				lastModified: new Date(s.modified),
				firstMessage: s.firstMessage,
			}));
			stores.sidebar.setSessions(sessionsList);
		}

		// 5. 确定要使用的 session
		let sessionToUse: Session | undefined;
		let sessionSource: "last" | "server" | "new" = "new";

		if (restoreLastSession) {
			// 优先从 lastSessionByDir 恢复
			const lastSessionId = stores.sidebar.lastSessionByDir[response.cwd];
			if (lastSessionId) {
				sessionToUse = findSessionInList(sessionsList, lastSessionId);
				if (sessionToUse) {
					sessionSource = "last";
					console.log("[SessionManager] 恢复上次 session:", lastSessionId);
				}
			}
		}

		// 如果没有恢复的 session，使用服务端返回的新 session
		if (!sessionToUse && response.sessionId && response.sessionFile) {
			sessionToUse = {
				id: response.sessionFile,
				path: response.sessionFile,
				name: "New Session",
				messageCount: 0,
				lastModified: new Date(),
			};
			sessionSource = "server";
			// 添加到 sessions 列表
			stores.sidebar.addSession?.(sessionToUse) || 
				stores.sidebar.setSessions([sessionToUse, ...sessionsList]);
			console.log("[SessionManager] 使用服务端新 session:", response.sessionId);
		}

		// 6. 加载选中的 session
		if (sessionToUse) {
			await activateSession(sessionToUse);
		}

		console.log("[SessionManager] 目录切换完成:", {
			dir: response.cwd,
			session: sessionToUse?.id,
			source: sessionSource,
		});

	} finally {
		stores.sidebar.setLoading(false);
	}
}

/**
 * 激活指定 session（加载消息等）
 */
async function activateSession(session: Session): Promise<void> {
	const stores = getStores();

	// 1. 更新 store 状态
	stores.sidebar.setSelectedSessionId(session.id);
	stores.session.setCurrentSession(session.id);

	// 2. 保存到 lastSessionByDir（通过 selectSession 间接实现）
	// 这里需要直接更新，避免重复触发
	const currentDir = stores.sidebar.workingDir?.path;
	if (currentDir) {
		const lastSessionByDir = { ...stores.sidebar.lastSessionByDir };
		lastSessionByDir[currentDir] = session.id;
		// 使用 patch 方式更新，避免触发 selectSession 的副作用
		useSidebarStore.setState({ lastSessionByDir }, false, "activateSession");
	}

	// 3. 加载 session 消息
	if (session.path) {
		console.log("[SessionManager] 加载 session 消息:", session.path);
		await stores.chat.loadSession(session.path);
	}

	// 4. 通知服务端加载 session
	websocketService.send("load_session", { sessionPath: session.path });
}

/**
 * 选择指定 session（用户手动选择）
 */
async function selectSession(sessionId: string): Promise<void> {
	const stores = getStores();
	const sessions = stores.sidebar.sessions;
	const session = findSessionInList(sessions, sessionId);

	if (!session) {
		console.warn("[SessionManager] Session 不存在:", sessionId);
		return;
	}

	console.log("[SessionManager] 用户选择 session:", sessionId);
	await activateSession(session);
}

/**
 * 创建新 session
 */
async function createNewSession(): Promise<void> {
	const stores = getStores();

	stores.sidebar.setLoading(true);
	console.log("[SessionManager] 创建新 session");

	try {
		const response = await new Promise<{ sessionId: string; sessionFile: string }>(
			(resolve, reject) => {
				const timeout = setTimeout(() => reject(new Error("创建 session 超时")), 5000);
				
				createNewChatSession();
				
				const unsub = websocketService.on("session_created", (data) => {
					clearTimeout(timeout);
					unsub();
					resolve(data);
				});
			}
		);

		// 创建新 session 对象
		const newSession: Session = {
			id: response.sessionFile,
			path: response.sessionFile,
			name: "New Session",
			messageCount: 0,
			lastModified: new Date(),
		};

		// 添加到列表并激活
		stores.sidebar.addSession?.(newSession) || 
			stores.sidebar.setSessions([newSession, ...stores.sidebar.sessions]);
		
		await activateSession(newSession);

		// 清空消息列表（新 session）
		stores.chat.setMessages([]);

		// 设置连接状态
		stores.session.setIsConnected(true);

		console.log("[SessionManager] 新 session 创建完成:", response.sessionId);

	} finally {
		stores.sidebar.setLoading(false);
	}
}

/**
 * 获取指定目录上次使用的 session ID
 */
function getLastSessionForDir(dir: string): string | undefined {
	return useSidebarStore.getState().lastSessionByDir[dir];
}

/**
 * 检查 session 是否存在于当前列表
 */
function sessionExists(sessionId: string): boolean {
	const sessions = useSidebarStore.getState().sessions;
	return !!findSessionInList(sessions, sessionId);
}

// ============================================================================
// Public API
// ============================================================================

export const sessionManager: SessionManagerAPI = {
	switchDirectory,
	selectSession,
	createNewSession,
	getLastSessionForDir,
	sessionExists,
};

// 为了兼容性，也提供 hook 版本
export function useSessionManager(): SessionManagerAPI {
	return sessionManager;
}
