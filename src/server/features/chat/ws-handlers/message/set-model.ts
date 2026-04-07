/**
 * Set Model Message Handler
 * Handles requests to set the AI model
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle set_model message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleSetModel(
	ctx: WSContext,
	payload: {
		provider: string;
		modelId: string;
		thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
	},
): Promise<void> {
	const { provider, modelId, thinkingLevel } = payload;

	console.log(`[WebSocket] Received set_model message:`, {
		provider,
		modelId,
		thinkingLevel,
	});
	logger.info(
		`[WebSocket] Received set_model message: provider=${provider}, modelId=${modelId}`,
	);

	// Check if session is initialized
	if (!ctx.session.session) {
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: "Session not initialized, please send init message first",
			}),
		);
		return;
	}

	try {
		await ctx.session.setModel(provider, modelId, thinkingLevel);
		// setModel already sends response internally
		logger.info(`[WebSocket] set_model successful`);
	} catch (error) {
		logger.error(
			"[WebSocket] set_model error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Failed to set model",
			}),
		);
	}
}

/**
 * Handle model_change message (simplified, directly calls setModel)
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handleModelChange(
	ctx: WSContext,
	payload: {
		provider: string;
		modelId: string;
	},
): Promise<void> {
	// Reuse set_model logic
	await handleSetModel(ctx, payload);
}
