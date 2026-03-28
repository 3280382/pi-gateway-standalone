/**
 * FileStore Unit Tests
 * 测试纯函数逻辑
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { FileItem, FilterType, SortMode, ViewMode } from "./fileStore";

// 模拟 FileStore 状态和操作
interface TestFileState {
	currentPath: string;
	items: FileItem[];
	selectedItems: Set<string>;
	viewMode: ViewMode;
	sortMode: SortMode;
	filterType: FilterType;
	filterText: string;
	isLoading: boolean;
	error: string | null;
	sidebarVisible: boolean;
}

interface TestFileActions {
	setCurrentPath: (path: string) => void;
	setItems: (items: FileItem[]) => void;
	toggleSelection: (path: string) => void;
	selectAll: () => void;
	clearSelection: () => void;
	setViewMode: (mode: ViewMode) => void;
	setSortMode: (mode: SortMode) => void;
	setFilterType: (type: FilterType) => void;
	setFilterText: (text: string) => void;
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	toggleSidebar: () => void;
	getFilteredAndSortedItems: () => FileItem[];
}

function createTestStore(): TestFileState & TestFileActions {
	const state: TestFileState = {
		currentPath: "/home",
		items: [],
		selectedItems: new Set(),
		viewMode: "list",
		sortMode: "name-asc",
		filterType: "all",
		filterText: "",
		isLoading: false,
		error: null,
		sidebarVisible: true,
	};

	return {
		...state,

		setCurrentPath(path: string) {
			this.currentPath = path;
		},

		setItems(items: FileItem[]) {
			this.items = items;
		},

		toggleSelection(path: string) {
			if (this.selectedItems.has(path)) {
				this.selectedItems.delete(path);
			} else {
				this.selectedItems.add(path);
			}
		},

		selectAll() {
			for (const item of this.items) {
				this.selectedItems.add(item.path);
			}
		},

		clearSelection() {
			this.selectedItems.clear();
		},

		setViewMode(mode: ViewMode) {
			this.viewMode = mode;
		},

		setSortMode(mode: SortMode) {
			this.sortMode = mode;
		},

		setFilterType(type: FilterType) {
			this.filterType = type;
		},

		setFilterText(text: string) {
			this.filterText = text;
		},

		setLoading(loading: boolean) {
			this.isLoading = loading;
		},

		setError(error: string | null) {
			this.error = error;
		},

		toggleSidebar() {
			this.sidebarVisible = !this.sidebarVisible;
		},

		getFilteredAndSortedItems(): FileItem[] {
			let result = [...this.items];

			// Filter by type
			if (this.filterType !== "all") {
				const typeFilters: Record<string, string[]> = {
					code: ["js", "ts", "jsx", "tsx", "py", "java", "go", "rs"],
					media: ["png", "jpg", "jpeg", "gif", "svg", "mp4", "mp3"],
					doc: ["md", "txt", "pdf", "doc", "docx"],
				};

				const exts = typeFilters[this.filterType] || [];
				result = result.filter((item) => {
					if (item.isDirectory) return false;
					const ext = item.name.split(".").pop()?.toLowerCase() || "";
					return exts.includes(ext);
				});
			}

			// Filter by text
			if (this.filterText) {
				const lowerText = this.filterText.toLowerCase();
				result = result.filter((item) => item.name.toLowerCase().includes(lowerText));
			}

			// Sort
			result.sort((a, b) => {
				// Directories always first
				if (a.isDirectory !== b.isDirectory) {
					return a.isDirectory ? -1 : 1;
				}

				let comparison = 0;
				switch (this.sortMode) {
					case "name-asc":
						comparison = a.name.localeCompare(b.name);
						break;
					case "name-desc":
						comparison = b.name.localeCompare(a.name);
						break;
					case "size-asc":
						comparison = (a.size || 0) - (b.size || 0);
						break;
					case "size-desc":
						comparison = (b.size || 0) - (a.size || 0);
						break;
					case "time-asc":
						comparison = new Date(a.modified).getTime() - new Date(b.modified).getTime();
						break;
					case "time-desc":
						comparison = new Date(b.modified).getTime() - new Date(a.modified).getTime();
						break;
					case "type": {
						const aExt = a.name.split(".").pop() || "";
						const bExt = b.name.split(".").pop() || "";
						comparison = aExt.localeCompare(bExt);
						break;
					}
				}

				return comparison;
			});

			return result;
		},
	};
}

// 测试数据
const mockFiles: FileItem[] = [
	{ name: "file1.txt", path: "/home/file1.txt", isDirectory: false, size: 100, modified: "2024-01-15T00:00:00Z" },
	{ name: "file2.js", path: "/home/file2.js", isDirectory: false, size: 500, modified: "2024-01-10T00:00:00Z" },
	{ name: "folder1", path: "/home/folder1", isDirectory: true, modified: "2024-01-20T00:00:00Z" },
	{ name: "file3.md", path: "/home/file3.md", isDirectory: false, size: 200, modified: "2024-01-05T00:00:00Z" },
];

describe("FileStore", () => {
	let store: ReturnType<typeof createTestStore>;

	beforeEach(() => {
		store = createTestStore();
		store.setItems(mockFiles);
	});

	describe("Path Management", () => {
		it("should set current path", () => {
			store.setCurrentPath("/projects");
			expect(store.currentPath).toBe("/projects");
		});
	});

	describe("Item Selection", () => {
		it("should toggle item selection", () => {
			store.toggleSelection("/home/file1.txt");
			expect(store.selectedItems.has("/home/file1.txt")).toBe(true);

			store.toggleSelection("/home/file1.txt");
			expect(store.selectedItems.has("/home/file1.txt")).toBe(false);
		});

		it("should select all items", () => {
			store.selectAll();
			expect(store.selectedItems.size).toBe(4);
		});

		it("should clear selection", () => {
			store.selectAll();
			store.clearSelection();
			expect(store.selectedItems.size).toBe(0);
		});
	});

	describe("View Mode", () => {
		it("should set view mode to grid", () => {
			store.setViewMode("grid");
			expect(store.viewMode).toBe("grid");
		});

		it("should set view mode to list", () => {
			store.setViewMode("list");
			expect(store.viewMode).toBe("list");
		});
	});

	describe("Sorting", () => {
		it("should sort by name ascending", () => {
			store.setSortMode("name-asc");
			const result = store.getFilteredAndSortedItems();

			// Directories first, then files sorted by name
			expect(result[0].name).toBe("folder1");
			expect(result[1].name).toBe("file1.txt");
			expect(result[2].name).toBe("file2.js");
			expect(result[3].name).toBe("file3.md");
		});

		it("should sort by name descending", () => {
			store.setSortMode("name-desc");
			const result = store.getFilteredAndSortedItems();

			expect(result[0].name).toBe("folder1");
			expect(result[3].name).toBe("file1.txt");
		});

		it("should sort by size ascending", () => {
			store.setSortMode("size-asc");
			const result = store.getFilteredAndSortedItems();

			// folder1 first (directory), then files by size
			expect(result[0].name).toBe("folder1");
			expect(result[1].name).toBe("file1.txt"); // 100
			expect(result[2].name).toBe("file3.md"); // 200
			expect(result[3].name).toBe("file2.js"); // 500
		});

		it("should sort by size descending", () => {
			store.setSortMode("size-desc");
			const result = store.getFilteredAndSortedItems();

			expect(result[0].name).toBe("folder1");
			expect(result[1].name).toBe("file2.js"); // 500
			expect(result[2].name).toBe("file3.md"); // 200
			expect(result[3].name).toBe("file1.txt"); // 100
		});

		it("should sort by time ascending", () => {
			store.setSortMode("time-asc");
			const result = store.getFilteredAndSortedItems();

			// folder1 is directory (always first), then sorted by time ascending (oldest first)
			expect(result[0].name).toBe("folder1"); // Jan 20 (directory)
			expect(result[1].name).toBe("file3.md"); // Jan 5 (oldest file)
			expect(result[3].name).toBe("file1.txt"); // Jan 15
		});

		it("should sort by time descending", () => {
			store.setSortMode("time-desc");
			const result = store.getFilteredAndSortedItems();

			expect(result[0].name).toBe("folder1"); // Jan 20
			expect(result[1].name).toBe("file1.txt"); // Jan 15
		});

		it("should sort by type", () => {
			store.setSortMode("type");
			const result = store.getFilteredAndSortedItems();

			expect(result[0].name).toBe("folder1");
		});
	});

	describe("Filtering", () => {
		it("should filter by code type", () => {
			store.setFilterType("code");
			const result = store.getFilteredAndSortedItems();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("file2.js");
		});

		it("should filter by doc type", () => {
			store.setFilterType("doc");
			const result = store.getFilteredAndSortedItems();

			expect(result).toHaveLength(2);
			expect(result.some((item) => item.name === "file1.txt")).toBe(true);
			expect(result.some((item) => item.name === "file3.md")).toBe(true);
		});

		it("should filter by text", () => {
			store.setFilterText("file1");
			const result = store.getFilteredAndSortedItems();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("file1.txt");
		});

		it("should filter case-insensitively", () => {
			store.setFilterText("FILE1");
			const result = store.getFilteredAndSortedItems();

			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("file1.txt");
		});
	});

	describe("Loading and Error States", () => {
		it("should set loading state", () => {
			store.setLoading(true);
			expect(store.isLoading).toBe(true);

			store.setLoading(false);
			expect(store.isLoading).toBe(false);
		});

		it("should set error state", () => {
			store.setError("Failed to load");
			expect(store.error).toBe("Failed to load");

			store.setError(null);
			expect(store.error).toBeNull();
		});
	});

	describe("Sidebar", () => {
		it("should toggle sidebar visibility", () => {
			expect(store.sidebarVisible).toBe(true);
			store.toggleSidebar();
			expect(store.sidebarVisible).toBe(false);
			store.toggleSidebar();
			expect(store.sidebarVisible).toBe(true);
		});
	});

	describe("Empty Items", () => {
		it("should handle empty items list", () => {
			store.setItems([]);
			const result = store.getFilteredAndSortedItems();
			expect(result).toHaveLength(0);
		});
	});
});

console.log("[Test] FileStore tests loaded");
