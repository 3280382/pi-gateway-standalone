/**
 * LLM API拦截器
 * 拦截LLM API调用并记录日志
 */

import http from "node:http";
import https from "node:https";
import { URL } from "node:url";

import { Logger, LogLevel } from "../../../lib/utils/logger";
import type { LlmLogManager } from "./log-manager";
import type {
	LlmInterceptorOptions,
	LlmRequestLog,
	LlmResponseLog,
} from "./types";

/**
 * 截断请求体内容
 */
function truncateBody(body: string, maxLength: number = 500000): string {
	if (body.length > maxLength) {
		return (
			body.substring(0, maxLength) +
			`\n... (${body.length - maxLength} more characters truncated. Disable truncation in UI to see full content) ...`
		);
	}
	return body;
}

/**
 * 清理HTTP头，隐藏敏感信息
 */
function sanitizeHeaders(headers: any): Record<string, string> {
	if (!headers) return {};

	const sanitized: Record<string, string> = {};

	try {
		if (headers instanceof Headers) {
			headers.forEach((value, key) => {
				sanitized[key] =
					key.toLowerCase() === "authorization" ||
					key.toLowerCase() === "x-api-key"
						? "[REDACTED]"
						: value;
			});
		} else if (typeof headers === "object") {
			for (const [key, value] of Object.entries(headers)) {
				sanitized[key] =
					key.toLowerCase() === "authorization" ||
					key.toLowerCase() === "x-api-key"
						? "[REDACTED]"
						: String(value);
			}
		}
	} catch (_error) {
		// 忽略头解析错误
	}

	return sanitized;
}

/**
 * 设置全局fetch拦截器
 */
export function setupGlobalFetchInterceptor(
	logManager: LlmLogManager,
	options: LlmInterceptorOptions = {},
): void {
	if (typeof globalThis.fetch !== "function") {
		console.log("[LLM Log] globalThis.fetch not available");
		return;
	}

	const originalFetch = globalThis.fetch;
	const logger = new Logger({ level: LogLevel.INFO });

	// LLM API主机列表
	const llmHosts = options.hosts || [
		// 主要提供商
		"anthropic.com", // api.anthropic.com
		"openai.com", // api.openai.com
		"googleapis.com", // generativelanguage.googleapis.com, cloudcode-pa.googleapis.com
		"amazonaws.com", // bedrock-runtime.*.amazonaws.com

		// OpenAI兼容
		"kimi.com", // api.kimi.com (Kimi)
		"moonshot.cn", // api.moonshot.cn (Kimi via Anthropic SDK)
		"mistral.ai", // api.mistral.ai
		"groq.com", // api.groq.com
		"cerebras.ai", // api.cerebras.ai
		"x.ai", // api.x.ai (Grok)
		"openrouter.ai", // openrouter.ai/api/v1
		"githubcopilot.com", // api.individual.githubcopilot.com
		"deepseek.com", // api.deepseek.com (DeepSeek)
		"huggingface.co", // router.huggingface.co
		"minimax.io", // api.minimax.io
		"minimaxi.com", // api.minimaxi.com
		"z.ai", // api.z.ai
		"vercel.sh", // ai-gateway.vercel.sh
		"opencode.ai", // opencode.ai
		"azure.com", // openai.azure.com
	];

	const truncateLimit = options.truncateLimit || 500000;

	globalThis.fetch = async (input: any, init?: any): Promise<any> => {
		const url = typeof input === "string" ? input : input.toString();

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(url);
		} catch (_e) {
			// Not a full URL, might be a relative URL
			return originalFetch(input, init);
		}

		const host = parsedUrl.host;
		const isLlmApi = llmHosts.some((h) => host.includes(h));
		if (!isLlmApi) {
			return originalFetch(input, init);
		}

		const startTime = Date.now();

		// 构建完整的请求日志
		const requestHeaders = sanitizeHeaders(init?.headers);

		const requestLog: LlmRequestLog = {
			method: init?.method || "GET",
			url: url,
			protocol: parsedUrl.protocol,
			host: parsedUrl.host,
			pathname: parsedUrl.pathname,
			search: parsedUrl.search,
			headers: requestHeaders,
			body: init?.body
				? truncateBody(String(init.body), truncateLimit)
				: undefined,
			timestamp: new Date().toISOString(),
		};

		const requestLogEntry = {
			type: "request" as const,
			content: JSON.stringify(requestLog, null, 2),
		};

		logManager.log(requestLogEntry);
		logger.info(`LLM请求: ${init?.method || "GET"} ${url}`);

		try {
			const response = await originalFetch(input, init);
			const duration = Date.now() - startTime;

			// 克隆响应以读取正文而不消耗原始内容
			const clonedResponse = response.clone();

			// 读取响应正文（可能是流式传输）
			let responseBody: string | undefined;
			let bodyNote: string | undefined;

			const contentType = response.headers.get("content-type") || "";
			const isStreaming =
				contentType.includes("text/event-stream") ||
				contentType.includes("stream") ||
				response.headers.get("transfer-encoding") === "chunked";

			if (isStreaming) {
				bodyNote = "[Streaming response - body not captured]";
			} else {
				try {
					const bodyText = await clonedResponse.text();
					responseBody = truncateBody(bodyText, truncateLimit);
				} catch {
					bodyNote = "[Failed to read response body]";
				}
			}

			// 构建完整的响应日志
			const responseHeaders: Record<string, string> = {};
			response.headers.forEach((value, key) => {
				responseHeaders[key] = value;
			});

			const responseLog: LlmResponseLog = {
				status: response.status,
				statusText: response.statusText,
				url: response.url,
				headers: responseHeaders,
				body: responseBody,
				bodyNote,
				duration: `${duration}ms`,
				timestamp: new Date().toISOString(),
			};

			const responseLogEntry = {
				type: "response" as const,
				content: JSON.stringify(responseLog, null, 2),
			};

			logManager.log(responseLogEntry);
			logger.info(
				`LLM响应: ${response.status} ${response.statusText} 用时 ${duration}ms`,
			);

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			const errorLogEntry = {
				type: "response" as const,
				content: JSON.stringify(
					{
						error: error instanceof Error ? error.message : "Unknown error",
						duration: `${duration}ms`,
						timestamp: new Date().toISOString(),
					},
					null,
					2,
				),
			};

			logManager.log(errorLogEntry);
			logger.error(
				`LLM错误: ${error instanceof Error ? error.message : "Unknown"}`,
				{},
				error instanceof Error ? error : undefined,
			);

			throw error;
		}
	};

	logger.info("全局fetch拦截器已设置");
}

/**
 * 设置HTTP/HTTPS拦截器（旧版SDK的回退）
 */
export function setupHttpInterceptor(
	logManager: LlmLogManager,
	options: LlmInterceptorOptions = {},
): void {
	const originalHttpRequest = http.request;
	const originalHttpsRequest = https.request;
	const logger = new Logger({ level: LogLevel.INFO });
	const truncateLimit = options.truncateLimit || 500000;

	function interceptRequest(
		protocol: string,
		originalRequest: typeof http.request,
		options: any,
		callback?: any,
	): any {
		const startTime = Date.now();
		const host =
			typeof options === "string"
				? new URL(options).host
				: options.hostname || options.host;
		const path =
			typeof options === "string"
				? new URL(options).pathname
				: options.path || "/";

		// 仅拦截LLM API调用
		const isLlmApi =
			host?.includes("anthropic.com") ||
			host?.includes("openai.com") ||
			host?.includes("googleapis.com") ||
			host?.includes("amazonaws.com") ||
			host?.includes("moonshot.cn") ||
			host?.includes("kimi.com") ||
			host?.includes("mistral.ai") ||
			host?.includes("groq.com");

		if (!isLlmApi) {
			return originalRequest(options, callback);
		}

		const requestLog: LlmRequestLog = {
			method: options.method || "GET",
			url: `${protocol}//${host}${path}`,
			protocol: `${protocol}:`,
			host: host || "",
			pathname: path,
			search: "",
			headers: sanitizeHeaders(options.headers),
			timestamp: new Date().toISOString(),
		};

		const requestLogEntry = {
			type: "request" as const,
			content: JSON.stringify(requestLog, null, 2),
		};

		logManager.log(requestLogEntry);
		logger.info(
			`LLM HTTP请求: ${options.method || "GET"} ${protocol}//${host}${path}`,
		);

		const request = originalRequest(options, (response: any) => {
			const responseData: Buffer[] = [];
			const originalOnData = response.on;
			const originalOnEnd = response.on;

			response.on = function (event: string, listener: Function) {
				if (event === "data") {
					return originalOnData.call(this, event, (chunk: Buffer) => {
						responseData.push(chunk);
						listener(chunk);
					});
				}
				if (event === "end") {
					return originalOnEnd.call(this, event, () => {
						const duration = Date.now() - startTime;
						const body = Buffer.concat(responseData).toString("utf-8");

						const responseLog: LlmResponseLog = {
							status: response.statusCode || 0,
							statusText: response.statusMessage || "",
							url: `${protocol}//${host}${path}`,
							headers: sanitizeHeaders(response.headers),
							body: truncateBody(body, truncateLimit),
							duration: `${duration}ms`,
							timestamp: new Date().toISOString(),
						};

						const responseLogEntry = {
							type: "response" as const,
							content: JSON.stringify(responseLog, null, 2),
						};

						logManager.log(responseLogEntry);
						logger.info(
							`LLM HTTP响应: ${response.statusCode} 用时 ${duration}ms`,
						);

						listener();
					});
				}
				return originalOnData.call(this, event, listener);
			};

			return response;
		});

		// 拦截请求体写入
		const originalWrite = request.write;
		const originalEnd = request.end;
		let requestBody = "";

		request.write = function (chunk: any, encoding?: any, callback?: any) {
			if (chunk) {
				requestBody += chunk.toString(encoding || "utf8");
			}
			return originalWrite.call(this, chunk, encoding, callback);
		};

		request.end = function (chunk?: any, encoding?: any, callback?: any) {
			if (chunk) {
				requestBody += chunk.toString(encoding || "utf8");
			}

			// 更新请求日志以包含正文
			if (requestBody) {
				const updatedLogEntry = {
					type: "request" as const,
					content: JSON.stringify(
						{
							...requestLog,
							body: truncateBody(requestBody, truncateLimit),
						},
						null,
						2,
					),
				};

				logManager.log(updatedLogEntry);
			}

			return originalEnd.call(this, chunk, encoding, callback);
		};

		return request;
	}

	// 拦截HTTP和HTTPS请求
	(http as any).request = (options: any, callback?: any) =>
		interceptRequest("http", originalHttpRequest, options, callback);

	(https as any).request = (options: any, callback?: any) =>
		interceptRequest("https", originalHttpsRequest, options, callback);

	logger.info("HTTP/HTTPS拦截器已设置");
}

/**
 * 设置所有LLM拦截器
 */
export function setupLlmInterceptors(
	logManager: LlmLogManager,
	options: LlmInterceptorOptions = {},
): void {
	// 首先设置fetch拦截器（必须在导入SDK之前）
	setupGlobalFetchInterceptor(logManager, options);

	// 然后设置HTTP/HTTPS拦截器（用于旧版SDK）
	if (options.setupHttpInterceptor !== false) {
		setupHttpInterceptor(logManager, options);
	}
}
