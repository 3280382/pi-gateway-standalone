/**
 * Base Service - 所有服务的基类
 * 提供通用的HTTP请求、错误处理和日志功能
 */

import { ApiError, fetchApi } from "./api/client";

export interface ApiResponse<T = any> {
	data: T;
	status: number;
	message?: string;
	timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
	pagination: {
		page: number;
		pageSize: number;
		total: number;
		totalPages: number;
	};
}

export interface ServiceError {
	code: string;
	message: string;
	details?: any;
	timestamp: string;
}

export class ServiceError extends Error {
	constructor(
		public code: string,
		message: string,
		public details?: any,
	) {
		super(message);
		this.name = "ServiceError";
		this.timestamp = new Date().toISOString();
	}
}

export abstract class BaseService {
	protected basePath: string;
	protected serviceName: string;

	constructor(serviceName: string, basePath: string = "") {
		this.serviceName = serviceName;
		this.basePath = basePath;
	}

	/**
	 * 发送HTTP GET请求
	 */
	protected async get<T>(
		path: string,
		params?: Record<string, any>,
	): Promise<T> {
		const url = this.buildUrl(path, params);
		try {
			console.log(`[${this.serviceName}] GET ${url}`);
			return await fetchApi<T>(url);
		} catch (error) {
			throw this.handleError(error, "GET", path);
		}
	}

	/**
	 * 发送HTTP POST请求
	 */
	protected async post<T>(
		path: string,
		data?: any,
		params?: Record<string, any>,
	): Promise<T> {
		const url = this.buildUrl(path, params);
		try {
			console.log(`[${this.serviceName}] POST ${url}`);
			return await fetchApi<T>(url, {
				method: "POST",
				body: data ? JSON.stringify(data) : undefined,
			});
		} catch (error) {
			throw this.handleError(error, "POST", path);
		}
	}

	/**
	 * 发送HTTP PUT请求
	 */
	protected async put<T>(
		path: string,
		data?: any,
		params?: Record<string, any>,
	): Promise<T> {
		const url = this.buildUrl(path, params);
		try {
			console.log(`[${this.serviceName}] PUT ${url}`);
			return await fetchApi<T>(url, {
				method: "PUT",
				body: data ? JSON.stringify(data) : undefined,
			});
		} catch (error) {
			throw this.handleError(error, "PUT", path);
		}
	}

	/**
	 * 发送HTTP DELETE请求
	 */
	protected async delete<T>(
		path: string,
		params?: Record<string, any>,
	): Promise<T> {
		const url = this.buildUrl(path, params);
		try {
			console.log(`[${this.serviceName}] DELETE ${url}`);
			return await fetchApi<T>(url, {
				method: "DELETE",
			});
		} catch (error) {
			throw this.handleError(error, "DELETE", path);
		}
	}

	/**
	 * 构建完整的URL
	 */
	private buildUrl(path: string, params?: Record<string, any>): string {
		// basePath 已经包含在 fetchApi 的 API_BASE 中，这里不再添加
		let url = path.startsWith("/") ? path : `/${path}`;

		if (params && Object.keys(params).length > 0) {
			const queryParams = new URLSearchParams();
			Object.entries(params).forEach(([key, value]) => {
				if (value !== undefined && value !== null) {
					queryParams.append(key, String(value));
				}
			});
			url += `?${queryParams.toString()}`;
		}

		return url;
	}

	/**
	 * 处理错误
	 */
	private handleError(error: any, method: string, path: string): ServiceError {
		console.error(`[${this.serviceName}] ${method} ${path} failed:`, error);

		if (error instanceof ApiError) {
			return new ServiceError(
				`API_${error.status}`,
				`API request failed: ${error.status} ${error.statusText}`,
				{
					status: error.status,
					response: error.response,
					originalError: error.message,
				},
			);
		}

		if (error instanceof Error) {
			return new ServiceError(
				"NETWORK_ERROR",
				`Network error: ${error.message}`,
				{ originalError: error },
			);
		}

		return new ServiceError("UNKNOWN_ERROR", "An unknown error occurred", {
			originalError: error,
		});
	}

	/**
	 * 创建带延迟的Promise（用于模拟加载状态）
	 */
	protected async withDelay<T>(
		promise: Promise<T>,
		delayMs: number = 300,
	): Promise<T> {
		const [result] = await Promise.all([
			promise,
			new Promise((resolve) => setTimeout(resolve, delayMs)),
		]);
		return result;
	}

	/**
	 * 重试机制
	 */
	protected async withRetry<T>(
		operation: () => Promise<T>,
		maxRetries: number = 3,
		retryDelay: number = 1000,
	): Promise<T> {
		let lastError: Error;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error as Error;
				console.log(
					`[${this.serviceName}] Attempt ${attempt}/${maxRetries} failed:`,
					error,
				);

				if (attempt < maxRetries) {
					await new Promise((resolve) =>
						setTimeout(resolve, retryDelay * attempt),
					);
				}
			}
		}

		throw lastError!;
	}
}
