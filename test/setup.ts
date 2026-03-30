import React from "react";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// 全局定义 React
global.React = React;

// 全局清理
afterEach(() => {
	cleanup();
});

// 模拟window对象（仅当需要时）
if (typeof window !== "undefined") {
	// 模拟WebSocket
	(window as any).WebSocket = class MockWebSocket {
		static CONNECTING = 0;
		static OPEN = 1;
		static CLOSING = 2;
		static CLOSED = 3;

		onopen: (() => void) | null = null;
		onclose: (() => void) | null = null;
		onerror: ((error: any) => void) | null = null;
		onmessage: ((event: any) => void) | null = null;

		readyState = MockWebSocket.OPEN;

		constructor(public url: string) {
			setTimeout(() => {
				if (this.onopen) this.onopen();
			}, 0);
		}

		send(data: string) {
			console.log("MockWebSocket send:", data);
		}

		close() {
			this.readyState = MockWebSocket.CLOSED;
			if (this.onclose) this.onclose();
		}
	};

	// 模拟localStorage
	const localStorageMock = (() => {
		let store: Record<string, string> = {};
		return {
			getItem(key: string) {
				return store[key] || null;
			},
			setItem(key: string, value: string) {
				store[key] = value;
			},
			removeItem(key: string) {
				delete store[key];
			},
			clear() {
				store = {};
			},
		};
	})();

	Object.defineProperty(window, "localStorage", { value: localStorageMock });

	// 不模拟fetch，使用真实的fetch进行集成测试
	// 如果需要模拟fetch，请取消注释以下代码
	/*
  (window as any).fetch = async (url: string, options?: any) => {
    console.log('Mock fetch:', url, options);
    
    // 模拟API响应
    if (url.includes('/api/models')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          models: [
            { id: 'kimi-k2.5', name: 'Kimi Chat 2.5', provider: 'moonshot' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }
          ]
        }),
        text: async () => JSON.stringify({
          models: [
            { id: 'kimi-k2.5', name: 'Kimi Chat 2.5', provider: 'moonshot' },
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' }
          ]
        })
      };
    }
    
    if (url.includes('/api/browse')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'Content-Type': 'application/json' }),
        json: async () => ({
          currentPath: '/root',
          parentPath: '/',
          items: [
            { name: 'file1.txt', path: '/root/file1.txt', isDirectory: false, size: 1024, modified: new Date().toISOString() },
            { name: 'folder1', path: '/root/folder1', isDirectory: true, size: 0, modified: new Date().toISOString() }
          ]
        }),
        text: async () => JSON.stringify({
          currentPath: '/root',
          parentPath: '/',
          items: [
            { name: 'file1.txt', path: '/root/file1.txt', isDirectory: false, size: 1024, modified: new Date().toISOString() },
            { name: 'folder1', path: '/root/folder1', isDirectory: true, size: 0, modified: new Date().toISOString() }
          ]
        })
      };
    }
    
    // 对于静态文件请求，返回模拟响应
    if (url.includes('/app.js') || url.endsWith('/')) {
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 
          'Content-Type': url.endsWith('.js') ? 'application/javascript' : 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }),
        text: async () => url.endsWith('.js') ? '// Mock app.js' : '<html>Mock HTML</html>'
      };
    }
    
    // 默认响应
    return {
      ok: true,
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/json' }),
      json: async () => ({ success: true }),
      text: async () => JSON.stringify({ success: true })
    };
  };
  */
}
