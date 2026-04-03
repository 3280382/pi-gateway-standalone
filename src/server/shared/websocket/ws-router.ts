/**
 * WebSocket 消息路由器
 * 将 WebSocket 消息分发到对应的处理器
 *
 * 设计原则：
 * - 类似 Express 的路由风格
 * - 支持异步处理器
 * - 统一错误处理
 * - 可扩展，支持中间件
 */

import { Logger, LogLevel } from "../../lib/utils/logger";
import type {
	WSContext,
	WSHandler,
	WSMessagePayload,
	WSMiddleware,
	WSRoute,
} from "./types";

export type { WSContext, WSHandler, WSMessagePayload, WSMiddleware, WSRoute };

const logger = new Logger({ level: LogLevel.INFO });

/**
 * WebSocket 路由器
 * 管理消息类型到处理器的映射
 */
export class WSRouter {
	private routes: Map<string, WSHandler> = new Map();
	private middlewares: WSMiddleware[] = [];
	private errorHandler?: (error: Error, ctx: WSContext, type: string) => void;

	/**
	 * 注册消息处理器
	 * @param type 消息类型
	 * @param handler 处理器函数
	 */
	register(type: string, handler: WSHandler): void {
		if (this.routes.has(type)) {
			logger.warn(`[WSRouter] 消息类型 "${type}" 已被注册，将被覆盖`);
		}
		this.routes.set(type, handler);
		logger.info(`[WSRouter] 注册处理器: ${type}`);
	}

	/**
	 * 批量注册消息处理器
	 * @param routes 路由数组
	 */
	registerBatch(routes: WSRoute[]): void {
		for (const { type, handler } of routes) {
			this.register(type, handler);
		}
	}

	/**
	 * 移除消息处理器
	 * @param type 消息类型
	 */
	unregister(type: string): void {
		this.routes.delete(type);
		logger.info(`[WSRouter] 注销处理器: ${type}`);
	}

	/**
	 * 添加中间件
	 * @param middleware 中间件函数
	 */
	use(middleware: WSMiddleware): void {
		this.middlewares.push(middleware);
	}

	/**
	 * 设置错误处理器
	 * @param handler 错误处理器
	 */
	setErrorHandler(
		handler: (error: Error, ctx: WSContext, type: string) => void,
	): void {
		this.errorHandler = handler;
	}

	/**
	 * 分发消息到对应的处理器
	 * @param type 消息类型
	 * @param ctx WebSocket 上下文
	 * @param payload 消息负载
	 */
	async dispatch(
		type: string,
		ctx: WSContext,
		payload: WSMessagePayload,
	): Promise<void> {
		const handler = this.routes.get(type);

		if (!handler) {
			logger.warn(`[WSRouter] 未找到消息类型 "${type}" 的处理器`);
			ctx.ws.send(
				JSON.stringify({
					type: "error",
					error: `未知的消息类型: ${type}`,
				}),
			);
			return;
		}

		try {
			// 构建中间件链
			const executeHandler = async () => {
				await handler(ctx, payload);
			};

			// 应用中间件
			await this.applyMiddlewares(ctx, payload, executeHandler);
		} catch (error) {
			logger.error(
				`[WSRouter] 处理消息 "${type}" 时出错:`,
				{},
				error instanceof Error ? error : undefined,
			);

			if (this.errorHandler) {
				this.errorHandler(error as Error, ctx, type);
			} else {
				// 默认错误处理
				ctx.ws.send(
					JSON.stringify({
						type: "error",
						error:
							error instanceof Error ? error.message : "处理消息时发生错误",
						messageType: type,
					}),
				);
			}
		}
	}

	/**
	 * 应用中间件链
	 */
	private async applyMiddlewares(
		ctx: WSContext,
		payload: WSMessagePayload,
		finalHandler: () => Promise<void>,
	): Promise<void> {
		let index = 0;

		const next = async (): Promise<void> => {
			if (index < this.middlewares.length) {
				const middleware = this.middlewares[index++];
				await middleware(ctx, payload, next);
			} else {
				await finalHandler();
			}
		};

		await next();
	}

	/**
	 * 获取已注册的消息类型列表
	 */
	getRegisteredTypes(): string[] {
		return Array.from(this.routes.keys());
	}

	/**
	 * 检查消息类型是否已注册
	 * @param type 消息类型
	 */
	has(type: string): boolean {
		return this.routes.has(type);
	}
}

/**
 * 全局 WebSocket 路由器实例
 */
export const wsRouter = new WSRouter();

/**
 * 消息类型验证中间件
 * 验证消息格式是否正确
 */
export const validateMessageMiddleware: WSMiddleware = async (
	ctx,
	payload,
	next,
) => {
	if (payload === null || payload === undefined) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "消息负载不能为空",
			}),
		);
		return;
	}
	await next();
};

/**
 * 会话检查中间件
 * 检查会话是否已初始化
 */
export const requireSessionMiddleware: WSMiddleware = async (
	ctx,
	_payload,
	next,
) => {
	if (!ctx.session.session) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "会话未初始化，请先发送 init 消息",
			}),
		);
		return;
	}
	await next();
};

/**
 * 日志中间件
 * 记录消息处理日志
 */
export const loggingMiddleware: WSMiddleware = async (_ctx, payload, next) => {
	const type = (payload?.type as string) || "unknown";
	logger.debug(`[WS] 接收消息: ${type}`);
	await next();
};
