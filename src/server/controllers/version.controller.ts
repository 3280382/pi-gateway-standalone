/**
 * 版本控制器
 * 处理版本和状态API请求
 */

import type { Request, Response } from "express";
import { Logger, LogLevel } from "../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * 获取服务器版本信息
 */
export function createVersionController(startTime: number) {
	return {
		/**
		 * 获取版本信息（用于通过PID变更进行代码重新加载检测）
		 */
		getVersion(_req: Request, res: Response) {
			const versionInfo = {
				pid: process.pid,
				startTime,
				uptime: Date.now() - startTime,
				nodeVersion: process.version,
				platform: process.platform,
				arch: process.arch,
				memoryUsage: process.memoryUsage(),
			};

			logger.debug(
				`获取版本信息，PID: ${process.pid}, 运行时间: ${versionInfo.uptime}ms`,
			);
			res.json(versionInfo);
		},

		/**
		 * 健康检查
		 */
		healthCheck(_req: Request, res: Response) {
			res.json({
				status: "healthy",
				timestamp: new Date().toISOString(),
				uptime: process.uptime(),
			});
		},

		/**
		 * 准备就绪检查
		 */
		readinessCheck(_req: Request, res: Response) {
			res.json({
				status: "ready",
				timestamp: new Date().toISOString(),
				pid: process.pid,
			});
		},

		/**
		 * 活跃度检查
		 */
		livenessCheck(_req: Request, res: Response) {
			res.json({
				status: "alive",
				timestamp: new Date().toISOString(),
				memory: process.memoryUsage(),
			});
		},

		/**
		 * 服务器状态
		 */
		getStatus(_req: Request, res: Response) {
			const status = {
				pid: process.pid,
				uptime: process.uptime(),
				memory: process.memoryUsage(),
				platform: process.platform,
				arch: process.arch,
				nodeVersion: process.version,
				timestamp: new Date().toISOString(),
			};

			logger.debug(`获取服务器状态，PID: ${process.pid}`);
			res.json(status);
		},
	};
}

export type VersionController = ReturnType<typeof createVersionController>;
