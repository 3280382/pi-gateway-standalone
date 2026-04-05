/**
 * WebSocket 共享类型定义
 */

import type { WebSocket } from "ws";
import type { AgentSession } from "../../features/chat/agent-session/agentSession";

/**
 * WebSocket 消息负载的基础类型
 * 使用宽泛的类型以兼容具体处理器类型
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface WSMessagePayload {
	[key: string]: unknown;
}

/**
 * WebSocket 上下文
 * 每个 WebSocket 连接都有自己的上下文
 */
export interface WSContext {
	/** WebSocket 连接 */
	ws: WebSocket;
	/** Gateway 会话 */
	session: AgentSession;
	/** 连接 ID */
	connectionId: string;
	/** 连接时间 */
	connectedAt: Date;
}

/**
 * 消息处理器类型
 * 使用宽松的 payload 类型以支持各种具体类型
 */
export type WSHandler = (
	ctx: WSContext,
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	payload: any,
) => Promise<void> | void;

/**
 * 中间件函数类型
 */
export type WSMiddleware = (
	ctx: WSContext,
	payload: WSMessagePayload,
	next: () => Promise<void>,
) => Promise<void>;

/**
 * 路由项
 */
export interface WSRoute {
	type: string;
	handler: WSHandler;
}
