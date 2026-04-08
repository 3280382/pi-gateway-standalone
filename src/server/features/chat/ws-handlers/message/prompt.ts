/**
 * Prompt Message Handler
 * Handles user-sent AI prompt messages
 */

import { Logger, LogLevel } from "../../../../lib/utils/logger";
import type { WSContext } from "../../ws-router";

const logger = new Logger({ level: LogLevel.INFO });

/**
 * Handle prompt message
 * @param ctx WebSocket context
 * @param payload Message payload
 */
export async function handlePrompt(
	ctx: WSContext,
	payload: {
		text: string;
		images?: Array<{
			type: "image";
			source: {
				type: "base64";
				mediaType: string;
				data: string;
			};
		}>;
	},
): Promise<void> {
	const { text, images } = payload;

	logger.info(
		`[WebSocket] Received prompt message: ${text.substring(0, 50)}...`,
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

	// Call session's prompt method
	// PiAgentSession.prompt accepts (text, images?) parameters
	if (ctx.session.isStreaming) {
		// Streaming mode requires special handling
		await ctx.session.prompt(text, images);
	} else {
		await ctx.session.prompt(text, images);
	}

	logger.info("[WebSocket] prompt processing completed");
}
