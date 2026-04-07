/**
 * Session Feature WebSocket Handler Registration
 * Centralized registration of all session-related WebSocket message handlers
 */

import { wsRouter } from "../../ws-router";
import { handleChangeDir } from "./change-dir";
import { handleInit } from "./init";
import { handleListSessions } from "./list-sessions";
import { handleLoadSession } from "./load-session";
import { handleNewSession } from "./new-session";

/**
 * Register all Session Feature WebSocket handlers
 */
export function registerSessionWSHandlers(): void {
	// Register init handler
	wsRouter.register("init", handleInit);

	// Register new_session handler
	wsRouter.register("new_session", handleNewSession);

	// Register list_sessions handler
	wsRouter.register("list_sessions", handleListSessions);

	// Register load_session handler
	wsRouter.register("load_session", handleLoadSession);

	// Register change_dir handler
	wsRouter.register("change_dir", handleChangeDir);
}

// Auto-register (when module loads)
registerSessionWSHandlers();

// Export handlers
export {
	handleChangeDir,
	handleInit,
	handleListSessions,
	handleLoadSession,
	handleNewSession,
};
