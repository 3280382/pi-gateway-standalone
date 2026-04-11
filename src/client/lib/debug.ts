/**
 * 调试日志工具
 * 提供不同级别的日志输出，便于调试前端功能
 */

// 调试级别
export enum DebugLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

// 当前调试级别（可以从环境变量或配置中读取）
const CURRENT_LEVEL: DebugLevel =
  process.env.NODE_ENV === "production" ? DebugLevel.ERROR : DebugLevel.INFO; // 开发环境只显示 INFO 及以上

// 调试上下文
interface DebugContext {
  component?: string;
  function?: string;
  file?: string;
  line?: number;
  timestamp?: string;
  [key: string]: any;
}

/**
 * 创建调试日志器
 */
export function createDebugger(namespace: string, defaultContext: Partial<DebugContext> = {}) {
  return {
    error: (message: string, data?: any, context?: Partial<DebugContext>) =>
      log(DebugLevel.ERROR, namespace, message, data, {
        ...defaultContext,
        ...context,
      }),

    warn: (message: string, data?: any, context?: Partial<DebugContext>) =>
      log(DebugLevel.WARN, namespace, message, data, {
        ...defaultContext,
        ...context,
      }),

    info: (message: string, data?: any, context?: Partial<DebugContext>) =>
      log(DebugLevel.INFO, namespace, message, data, {
        ...defaultContext,
        ...context,
      }),

    debug: (message: string, data?: any, context?: Partial<DebugContext>) =>
      log(DebugLevel.DEBUG, namespace, message, data, {
        ...defaultContext,
        ...context,
      }),

    verbose: (message: string, data?: any, context?: Partial<DebugContext>) =>
      log(DebugLevel.VERBOSE, namespace, message, data, {
        ...defaultContext,
        ...context,
      }),

    // 性能监控
    time: (label: string) => {
      if (CURRENT_LEVEL >= DebugLevel.DEBUG) {
        console.time(`[${namespace}] ${label}`);
      }
    },

    timeEnd: (label: string) => {
      if (CURRENT_LEVEL >= DebugLevel.DEBUG) {
        console.timeEnd(`[${namespace}] ${label}`);
      }
    },

    // 断言
    assert: (condition: boolean, message: string, data?: any) => {
      if (!condition && CURRENT_LEVEL >= DebugLevel.ERROR) {
        console.error(`[${namespace}] ASSERTION FAILED: ${message}`, data);
      }
    },
  };
}

/**
 * 内部日志函数
 */
function log(
  level: DebugLevel,
  namespace: string,
  message: string,
  data?: any,
  context?: Partial<DebugContext>
) {
  if (CURRENT_LEVEL < level) return;

  const timestamp = new Date().toISOString();
  const logContext = {
    timestamp,
    namespace,
    level: DebugLevel[level],
    ...context,
  };

  const logMessage = `[${timestamp}] [${namespace}] ${message}`;

  switch (level) {
    case DebugLevel.ERROR:
      console.error(logMessage, data || "", logContext);
      break;
    case DebugLevel.WARN:
      console.warn(logMessage, data || "", logContext);
      break;
    case DebugLevel.INFO:
      console.info(logMessage, data || "", logContext);
      break;
    case DebugLevel.DEBUG:
      console.debug(logMessage, data || "", logContext);
      break;
    case DebugLevel.VERBOSE:
      console.log(logMessage, data || "", logContext);
      break;
  }
}

/**
 * 文件浏览器专用调试器
 */
export const fileBrowserDebug = createDebugger("FileBrowser", {
  component: "FileBrowser",
});

/**
 * 文件查看器专用调试器
 */
export const fileViewerDebug = createDebugger("FileViewer", {
  component: "FileViewer",
});

/**
 * 文件侧边栏专用调试器
 */
export const fileSidebarDebug = createDebugger("FileSidebar", {
  component: "FileSidebar",
});

/**
 * 文件工具栏专用调试器
 */
export const fileToolbarDebug = createDebugger("FileToolbar", {
  component: "FileToolbar",
});

/**
 * 文件列表专用调试器
 */
export const fileListDebug = createDebugger("FileList", {
  component: "FileList",
});

/**
 * 文件网格专用调试器
 */
export const fileGridDebug = createDebugger("FileGrid", {
  component: "FileGrid",
});

/**
 * 文件操作栏专用调试器
 */
export const fileActionBarDebug = createDebugger("FileActionBar", {
  component: "FileActionBar",
});

/**
 * API调用专用调试器
 */
export const apiDebug = createDebugger("API", {
  component: "API",
});

/**
 * Store专用调试器
 */
export const storeDebug = createDebugger("Store", {
  component: "Store",
});

/**
 * 钩子专用调试器
 */
export const hookDebug = createDebugger("Hook", {
  component: "Hook",
});

/**
 * 工具函数：格式化对象为可读字符串
 */
export function formatObject(obj: any, maxDepth = 3): string {
  if (obj === null) return "null";
  if (obj === undefined) return "undefined";
  if (typeof obj === "string") return obj;
  if (typeof obj === "number" || typeof obj === "boolean") return String(obj);

  try {
    return JSON.stringify(
      obj,
      (_key, value) => {
        if (typeof value === "object" && value !== null) {
          // 限制深度
          if (maxDepth <= 0) return "[Object]";
          return formatObject(value, maxDepth - 1);
        }
        return value;
      },
      2
    );
  } catch (err) {
    return `[Unserializable: ${err.message}]`;
  }
}

/**
 * 工具函数：记录函数调用
 */
export function logFunctionCall(
  debuggerInstance: ReturnType<typeof createDebugger>,
  functionName: string,
  args: any[],
  additionalContext?: Partial<DebugContext>
) {
  debuggerInstance.debug(
    `调用函数: ${functionName}`,
    {
      arguments: args.map((arg) => formatObject(arg)),
      argumentCount: args.length,
    },
    { function: functionName, ...additionalContext }
  );
}

/**
 * 工具函数：记录函数返回
 */
export function logFunctionReturn(
  debuggerInstance: ReturnType<typeof createDebugger>,
  functionName: string,
  returnValue: any,
  additionalContext?: Partial<DebugContext>
) {
  debuggerInstance.debug(
    `函数返回: ${functionName}`,
    {
      returnValue: formatObject(returnValue),
    },
    { function: functionName, ...additionalContext }
  );
}

/**
 * 工具函数：记录错误
 */
export function logError(
  debuggerInstance: ReturnType<typeof createDebugger>,
  functionName: string,
  error: Error,
  additionalContext?: Partial<DebugContext>
) {
  debuggerInstance.error(
    `函数错误: ${functionName}`,
    {
      error: error.message,
      stack: error.stack,
      errorName: error.name,
    },
    { function: functionName, ...additionalContext }
  );
}

/**
 * 高阶函数：包装函数以自动记录调用和返回
 */
export function withLogging<T extends (...args: any[]) => any>(
  debuggerInstance: ReturnType<typeof createDebugger>,
  functionName: string,
  fn: T
): T {
  return ((...args: any[]) => {
    logFunctionCall(debuggerInstance, functionName, args);

    try {
      const result = fn(...args);

      // 处理Promise
      if (result && typeof result.then === "function") {
        return result.then(
          (resolved: any) => {
            logFunctionReturn(debuggerInstance, functionName, resolved);
            return resolved;
          },
          (error: Error) => {
            logError(debuggerInstance, functionName, error);
            throw error;
          }
        );
      }

      logFunctionReturn(debuggerInstance, functionName, result);
      return result;
    } catch (error) {
      logError(debuggerInstance, functionName, error as Error);
      throw error;
    }
  }) as T;
}
