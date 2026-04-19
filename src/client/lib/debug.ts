/**
 * Debug log tool
 * Provide different log levels for frontend debugging
 */

// Debug level
export enum DebugLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

// Current debug level（can be read from env or config）
const CURRENT_LEVEL: DebugLevel =
  process.env.NODE_ENV === "production" ? DebugLevel.ERROR : DebugLevel.INFO; // Dev env only shows INFO and above

// Debug context
interface DebugContext {
  component?: string;
  function?: string;
  file?: string;
  line?: number;
  timestamp?: string;
  [key: string]: any;
}

/**
 * Create debug logger
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

    // Performance monitoring
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

    // Assertion
    assert: (condition: boolean, message: string, data?: any) => {
      if (!condition && CURRENT_LEVEL >= DebugLevel.ERROR) {
        console.error(`[${namespace}] ASSERTION FAILED: ${message}`, data);
      }
    },
  };
}

/**
 * Internal log function
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
 * File browser specific debugger
 */
export const fileBrowserDebug = createDebugger("FileBrowser", {
  component: "FileBrowser",
});

/**
 * File viewer specific debugger
 */
export const fileViewerDebug = createDebugger("FileViewer", {
  component: "FileViewer",
});

/**
 * File sidebar specific debugger
 */
export const fileSidebarDebug = createDebugger("FileSidebar", {
  component: "FileSidebar",
});

/**
 * File toolbar specific debugger
 */
export const fileToolbarDebug = createDebugger("FileToolbar", {
  component: "FileToolbar",
});

/**
 * File list specific debugger
 */
export const fileListDebug = createDebugger("FileList", {
  component: "FileList",
});

/**
 * File grid specific debugger
 */
export const fileGridDebug = createDebugger("FileGrid", {
  component: "FileGrid",
});

/**
 * File action bar specific debugger
 */
export const fileActionBarDebug = createDebugger("FileActionBar", {
  component: "FileActionBar",
});

/**
 * API call specific debugger
 */
export const apiDebug = createDebugger("API", {
  component: "API",
});

/**
 * Store specific debugger
 */
export const storeDebug = createDebugger("Store", {
  component: "Store",
});

/**
 * Hook specific debugger
 */
export const hookDebug = createDebugger("Hook", {
  component: "Hook",
});

/**
 * Utility: Format object to readable string
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
          // Limit depth
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
 * Utility: Log function calls
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
    `函数Error: ${functionName}`,
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
