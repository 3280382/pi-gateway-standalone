/**
 * List Models Message Handler
 * Handles requests to list available models
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle list_models message
 * @param ctx WebSocket context
 * @param _payload Message payload (no extra data needed)
 */
export async function handleListModels(
	ctx: WSContext,
	_payload: unknown,
): Promise<void> {
	logger.info("[WebSocket] Received list_models message");

	try {
		const available = await ctx.session.modelRegistry.getAvailable();

		ctx.ws.send(
			JSON.stringify({
				type: "models_list",
				models: available.map((m) => ({
					id: m.id,
					provider: m.provider,
					name: m.name ?? m.id,
					description: "",
				})),
			}),
		);

		logger.info(`[WebSocket] list_models successful: ${available.length} models`);
	} catch (error) {
		logger.error(
			"[WebSocket] list_models error:",
			{},
			error instanceof Error ? error : undefined,
		);
		ctx.ws.send(
			JSON.stringify({
				type: "error",
				error: error instanceof Error ? error.message : "Failed to list models",
			}),
		);
	}
}
