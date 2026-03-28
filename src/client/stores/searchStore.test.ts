/**
 * SearchStore Unit Tests
 * 测试搜索状态管理逻辑
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { SearchFilters } from "./searchStore";

// 模拟 SearchStore 状态和操作
interface TestSearchState {
	query: string;
	isActive: boolean;
	filters: SearchFilters;
	results: string[];
	currentIndex: number;
}

interface TestSearchActions {
	setQuery: (query: string) => void;
	setActive: (active: boolean) => void;
	setFilters: (filters: Partial<SearchFilters>) => void;
	setResults: (results: string[]) => void;
	nextResult: () => void;
	prevResult: () => void;
	clearSearch: () => void;
	toggleFilter: (key: keyof SearchFilters) => void;
}

function createTestStore(): TestSearchState & TestSearchActions {
	const state: TestSearchState = {
		query: "",
		isActive: false,
		filters: {
			user: true,
			assistant: true,
			thinking: false,
			tools: false,
		},
		results: [],
		currentIndex: -1,
	};

	return {
		...state,

		setQuery(query: string) {
			this.query = query;
			this.isActive = query.length > 0;
		},

		setActive(active: boolean) {
			this.isActive = active;
		},

		setFilters(filters: Partial<SearchFilters>) {
			this.filters = { ...this.filters, ...filters };
		},

		setResults(results: string[]) {
			this.results = results;
			this.currentIndex = results.length > 0 ? 0 : -1;
		},

		nextResult() {
			if (this.results.length === 0) return;
			this.currentIndex = (this.currentIndex + 1) % this.results.length;
		},

		prevResult() {
			if (this.results.length === 0) return;
			this.currentIndex = this.currentIndex <= 0 ? this.results.length - 1 : this.currentIndex - 1;
		},

		clearSearch() {
			this.query = "";
			this.isActive = false;
			this.results = [];
			this.currentIndex = -1;
		},

		toggleFilter(key: keyof SearchFilters) {
			this.filters = { ...this.filters, [key]: !this.filters[key] };
		},
	};
}

describe("SearchStore", () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
	});

	describe("Query Management", () => {
		it("should set query", () => {
			store.setQuery("test query");
			expect(store.query).toBe("test query");
		});

		it("should activate search when query is set", () => {
			store.setQuery("test");
			expect(store.isActive).toBe(true);
		});

		it("should not activate search for empty query", () => {
			store.setQuery("");
			expect(store.isActive).toBe(false);
		});
	});

	describe("Filters", () => {
		it("should have default filters", () => {
			expect(store.filters.user).toBe(true);
			expect(store.filters.assistant).toBe(true);
			expect(store.filters.thinking).toBe(false);
			expect(store.filters.tools).toBe(false);
		});

		it("should set filters", () => {
			store.setFilters({ thinking: true, tools: true });
			expect(store.filters.thinking).toBe(true);
			expect(store.filters.tools).toBe(true);
			// Other filters should remain unchanged
			expect(store.filters.user).toBe(true);
		});

		it("should toggle filter", () => {
			store.toggleFilter("user");
			expect(store.filters.user).toBe(false);

			store.toggleFilter("user");
			expect(store.filters.user).toBe(true);
		});

		it("should toggle thinking filter", () => {
			expect(store.filters.thinking).toBe(false);
			store.toggleFilter("thinking");
			expect(store.filters.thinking).toBe(true);
		});
	});

	describe("Results", () => {
		it("should set results", () => {
			store.setResults(["msg1", "msg2", "msg3"]);
			expect(store.results).toEqual(["msg1", "msg2", "msg3"]);
		});

		it("should set current index to 0 when results are set", () => {
			store.setResults(["msg1", "msg2"]);
			expect(store.currentIndex).toBe(0);
		});

		it("should set current index to -1 for empty results", () => {
			store.setResults([]);
			expect(store.currentIndex).toBe(-1);
		});
	});

	describe("Navigation", () => {
		beforeEach(() => {
			store.setResults(["msg1", "msg2", "msg3"]);
		});

		it("should navigate to next result", () => {
			expect(store.currentIndex).toBe(0);
			store.nextResult();
			expect(store.currentIndex).toBe(1);
		});

		it("should wrap to first result after last", () => {
			store.nextResult(); // 1
			store.nextResult(); // 2
			store.nextResult(); // wrap to 0
			expect(store.currentIndex).toBe(0);
		});

		it("should navigate to previous result", () => {
			store.nextResult(); // 1
			store.prevResult(); // back to 0
			expect(store.currentIndex).toBe(0);
		});

		it("should wrap to last result from first", () => {
			store.prevResult();
			expect(store.currentIndex).toBe(2);
		});

		it("should not change index when no results", () => {
			store.setResults([]);
			const prevIndex = store.currentIndex;
			store.nextResult();
			expect(store.currentIndex).toBe(prevIndex);
		});
	});

	describe("Clear Search", () => {
		it("should clear all search state", () => {
			store.setQuery("test");
			store.setResults(["msg1", "msg2"]);
			store.setFilters({ thinking: true });

			store.clearSearch();

			expect(store.query).toBe("");
			expect(store.isActive).toBe(false);
			expect(store.results).toEqual([]);
			expect(store.currentIndex).toBe(-1);
		});

		it("should preserve filters when clearing", () => {
			store.setFilters({ thinking: true });
			store.clearSearch();
			expect(store.filters.thinking).toBe(true);
		});
	});

	describe("Active State", () => {
		it("should set active state directly", () => {
			store.setActive(true);
			expect(store.isActive).toBe(true);

			store.setActive(false);
			expect(store.isActive).toBe(false);
		});
	});
});

console.log("[Test] SearchStore tests loaded");
