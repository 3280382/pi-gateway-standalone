/**
 * Performance utilities for streaming message handling
 * Use industry standard: batch updates + throttle + RAF scheduling
 */

import { useCallback, useRef } from "react";

// Batch update queue
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

  // Batch add content update
  queueContent(text: string) {
    this.queue.content = (this.queue.content || "") + text;
    this.scheduleUpdate();
  }

  // Batch add thinking update
  queueThinking(thinking: string) {
    this.queue.thinking = (this.queue.thinking || "") + thinking;
    this.scheduleUpdate();
  }

  // Batch add tool call update
  queueToolCall(id: string, name: string, delta: string) {
    if (!this.queue.toolCall) {
      this.queue.toolCall = { id, name, delta: "" };
    }
    this.queue.toolCall.delta += delta;
    this.scheduleUpdate();
  }

  // Batch add tool output update
  queueToolOutput(id: string, output: string) {
    this.queue.toolOutput = { id, output };
    this.scheduleUpdate();
  }

  // Use RAF scheduling, ensure execution when browser is idle
  private scheduleUpdate() {
    if (this.rafId !== null) return;

    const now = performance.now();
    const elapsed = now - this.lastUpdateTime;

    // If too close to last update, delay execution
    if (elapsed < this.MIN_UPDATE_INTERVAL) {
      setTimeout(() => {
        this.rafId = requestAnimationFrame(() => this.flush());
      }, this.MIN_UPDATE_INTERVAL - elapsed);
    } else {
      this.rafId = requestAnimationFrame(() => this.flush());
    }
  }

  // Execute batch update
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

  // Force immediate refresh
  forceFlush() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.flush();
  }

  // Destroy
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

  const queueToolCall = useCallback((id: string, name: string, delta: string) => {
    updaterRef.current?.queueToolCall(id, name, delta);
  }, []);

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

// Throttle function - limit function execution frequency
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
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

// Debounce function - delay execution until stopped calling
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Measure render performance
export function measureRenderTime<T>(name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  if (duration > 16) {
    // Exceeds one frame time
    console.warn(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
  }
  return result;
}
