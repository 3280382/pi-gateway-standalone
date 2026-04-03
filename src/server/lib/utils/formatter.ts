/**
 * 数据格式化工具
 * 提供通用的数据格式化功能
 */

import type {
	ApiMeta,
	ApiResponse,
	ErrorCode,
} from "../../../shared/types/api.types";

export class Formatter {
	/**
	 * 格式化API成功响应
	 */
	static success<T = any>(data: T, meta?: Partial<ApiMeta>): ApiResponse<T> {
		const response: ApiResponse<T> = {
			success: true,
			data,
		};

		if (meta) {
			response.meta = {
				timestamp: new Date().toISOString(),
				requestId: Formatter.generateRequestId(),
				...meta,
			};
		}

		return response;
	}

	/**
	 * 格式化API错误响应
	 */
	static error(
		code: ErrorCode | string,
		message: string,
		details?: Record<string, any>,
		meta?: Partial<ApiMeta>,
	): ApiResponse {
		const response: ApiResponse = {
			success: false,
			error: {
				code,
				message,
				details,
			},
		};

		if (meta) {
			response.meta = {
				timestamp: new Date().toISOString(),
				requestId: Formatter.generateRequestId(),
				...meta,
			};
		}

		return response;
	}

	/**
	 * 生成请求ID
	 */
	static generateRequestId(): string {
		return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * 格式化日期
	 */
	static formatDate(
		date: Date | string,
		format: "iso" | "local" | "relative" = "iso",
	): string {
		const d = typeof date === "string" ? new Date(date) : date;

		switch (format) {
			case "iso":
				return d.toISOString();
			case "local":
				return d.toLocaleString();
			case "relative": {
				const now = new Date();
				const diffMs = now.getTime() - d.getTime();
				const diffSec = Math.floor(diffMs / 1000);
				const diffMin = Math.floor(diffSec / 60);
				const diffHour = Math.floor(diffMin / 60);
				const diffDay = Math.floor(diffHour / 24);

				if (diffSec < 60) return "刚刚";
				if (diffMin < 60) return `${diffMin}分钟前`;
				if (diffHour < 24) return `${diffHour}小时前`;
				if (diffDay < 7) return `${diffDay}天前`;
				if (diffDay < 30) return `${Math.floor(diffDay / 7)}周前`;
				if (diffDay < 365) return `${Math.floor(diffDay / 30)}个月前`;
				return `${Math.floor(diffDay / 365)}年前`;
			}
			default:
				return d.toISOString();
		}
	}

	/**
	 * 格式化文件大小
	 */
	static formatFileSize(bytes: number, decimals = 2): string {
		if (bytes === 0) return "0 B";

		const k = 1024;
		const dm = decimals < 0 ? 0 : decimals;
		const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

		const i = Math.floor(Math.log(bytes) / Math.log(k));

		return `${parseFloat((bytes / k ** i).toFixed(dm))} ${sizes[i]}`;
	}

	/**
	 * 格式化持续时间
	 */
	static formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) return `${days}d ${hours % 24}h`;
		if (hours > 0) return `${hours}h ${minutes % 60}m`;
		if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
		if (seconds > 0) return `${seconds}s`;
		return `${ms}ms`;
	}

	/**
	 * 截断文本
	 */
	static truncate(text: string, maxLength: number, suffix = "..."): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength - suffix.length) + suffix;
	}

	/**
	 * 格式化JSON，处理循环引用
	 */
	static safeStringify(obj: any, indent = 2): string {
		const seen = new WeakSet();
		return JSON.stringify(
			obj,
			(_key, value) => {
				if (typeof value === "object" && value !== null) {
					if (seen.has(value)) {
						return "[Circular]";
					}
					seen.add(value);
				}
				return value;
			},
			indent,
		);
	}

	/**
	 * 格式化数字（添加千位分隔符）
	 */
	static formatNumber(num: number, locale = "en-US"): string {
		return num.toLocaleString(locale);
	}

	/**
	 * 格式化百分比
	 */
	static formatPercent(value: number, decimals = 1): string {
		return `${(value * 100).toFixed(decimals)}%`;
	}

	/**
	 * 格式化字节为可读字符串
	 */
	static formatBytes(bytes: number): string {
		return Formatter.formatFileSize(bytes);
	}

	/**
	 * 格式化错误对象
	 */
	static formatError(error: Error): Record<string, any> {
		return {
			name: error.name,
			message: error.message,
			stack: error.stack,
			// 提取额外的属性
			...(error as any),
		};
	}

	/**
	 * 格式化查询参数
	 */
	static formatQueryParams(params: Record<string, any>): string {
		const searchParams = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (value !== undefined && value !== null) {
				if (Array.isArray(value)) {
					value.forEach((v) => searchParams.append(key, String(v)));
				} else {
					searchParams.set(key, String(value));
				}
			}
		}

		return searchParams.toString();
	}

	/**
	 * 美化控制台输出
	 */
	static prettyPrint(obj: any): string {
		return JSON.stringify(obj, null, 2);
	}

	/**
	 * 格式化时间戳
	 */
	static formatTimestamp(timestamp: number | string): string {
		const date =
			typeof timestamp === "string" ? new Date(timestamp) : new Date(timestamp);
		return date.toISOString();
	}

	/**
	 * 将对象转换为FormData
	 */
	static toFormData(obj: Record<string, any>): FormData {
		const formData = new FormData();

		for (const [key, value] of Object.entries(obj)) {
			if (value === undefined || value === null) continue;

			if (value instanceof File || value instanceof Blob) {
				formData.append(key, value);
			} else if (Array.isArray(value)) {
				value.forEach((v) => formData.append(key, String(v)));
			} else {
				formData.append(key, String(value));
			}
		}

		return formData;
	}

	/**
	 * 将对象转换为URL查询字符串
	 */
	static toQueryString(obj: Record<string, any>): string {
		return Formatter.formatQueryParams(obj);
	}
}
