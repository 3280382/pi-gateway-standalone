/**
 * 前端日志管理器
 * 按模块区分日志级别：
 * - React渲染相关: debug级别
 * - WebSocket消息: info级别
 */

// 日志级别
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

// 模块日志级别配置
const MODULE_LEVELS: Record<string, LogLevel> = {
  // React渲染相关模块 - debug级别
  React: LogLevel.DEBUG,
  Render: LogLevel.DEBUG,
  Component: LogLevel.DEBUG,
  Hook: LogLevel.DEBUG,
  MessageItem: LogLevel.DEBUG,
  MessageList: LogLevel.DEBUG,
  ChatPanel: LogLevel.DEBUG,
  InputArea: LogLevel.DEBUG,

  // WebSocket相关模块 - info级别
  WebSocket: LogLevel.INFO,
  WS: LogLevel.INFO,
  Gateway: LogLevel.INFO,

  // Others模块默认级别
  default: LogLevel.INFO,
};

// 从环境变量读取是否启用日志
const isDev = process.env.NODE_ENV !== "production";

/**
 * 获取模块的日志级别
 */
function getModuleLevel(namespace: string): LogLevel {
  // 精确匹配
  if (MODULE_LEVELS[namespace]) {
    return MODULE_LEVELS[namespace];
  }

  // 前缀匹配 (如 "WebSocket:connected" 匹配 "WebSocket")
  for (const [prefix, level] of Object.entries(MODULE_LEVELS)) {
    if (namespace.startsWith(prefix) || namespace.includes(prefix)) {
      return level;
    }
  }

  return MODULE_LEVELS.default;
}

/**
 * 创建日志器
 */
export function createLogger(namespace: string) {
  const moduleLevel = getModuleLevel(namespace);

  const shouldLog = (level: LogLevel): boolean => {
    if (!isDev) return level >= LogLevel.ERROR; // 生产环境只显示error
    return level <= moduleLevel; // 开发环境根据模块级别
  };

  const formatMessage = (message: string, _data?: any): string => {
    const timestamp = new Date().toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return `[${timestamp}] [${namespace}] ${message}`;
  };

  return {
    error: (message: string, data?: any) => {
      if (shouldLog(LogLevel.ERROR)) {
        console.error(formatMessage(message), data);
      }
    },

    warn: (message: string, data?: any) => {
      if (shouldLog(LogLevel.WARN)) {
        console.warn(formatMessage(message), data);
      }
    },

    info: (message: string, data?: any) => {
      if (shouldLog(LogLevel.INFO)) {
        console.info(formatMessage(message), data);
      }
    },

    debug: (message: string, data?: any) => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.debug(formatMessage(message), data);
      }
    },

    verbose: (message: string, data?: any) => {
      if (shouldLog(LogLevel.VERBOSE)) {
        console.log(formatMessage(message), data);
      }
    },

    // 性能计时
    time: (label: string) => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.time(`[${namespace}] ${label}`);
      }
    },

    timeEnd: (label: string) => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.timeEnd(`[${namespace}] ${label}`);
      }
    },

    // 分组
    group: (label: string) => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.group(formatMessage(label));
      }
    },

    groupEnd: () => {
      if (shouldLog(LogLevel.DEBUG)) {
        console.groupEnd();
      }
    },
  };
}

// 预定义的日志器实例
export const reactRenderLog = createLogger("React");
export const componentLog = createLogger("Component");
export const hookLog = createLogger("Hook");
export const wsLog = createLogger("WebSocket");
export const gatewayLog = createLogger("Gateway");
export const chatLog = createLogger("Chat");

// 导出默认日志器
export default createLogger;
