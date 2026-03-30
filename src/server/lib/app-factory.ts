/**
 * Express应用工厂
 * 创建和配置Express应用程序
 */

import type { ApiResponse } from "@shared/types/api.types";
import compression from "compression";
import cors from "cors";
import express, {
	type Application,
	type NextFunction,
	type Request,
	type Response,
} from "express";
import helmet from "helmet";
import { createServer, type Server } from "http";
import morgan from "morgan";
import { join } from "path";
import { Config } from "../config";
import { ApiError, ErrorFactory } from "./errors/api.error";
import { Logger, LogLevel } from "./utils/logger";

export interface AppOptions {
	enableStatic?: boolean;
	enableCors?: boolean;
	enableSecurity?: boolean;
	enableCompression?: boolean;
	enableLogging?: boolean;
	trustProxy?: boolean;
}

export class AppFactory {
	private app: Application;
	private server: Server;
	private logger: Logger;

	constructor(options: AppOptions = {}) {
		const {
			enableStatic = true,
			enableCors = true,
			enableSecurity = true,
			enableCompression = true,
			enableLogging = true,
			trustProxy = false,
		} = options;

		this.logger = new Logger({ level: LogLevel.INFO });
		this.app = express();
		this.server = createServer(this.app);

		this.configureApp(trustProxy);

		if (enableSecurity) {
			this.configureSecurity();
		}

		if (enableCors) {
			this.configureCors();
		}

		if (enableCompression) {
			this.configureCompression();
		}

		if (enableLogging) {
			this.configureLogging();
		}

		if (enableStatic) {
			this.configureStatic();
		}

		this.configureParsing();
		this.configureErrorHandling();
	}

	/**
	 * 获取Express应用
	 */
	getApp(): Application {
		return this.app;
	}

	/**
	 * 获取HTTP服务器
	 */
	getServer(): Server {
		return this.server;
	}

	/**
	 * 配置基础应用设置
	 */
	private configureApp(trustProxy: boolean): void {
		// 禁用X-Powered-By头
		this.app.disable("x-powered-by");

		// 信任代理
		if (trustProxy) {
			this.app.set("trust proxy", 1);
		}

		// 开发模式缓存控制
		if (Config.isDevelopment()) {
			this.app.use((req: Request, res: Response, next: NextFunction) => {
				if (
					req.url.endsWith(".js") ||
					req.url.endsWith(".html") ||
					req.url.includes(".js?v=")
				) {
					res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
					res.setHeader("Pragma", "no-cache");
					res.setHeader("Expires", "0");
					res.setHeader("Vary", "*");
				}
				next();
			});
		}
	}

	/**
	 * 配置安全中间件
	 */
	private configureSecurity(): void {
		// 基础安全头部
		this.app.use(
			helmet({
				contentSecurityPolicy: Config.isProduction(),
				crossOriginEmbedderPolicy: false, // 允许嵌入式资源
				crossOriginResourcePolicy: { policy: "cross-origin" },
			}),
		);

		// 防止MIME类型嗅探
		this.app.use((req: Request, res: Response, next: NextFunction) => {
			res.setHeader("X-Content-Type-Options", "nosniff");
			// 允许iframe嵌入原始文件API（用于HTML预览）
			if (req.path === "/api/files/raw") {
				res.setHeader("X-Frame-Options", "SAMEORIGIN");
			} else {
				res.setHeader("X-Frame-Options", "DENY");
			}
			res.setHeader("X-XSS-Protection", "1; mode=block");
			next();
		});
	}

	/**
	 * 配置CORS
	 */
	private configureCors(): void {
		const corsConfig = Config.getCorsConfig();
		this.app.use(
			cors({
				origin: corsConfig.origin,
				credentials: corsConfig.credentials,
				methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
				allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
				exposedHeaders: ["X-API-Version", "X-Contract-Version", "X-Cache"],
			}),
		);
	}

	/**
	 * 配置压缩
	 */
	private configureCompression(): void {
		this.app.use(compression());
	}

	/**
	 * 配置日志
	 */
	private configureLogging(): void {
		const format = Config.isProduction() ? "combined" : "dev";
		this.app.use(
			morgan(format, {
				stream: {
					write: (message: string) => {
						this.logger.info(message.trim());
					},
				},
			}),
		);
	}

	/**
	 * 配置静态文件服务
	 */
	private configureStatic(): void {
		const staticConfig = Config.getStaticConfig();

		this.app.use(
			express.static(staticConfig.path, {
				maxAge: staticConfig.maxAge,
				etag: staticConfig.etag,
				lastModified: staticConfig.lastModified,
				setHeaders: (res: Response, path: string) => {
					if (
						Config.isDevelopment() &&
						(path.endsWith(".js") || path.endsWith(".html"))
					) {
						res.setHeader(
							"Cache-Control",
							"no-cache, no-store, must-revalidate",
						);
						res.setHeader("Pragma", "no-cache");
						res.setHeader("Expires", "0");
					}
				},
			}),
		);
	}

	/**
	 * 配置请求体解析
	 */
	private configureParsing(): void {
		// JSON解析，限制50MB
		this.app.use(express.json({ limit: "50mb" }));

		// URL编码解析
		this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
	}

	/**
	 * 配置错误处理
	 */
	private configureErrorHandling(): void {
		// 全局错误处理（404处理将在路由注册后添加）
		this.app.use(
			(error: any, _req: Request, res: Response, _next: NextFunction) => {
				this.logger.error("Unhandled error", {}, error);

				// 如果是ApiError，使用其状态码和消息
				if (error instanceof ApiError) {
					const response: ApiResponse = {
						success: false,
						error: {
							code: error.code,
							message: error.message,
							details: error.details,
						},
					};

					return res.status(error.statusCode).json(response);
				}

				// 未知错误
				const statusCode = error.statusCode || error.status || 500;
				const response: ApiResponse = {
					success: false,
					error: {
						code: "INTERNAL_ERROR",
						message: Config.isProduction()
							? "Internal server error"
							: error.message,
						details: Config.isProduction() ? undefined : { stack: error.stack },
					},
				};

				res.status(statusCode).json(response);
			},
		);
	}

	/**
	 * 设置404处理（应在所有路由注册后调用）
	 */
	setupNotFoundHandler(): void {
		// 404处理
		this.app.use((_req: Request, _res: Response, next: NextFunction) => {
			const error = ErrorFactory.notFound("Endpoint");
			next(error);
		});
	}

	/**
	 * 添加路由
	 */
	addRouter(prefix: string, router: express.Router): void {
		this.app.use(prefix, router);
	}

	/**
	 * 添加中间件
	 */
	addMiddleware(middleware: express.RequestHandler): void {
		this.app.use(middleware);
	}

	/**
	 * 启动服务器
	 */
	async start(): Promise<void> {
		return new Promise((resolve) => {
			const port = Config.getPort();
			const host = Config.getHost();

			this.server.listen(port, host, () => {
				this.logger.info(`Server started on http://${host}:${port}`);
				resolve();
			});
		});
	}

	/**
	 * 停止服务器
	 */
	async stop(): Promise<void> {
		return new Promise((resolve, reject) => {
			this.server.close((error) => {
				if (error) {
					this.logger.error("Failed to stop server", {}, error);
					reject(error);
				} else {
					this.logger.info("Server stopped");
					resolve();
				}
			});
		});
	}

	/**
	 * 创建默认应用
	 */
	static createDefault(): AppFactory {
		return new AppFactory({
			enableStatic: true,
			enableCors: true,
			enableSecurity: true,
			enableCompression: true,
			enableLogging: true,
			trustProxy: Config.isProduction(),
		});
	}
}
