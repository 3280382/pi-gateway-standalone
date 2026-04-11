/**
 * Version Controller
 * Handles version and status API requests
 */

import type { Request, Response } from "express";
import { Logger, LogLevel } from "../../../lib/utils/logger";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Get server version information
 */
export function createVersionController(startTime: number) {
  return {
    /**
     * Get version info (used for code reload detection via PID change)
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

      logger.debug(`Retrieved version info, PID: ${process.pid}, uptime: ${versionInfo.uptime}ms`);
      res.json(versionInfo);
    },

    /**
     * Health check
     */
    healthCheck(_req: Request, res: Response) {
      res.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      });
    },

    /**
     * Readiness check
     */
    readinessCheck(_req: Request, res: Response) {
      res.json({
        status: "ready",
        timestamp: new Date().toISOString(),
        pid: process.pid,
      });
    },

    /**
     * Liveness check
     */
    livenessCheck(_req: Request, res: Response) {
      res.json({
        status: "alive",
        timestamp: new Date().toISOString(),
        memory: process.memoryUsage(),
      });
    },

    /**
     * Server status
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

      logger.debug(`Retrieved server status, PID: ${process.pid}`);
      res.json(status);
    },
  };
}

export type VersionController = ReturnType<typeof createVersionController>;
