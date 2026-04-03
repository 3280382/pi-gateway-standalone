/**
 * Session Feature WebSocket 处理器注册
 * 集中注册所有会话相关的 WebSocket 消息处理器
 */

import { wsRouter } from "../../../shared/websocket/ws-router";
import { handleChangeDir } from "./change-dir";
import { handleInit } from "./init";
import { handleListSessions } from "./list-sessions";
import { handleLoadSession } from "./load-session";
import { handleNewSession } from "./new-session";

/**
 * 注册 Session Feature 的所有 WebSocket 处理器
 */
export function registerSessionWSHandlers(): void {
	// 注册 init 处理器
	wsRouter.register("init", handleInit);

	// 注册 new_session 处理器
	wsRouter.register("new_session", handleNewSession);

	// 注册 list_sessions 处理器
	wsRouter.register("list_sessions", handleListSessions);

	// 注册 load_session 处理器
	wsRouter.register("load_session", handleLoadSession);

	// 注册 change_dir 处理器
	wsRouter.register("change_dir", handleChangeDir);
}

// 自动注册（在模块加载时）
registerSessionWSHandlers();

// 导出处理器
export {
	handleChangeDir,
	handleInit,
	handleListSessions,
	handleLoadSession,
	handleNewSession,
};
