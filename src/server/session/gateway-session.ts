/**
 * Gateway会话类
 * @deprecated 请从 @server/core/session 导入
 */

// 从核心模块重新导出以保持向后兼容
export {
	GatewaySession,
	type ServerMessage,
} from "../core/session/GatewaySession";
