#!/usr/bin/env node

/**
 * Pi Gateway Server - Feature-Based Architecture Version
 * Refactored simplified server.ts using WebSocket Router for message dispatch
 *
 * Architecture improvements:
 * - Use WSRouter to dispatch WebSocket messages (replaces switch/case)
 * - Feature-Based directory structure
 * - Core business logic migrated to features/
 */

// ===== [ANCHOR:STEP1_IMPORTS_LLM] =====

import path from "node:path";
import { Config } from "./config";
import { setupLlmInterceptors } from "./features/chat/llm";
import { LlmLogManager } from "./features/chat/llm/log-manager";
import { Logger, LogLevel } from "./lib/utils/logger";

// Global LLM log manager
const llmLogManager = new LlmLogManager({
  enabled: Config.getLlmLogConfig().enabled,
  truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// Setup LLM interceptors (must be before importing pi-coding-agent)
setupLlmInterceptors(llmLogManager, {
  setupHttpInterceptor: true,
  truncateLimit: Config.getLlmLogConfig().truncateLimit,
});

// ===== [ANCHOR:STEP2_IMPORTS_MODULES] =====

import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { registerRoutes } from "./app/routes";

// WebSocket handlers are auto-registered when ws-router.ts is imported
import { serverSessionManager } from "./features/chat/agent-session/session-manager";
import { type WSContext, wsRouter } from "./features/chat/ws-router";
import {
  cleanupTerminalSessions,
  handleTerminalConnection,
} from "./features/terminal/terminal-ws-router";
import { AppFactory } from "./lib/app-factory";

// ===== [ANCHOR:CONSTANTS] =====

const SERVER_START_TIME = Date.now();

// ===== [ANCHOR:ERROR_HANDLERS] =====

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[FATAL] Unhandled promise rejection:", promise, "reason:", reason);
});

// ===== [ANCHOR:LOGGER] =====

const logger = new Logger({ level: LogLevel.INFO });

// ===== [ANCHOR:VALIDATION_SCHEMA] =====

const _WebSocketMessageSchema = z.object({
  type: z.string(),
  payload: z.record(z.unknown()).optional(),
});

// ===== [ANCHOR:APP_SETUP] =====

const appFactory = AppFactory.createDefault();
const app = appFactory.getApp();
const server = appFactory.getServer();

// ===== [ANCHOR:REGISTER_ROUTES] =====

await registerRoutes(app, llmLogManager, SERVER_START_TIME);

// SPA fallback - serve index.html for non-API routes
const staticConfig = Config.getStaticConfig();
app.get("*", (req, res, next) => {
  // Skip API routes
  if (req.path.startsWith("/api/") || req.path.startsWith("/ws")) {
    return next();
  }
  // Serve index.html for all other routes
  res.sendFile(path.join(staticConfig.path, "index.html"));
});

appFactory.setupNotFoundHandler();
logger.info("API routes registered, SPA fallback set, 404 handler set");

// Initialize server-level session manager
serverSessionManager.initialize(llmLogManager);
logger.info("Server session manager initialized");

// ===== [ANCHOR:WEBSOCKET_SETUP] =====

// Connection counter (for generating unique IDs)
let connectionCounter = 0;

// Create WebSocket servers - use noServer to manually handle upgrade
const wss = new WebSocketServer({ noServer: true });
const terminalWss = new WebSocketServer({ noServer: true });

// Handle upgrade manually
server.on("upgrade", (request, socket, head) => {
  const pathname = request.url;
  const origin = request.headers.origin;
  logger.info(`[WebSocket] Upgrade request for path: ${pathname}, origin: ${origin}`);

  // Check origin for security (allow localhost/127.0.0.1 in development)
  const allowedOrigins = ["http://127.0.0.1:5173", "http://localhost:5173"];
  const isAllowed =
    !origin ||
    allowedOrigins.includes(origin) ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1");
  if (!isAllowed) {
    logger.warn(`[WebSocket] Rejected connection from origin: ${origin}`);
    socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
    socket.destroy();
    return;
  }

  if (pathname === "/ws/terminal") {
    terminalWss.handleUpgrade(request, socket, head, (ws) => {
      terminalWss.emit("connection", ws, request);
    });
  } else {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  }
});

// Handle Terminal WebSocket connections
terminalWss.on("connection", (ws) => {
  logger.info("[WebSocket] Terminal connection established");
  handleTerminalConnection(ws);
});

// Handle Chat WebSocket connections
wss.on("connection", (ws) => {
  const connectionId = `conn_${++connectionCounter}_${Date.now()}`;
  logger.info(`[WebSocket] New connection established: ${connectionId}`);

  // Create WebSocket context (session will be set on init)
  const ctx: WSContext = {
    ws,
    session: null as any, // Will be set when init message is received
    connectionId,
    connectedAt: new Date(),
  };

  // Track current working directory for this connection
  let currentWorkingDir: string | null = null;

  // WebSocket message handling - using Router dispatch
  ws.on("message", async (data) => {
    let rawMessage: unknown;

    // 1. Parse JSON
    try {
      rawMessage = JSON.parse(data.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Invalid JSON message",
        })
      );
      return;
    }

    // 2. Extract type and payload
    let type: string;
    let payload: any;

    if (rawMessage && typeof rawMessage === "object" && "type" in rawMessage) {
      type = (rawMessage as any).type;
      // Use entire object as payload, excluding type field
      const { type: _, ...rest } = rawMessage as any;
      payload = rest;
    } else {
      ws.send(
        JSON.stringify({
          type: "error",
          error: "Message must contain type field",
        })
      );
      return;
    }

    // 3. Use Router to dispatch message
    try {
      await wsRouter.dispatch(type, ctx, payload);

      // Update currentWorkingDir after successful init or change_dir
      if (type === "init" && payload.workingDir) {
        currentWorkingDir = payload.workingDir;
        logger.info(
          `[WebSocket] Connection ${connectionId} workingDir set to: ${currentWorkingDir}`
        );
      } else if (type === "change_dir" && payload.path) {
        currentWorkingDir = payload.path;
        logger.info(
          `[WebSocket] Connection ${connectionId} workingDir changed to: ${currentWorkingDir}`
        );
      }
    } catch (error) {
      logger.error(
        `[WebSocket] Error processing message "${type}":`,
        { rawMessage },
        error instanceof Error ? error : undefined
      );

      try {
        ws.send(
          JSON.stringify({
            type: "error",
            error: error instanceof Error ? error.message : "Failed to process message",
            receivedType: type,
          })
        );
      } catch (sendError) {
        logger.error(
          "[WebSocket] Failed to send error message:",
          {},
          sendError instanceof Error ? sendError : undefined
        );
      }
    }
  });

  // Connection close handling
  ws.on("close", () => {
    logger.info(`[WebSocket] Connection closed: ${connectionId}`);
    // Disconnect from server-level session (don't dispose - session persists)
    if (currentWorkingDir) {
      serverSessionManager.disconnectClient(currentWorkingDir, ws);
    }
  });

  // Error handling
  ws.on("error", (error) => {
    logger.error(`[WebSocket] Connection error: ${connectionId}`, {}, error);
    // Disconnect from server-level session (don't dispose - session persists)
    if (currentWorkingDir) {
      serverSessionManager.disconnectClient(currentWorkingDir, ws);
    }
  });
});

// ===== [ANCHOR:GRACEFUL_SHUTDOWN] =====

function setupGracefulShutdown() {
  const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];

  shutdownSignals.forEach((signal) => {
    process.on(signal, async () => {
      logger.info(`Received ${signal} signal, shutting down gracefully...`);

      // Close WebSocket servers
      if (wss) {
        logger.info("Closing Chat WebSocket server...");
        wss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.close(1001, "Server is shutting down");
          }
        });
        wss.close();
      }

      if (terminalWss) {
        logger.info("Closing Terminal WebSocket server...");
        terminalWss.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.close(1001, "Server is shutting down");
          }
        });
        terminalWss.close();
      }

      // Cleanup LLM log manager
      llmLogManager.dispose();

      // Cleanup terminal sessions
      cleanupTerminalSessions();

      // Stop session manager status broadcast
      serverSessionManager.stopStatusBroadcast();

      // Close HTTP server
      if (server) {
        server.close(() => {
          logger.info("HTTP server closed");
          process.exit(0);
        });

        // Force timeout
        setTimeout(() => {
          logger.error("Force shutdown timeout");
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    });
  });

  logger.info("Graceful shutdown handling set up");
}

setupGracefulShutdown();

// ===== [ANCHOR:SERVER_START] =====

const isMainModule =
  import.meta.url.endsWith(process.argv[1]) ||
  process.argv[1]?.includes("server.ts") ||
  process.argv[1]?.includes("server.js");

if (isMainModule) {
  const port = Config.getPort();

  appFactory
    .start()
    .then(() => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   Pi Gateway Server (Feature-Based Architecture)       ║
║                                                        ║
║   Web UI: http://localhost:${port}                      ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
    })
    .catch((error) => {
      console.error("Failed to start server:", error);
      process.exit(1);
    });
}

// ===== [ANCHOR:EXPORTS] =====

export { app, llmLogManager, server, wss };
