/**
 * Frontend log manager
 * 按模块区分Log level：
 * - React rendering related: debug level
 * - WebSocket messages: info level
 */

// Log level
export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

// Module log level configuration
const MODULE_LEVELS: Record<string, LogLevel> = {
  // React rendering related modules - debug level
  React: LogLevel.DEBUG,
  Render: LogLevel.DEBUG,
  Component: LogLevel.DEBUG,
  Hook: LogLevel.DEBUG,
  MessageItem: LogLevel.DEBUG,
  MessageList: LogLevel.DEBUG,
  ChatPanel: LogLevel.DEBUG,
  InputArea: LogLevel.DEBUG,

  // WebSocket related modules - info level
  WebSocket: LogLevel.INFO,
  WS: LogLevel.INFO,
  Gateway: LogLevel.INFO,

  // Other modules default level
  default: LogLevel.INFO,
};

// Read whether to enable logs from environment variables
const isDev = process.env.NODE_ENV !== "production";

/**
 * Get module log level
 */
function getModuleLevel(namespace: string): LogLevel {
  // Exact match
  if (MODULE_LEVELS[namespace]) {
    return MODULE_LEVELS[namespace];
  }

  // Prefix match (e.g., "WebSocket:connected" matches "WebSocket")
  for (const [prefix, level] of Object.entries(MODULE_LEVELS)) {
    if (namespace.startsWith(prefix) || namespace.includes(prefix)) {
      return level;
    }
  }

  return MODULE_LEVELS.default;
}

/**
 * Create logger
 */
export function createLogger(namespace: string) {
  const moduleLevel = getModuleLevel(namespace);

  const shouldLog = (level: LogLevel): boolean => {
    if (!isDev) return level >= LogLevel.ERROR; // Production only shows error
    return level <= moduleLevel; // Development based on module level
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

    // Performance timing
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

    // Group
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

// Predefined logger instances
export const reactRenderLog = createLogger("React");
export const componentLog = createLogger("Component");
export const hookLog = createLogger("Hook");
export const wsLog = createLogger("WebSocket");
export const gatewayLog = createLogger("Gateway");
export const chatLog = createLogger("Chat");

// Export default logger
export default createLogger;
