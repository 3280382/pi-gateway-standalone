/**
 * LLMLogStore Unit Tests
 * 测试 LLM 日志设置状态管理
 */

import { beforeEach, describe, expect, it } from "vitest";

// 模拟 LLMLogStore 状态和操作
interface TestLlmLogState {
	enabled: boolean;
	refreshInterval: number;
	truncate: boolean;
	truncateSize: number;
}

interface TestLlmLogActions {
	setEnabled: (enabled: boolean) => void;
	setRefreshInterval: (interval: number) => void;
	setTruncate: (truncate: boolean) => void;
	setTruncateSize: (size: number) => void;
	resetToDefaults: () => void;
}

function createTestStore(): TestLlmLogState & TestLlmLogActions {
	const defaults = {
		enabled: true,
		refreshInterval: 5,
		truncate: false,
		truncateSize: 5000,
	};

	const state: TestLlmLogState = { ...defaults };

	return {
		...state,

		setEnabled(enabled: boolean) {
			this.enabled = enabled;
		},

		setRefreshInterval(interval: number) {
			this.refreshInterval = interval;
		},

		setTruncate(truncate: boolean) {
			this.truncate = truncate;
		},

		setTruncateSize(size: number) {
			this.truncateSize = size;
		},

		resetToDefaults() {
			this.enabled = defaults.enabled;
			this.refreshInterval = defaults.refreshInterval;
			this.truncate = defaults.truncate;
			this.truncateSize = defaults.truncateSize;
		},
	};
}

describe("LLMLogStore", () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Default State", () => {
		it("should have correct default values", () => {
			expect(store.enabled).toBe(true);
			expect(store.refreshInterval).toBe(5);
			expect(store.truncate).toBe(false);
			expect(store.truncateSize).toBe(5000);
		});
	});

	describe("Enabled State", () => {
		it("should enable logging", () => {
			store.setEnabled(false);
			expect(store.enabled).toBe(false);

			store.setEnabled(true);
			expect(store.enabled).toBe(true);
		});

		it("should disable logging", () => {
			store.setEnabled(false);
			expect(store.enabled).toBe(false);
		});
	});

	describe("Refresh Interval", () => {
		it("should set refresh interval", () => {
			store.setRefreshInterval(10);
			expect(store.refreshInterval).toBe(10);
		});

		it("should set refresh interval to 0", () => {
			store.setRefreshInterval(0);
			expect(store.refreshInterval).toBe(0);
		});

		it("should handle negative interval", () => {
			store.setRefreshInterval(-1);
			expect(store.refreshInterval).toBe(-1);
		});
	});

	describe("Truncate Settings", () => {
		it("should enable truncate", () => {
			store.setTruncate(true);
			expect(store.truncate).toBe(true);
		});

		it("should disable truncate", () => {
			store.setTruncate(true);
			store.setTruncate(false);
			expect(store.truncate).toBe(false);
		});

		it("should set truncate size", () => {
			store.setTruncateSize(10000);
			expect(store.truncateSize).toBe(10000);
		});

		it("should handle small truncate size", () => {
			store.setTruncateSize(100);
			expect(store.truncateSize).toBe(100);
		});
	});

	describe("Reset", () => {
		it("should reset to defaults", () => {
			// Modify all settings
			store.setEnabled(false);
			store.setRefreshInterval(20);
			store.setTruncate(true);
			store.setTruncateSize(1000);

			store.resetToDefaults();

			expect(store.enabled).toBe(true);
			expect(store.refreshInterval).toBe(5);
			expect(store.truncate).toBe(false);
			expect(store.truncateSize).toBe(5000);
		});

		it("should reset only modified settings", () => {
			store.setEnabled(false);
			store.resetToDefaults();

			expect(store.enabled).toBe(true);
			expect(store.refreshInterval).toBe(5); // unchanged
		});
	});

	describe("Edge Cases", () => {
		it("should handle zero truncate size", () => {
			store.setTruncateSize(0);
			expect(store.truncateSize).toBe(0);
		});

		it("should handle large truncate size", () => {
			store.setTruncateSize(1000000);
			expect(store.truncateSize).toBe(1000000);
		});
	});
});

console.log("[Test] LLMLogStore tests loaded");
