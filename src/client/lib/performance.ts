/**
 * Performance utilities for streaming message handling
 * 使用业界标准方案：批量更新 + 节流 + RAF调度
 */

import { useCallback, useRef } from "react";

// 批量更新队列
interface UpdateQueue {
	content?: string;
	thinking?: string;
	toolCall?: { id: string; name: string; delta: string };
	toolOutput?: { id: string; output: string };
}

export class BatchedUpdater {
	private queue: UpdateQueue = {};
	private rafId: number | null = null;
	private lastUpdateTime = 0;
	private readonly MIN_UPDATE_INTERVAL = 16; // ~60fps
	private callback: (updates: UpdateQueue) => void;

	constructor(callback: (updates: UpdateQueue) => void) {
		this.callback = callback;
	}

	// 批量添加内容更新
	queueContent(text: string) {
		this.queue.content = (this.queue.content || "") + text;
		this.scheduleUpdate();
	}

	// 批量添加思考更新
	queueThinking(thinking: string) {
		this.queue.thinking = (this.queue.thinking || "") + thinking;
		this.scheduleUpdate();
	}

	// 批量添加工具调用更新
	queueToolCall(id: string, name: string, delta: string) {
		if (!this.queue.toolCall) {
			this.queue.toolCall = { id, name, delta: "" };
		}
		this.queue.toolCall.delta += delta;
		this.scheduleUpdate();
	}

	// 批量添加工具输出更新
	queueToolOutput(id: string, output: string) {
		this.queue.toolOutput = { id, output };
		this.scheduleUpdate();
	}

	// 使用RAF调度更新，确保在浏览器空闲时执行
	private scheduleUpdate() {
		if (this.rafId !== null) return;

		const now = performance.now();
		const elapsed = now - this.lastUpdateTime;

		// 如果距离上次更新太近，延迟执行
		if (elapsed < this.MIN_UPDATE_INTERVAL) {
			setTimeout(() => {
				this.rafId = requestAnimationFrame(() => this.flush());
			}, this.MIN_UPDATE_INTERVAL - elapsed);
		} else {
			this.rafId = requestAnimationFrame(() => this.flush());
		}
	}

	// 执行批量更新
	private flush() {
		if (Object.keys(this.queue).length === 0) {
			this.rafId = null;
			return;
		}

		this.lastUpdateTime = performance.now();
		const updates = { ...this.queue };
		this.queue = {};
		this.rafId = null;

		this.callback(updates);
	}

	// 强制立即刷新
	forceFlush() {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
		}
		this.flush();
	}

	// 销毁
	destroy() {
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
		}
		this.queue = {};
	}
}

// React Hook for using batched updates
export function useBatchedUpdates(onUpdate: (updates: UpdateQueue) => void) {
	const updaterRef = useRef<BatchedUpdater | null>(null);

	if (!updaterRef.current) {
		updaterRef.current = new BatchedUpdater(onUpdate);
	}

	const queueContent = useCallback((text: string) => {
		updaterRef.current?.queueContent(text);
	}, []);

	const queueThinking = useCallback((thinking: string) => {
		updaterRef.current?.queueThinking(thinking);
	}, []);

	const queueToolCall = useCallback(
		(id: string, name: string, delta: string) => {
			updaterRef.current?.queueToolCall(id, name, delta);
		},
		[],
	);

	const forceFlush = useCallback(() => {
		updaterRef.current?.forceFlush();
	}, []);

	return {
		queueContent,
		queueThinking,
		queueToolCall,
		forceFlush,
	};
}

// 节流函数 - 限制函数执行频率
export function throttle<T extends (...args: any[]) => void>(
	func: T,
	limit: number,
): (...args: Parameters<T>) => void {
	let inThrottle = false;
	return (...args: Parameters<T>) => {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

// 防抖函数 - 延迟执行直到停止调用
export function debounce<T extends (...args: any[]) => void>(
	func: T,
	wait: number,
): (...args: Parameters<T>) => void {
	let timeout: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeout);
		timeout = setTimeout(() => func(...args), wait);
	};
}

// 测量渲染性能
export function measureRenderTime<T>(name: string, fn: () => T): T {
	const start = performance.now();
	const result = fn();
	const duration = performance.now() - start;
	if (duration > 16) {
		// 超过一帧时间
		console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
	}
	return result;
}
