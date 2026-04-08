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

// ============================================================================
// Step 1: Setup fetch interceptors before importing any SDK
// ============================================================================

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

// ============================================================================
// Step 2: Import other modules
// ============================================================================

import { WebSocket, WebSocketServer } from "ws";
import { z } from "zod";
import { registerRoutes } from "./app/routes";

// ============================================================================
// Register WebSocket handlers (must be imported before wsRouter usage to trigger auto-registration)
// ============================================================================
import "./features/chat/ws-handlers/session/index";
import "./features/chat/ws-handlers/message/index";
import { PiAgentSession } from "./features/chat/agent-session/piAgentSession";
import { type WSContext, wsRouter } from "./features/chat/ws-router";
import { AppFactory } from "./lib/app-factory";

// ============================================================================
// Server start time for reload detection
// ============================================================================

const SERVER_START_TIME = Date.now();

// ============================================================================
// Global error handlers to prevent crashes
// ============================================================================

process.on("uncaughtException", (error) => {
	console.error("[FATAL] Uncaught exception:", error);
});

process.on("unhandledRejection", (reason, promise) => {
	console.error(
		"[FATAL] Unhandled promise rejection:",
		promise,
		"reason:",
		reason,
	);
});

// ============================================================================
// Logger
// ============================================================================

const logger = new Logger({ level: LogLevel.INFO });

// ============================================================================
// WebSocket message validation Schema
// ============================================================================

const _WebSocketMessageSchema = z.object({
	type: z.string(),
	payload: z.record(z.unknown()).optional(),
});

// ============================================================================
// Create Express app and server
// ============================================================================

const appFactory = AppFactory.createDefault();
const app = appFactory.getApp();
const server = appFactory.getServer();

// ============================================================================
// Register API routes
// ============================================================================

await registerRoutes(app, llmLogManager, SERVER_START_TIME);
appFactory.setupNotFoundHandler();
logger.info("API routes registered, 404 handler set");

// ============================================================================
// Setup WebSocket server
// ============================================================================

const wss = new WebSocketServer({ server });

// Connection counter (for generating unique IDs)
let connectionCounter = 0;

wss.on("connection", (ws) => {
	const connectionId = `conn_${++connectionCounter}_${Date.now()}`;
	logger.info(`[WebSocket] New connection established: ${connectionId}`);

	// Create PiAgentSession instance
	const piAgentSession = new PiAgentSession(ws, llmLogManager);

	// Create WebSocket context
	const ctx: WSContext = {
		ws,
		session: piAgentSession,
		connectionId,
		connectedAt: new Date(),
	};

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
				}),
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
				}),
			);
			return;
		}

		// 3. Use Router to dispatch message
		try {
			await wsRouter.dispatch(type, ctx, payload);
		} catch (error) {
			logger.error(
				`[WebSocket] Error processing message "${type}":`,
				{ rawMessage },
				error instanceof Error ? error : undefined,
			);

			try {
				ws.send(
					JSON.stringify({
						type: "error",
						error:
							error instanceof Error
								? error.message
								: "Failed to process message",
						receivedType: type,
					}),
				);
			} catch (sendError) {
				logger.error(
					"[WebSocket] Failed to send error message:",
					{},
					sendError instanceof Error ? sendError : undefined,
				);
			}
		}
	});

	// Connection close handling
	ws.on("close", () => {
		logger.info(`[WebSocket] Connection closed: ${connectionId}`);
		piAgentSession.dispose();
	});

	// Error handling
	ws.on("error", (error) => {
		logger.error(`[WebSocket] Connection error: ${connectionId}`, {}, error);
		piAgentSession.dispose();
	});
});

// ============================================================================
// Graceful shutdown handling
// ============================================================================

function setupGracefulShutdown() {
	const shutdownSignals = ["SIGINT", "SIGTERM", "SIGQUIT"];

	shutdownSignals.forEach((signal) => {
		process.on(signal, async () => {
			logger.info(`Received ${signal} signal, shutting down gracefully...`);

			// Close WebSocket server
			if (wss) {
				logger.info("Closing WebSocket server...");
				wss.clients.forEach((client) => {
					if (client.readyState === WebSocket.OPEN) {
						client.close(1001, "Server is shutting down");
					}
				});
				wss.close();
			}

			// Cleanup LLM log manager
			llmLogManager.dispose();

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

// ============================================================================
// Start server (only when run directly)
// ============================================================================

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

// ============================================================================
// Exports (for testing)
// ============================================================================

export { app, llmLogManager, PiAgentSession, server, wss };
