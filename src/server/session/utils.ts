/**
 * 会话工具函数
 * @deprecated 请从 @server/core/session/utils 导入
 */

// 从核心模块重新导出以保持向后兼容
export {
	AGENT_DIR,
	encodeCwd,
	expandPath,
	extractSessionIdFromPath,
	getLocalSessionsDir,
	safeFileName,
} from "../core/session/utils";
