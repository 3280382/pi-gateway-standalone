/**
 * Express Application Factory
 * Creates and configures Express application
 */

import { createServer, type Server } from "node:http";
import type { ApiResponse } from "@shared/types/api.types";
import compression from "compression";
import cors from "cors";
import express, { type Application, type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { Config } from "../config";
import { ApiError, ErrorFactory } from "./errors";
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
   * Get Express app
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get HTTP server
   */
  getServer(): Server {
    return this.server;
  }

  /**
   * Configure base application settings
   */
  private configureApp(trustProxy: boolean): void {
    // Disable X-Powered-By header
    this.app.disable("x-powered-by");

    // Trust proxy
    if (trustProxy) {
      this.app.set("trust proxy", 1);
    }

    // Development mode cache control
    if (Config.isDevelopment()) {
      this.app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.url.endsWith(".js") || req.url.endsWith(".html") || req.url.includes(".js?v=")) {
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
   * Configure security middleware
   */
  private configureSecurity(): void {
    // Basic security headers
    this.app.use(
      helmet({
        contentSecurityPolicy: Config.isProduction(),
        crossOriginEmbedderPolicy: false, // Allow embedded resources
        crossOriginResourcePolicy: { policy: "cross-origin" },
      })
    );

    // Prevent MIME type sniffing
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      // Allow iframe embedding for raw file API (for HTML preview)
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
   * Configure CORS
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
      })
    );
  }

  /**
   * Configure compression
   */
  private configureCompression(): void {
    this.app.use(compression());
  }

  /**
   * Configure logging
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
      })
    );
  }

  /**
   * Configure static file serving
   */
  private configureStatic(): void {
    const staticConfig = Config.getStaticConfig();

    this.app.use(
      express.static(staticConfig.path, {
        maxAge: staticConfig.maxAge,
        etag: staticConfig.etag,
        lastModified: staticConfig.lastModified,
        setHeaders: (res: Response, path: string) => {
          if (Config.isDevelopment() && (path.endsWith(".js") || path.endsWith(".html"))) {
            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
          }
        },
      })
    );
  }

  /**
   * Configure request body parsing
   */
  private configureParsing(): void {
    // JSON parsing, limit 50MB
    this.app.use(express.json({ limit: "50mb" }));

    // URL encoded parsing
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
  }

  /**
   * Configure error handling
   */
  private configureErrorHandling(): void {
    // Global error handling (404 handling will be added after route registration)
    this.app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
      this.logger.error("Unhandled error", {}, error);

      // If ApiError, use its status code and message
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

      // Unknown error
      const statusCode = error.statusCode || error.status || 500;
      const response: ApiResponse = {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message: Config.isProduction() ? "Internal server error" : error.message,
          details: Config.isProduction() ? undefined : { stack: error.stack },
        },
      };

      res.status(statusCode).json(response);
    });
  }

  /**
   * Setup 404 handling (should be called after all routes are registered)
   */
  setupNotFoundHandler(): void {
    // 404 handling
    this.app.use((_req: Request, _res: Response, next: NextFunction) => {
      const error = ErrorFactory.notFound("Endpoint");
      next(error);
    });
  }

  /**
   * Add router
   */
  addRouter(prefix: string, router: express.Router): void {
    this.app.use(prefix, router);
  }

  /**
   * Add middleware
   */
  addMiddleware(middleware: express.RequestHandler): void {
    this.app.use(middleware);
  }

  /**
   * Start server
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
   * Stop server
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
   * Create default app
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
