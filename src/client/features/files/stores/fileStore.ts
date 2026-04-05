/**
 * File Store - 文件浏览器状态管理
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

export type ViewMode = "grid" | "list";
export type SortMode =
	| "time-desc"
	| "time-asc"
	| "name-asc"
	| "name-desc"
	| "type"
	| "size-desc"
	| "size-asc";
export type FilterType =
	| "all"
	| "dir"
	| "text"
	| "html"
	| "js"
	| "py"
	| "sh"
	| "java"
	| "json"
	| "md"
	| "image"
	| "code"
	| "media"
	| "doc"
	| "custom";

export interface FileItem {
	name: string;
	path: string;
	isDirectory: boolean;
	size?: number;
	modified?: string;
	extension?: string;
}

export interface FileState {
	// 当前路径
	currentPath: string;
	parentPath: string;

	// 文件列表
	items: FileItem[];
	selectedItems: string[];

	// 路径缓存 - 避免重复加载
	pathCache: Map<string, { items: FileItem[]; timestamp: number }>;
	CACHE_TTL: number; // 缓存有效期(ms)

	// 视图设置
	viewMode: ViewMode;
	sortMode: SortMode;
	filterType: FilterType;
	filterText: string;

	// UI状态
	isLoading: boolean;
	error: string | null;
	sidebarVisible: boolean;

	// 选中文件（用于操作）
	selectedActionFile: string | null;
	selectedActionFileName: string | null;

	// 多选模式
	isMultiSelectMode: boolean;

	// 拖拽状态
	draggedItem: FileItem | null;
	isDragging: boolean;
}

interface FileActions {
	// 导航
	setCurrentPath: (path: string) => void;
	navigateUp: () => void;
	navigateHome: () => void;

	// 文件列表
	setItems: (items: FileItem[]) => void;
	toggleSelection: (path: string) => void;
	clearSelection: () => void;
	selectForAction: (path: string, name: string) => void;

	// 视图设置
	setViewMode: (mode: ViewMode) => void;
	toggleViewMode: () => void;
	setSortMode: (mode: SortMode) => void;
	setFilterType: (type: FilterType) => void;
	setFilterText: (text: string) => void;

	// UI
	setLoading: (loading: boolean) => void;
	setError: (error: string | null) => void;
	toggleSidebar: () => void;

	// 路径缓存
	getCachedPath: (path: string) => FileItem[] | null;
	setCachedPath: (path: string, items: FileItem[]) => void;

	// 过滤和排序后的列表
	getFilteredAndSortedItems: () => FileItem[];

	// 执行文件
	executeFile: (
		path: string,
		onOutput?: (output: string) => void,
	) => Promise<string | undefined>;

	// 多选模式
	setMultiSelectMode: (enabled: boolean) => void;
	toggleMultiSelectMode: () => void;
	selectItem: (path: string) => void;
	deselectItem: (path: string) => void;
	isSelected: (path: string) => boolean;

	// 批量操作
	deleteSelectedItems: () => Promise<void>;
	moveSelectedItems: (targetPath: string) => Promise<void>;

	// 文件创建
	createNewFile: (fileName: string) => Promise<void>;

	// 拖拽
	setDraggedItem: (item: FileItem | null) => void;
	setIsDragging: (isDragging: boolean) => void;
}

// 从 localStorage 恢复的路径（如果存在）
const getPersistedPath = (): string | null => {
	try {
		const stored = localStorage.getItem("file-storage");
		if (stored) {
			const data = JSON.parse(stored);
			return data.state?.currentPath || null;
		}
	} catch {
		// 忽略解析错误
	}
	return null;
};

// 检查路径是否存在
const checkPathExists = async (path: string): Promise<boolean> => {
	try {
		const response = await fetch("/api/browse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ path }),
		});
		return response.ok;
	} catch {
		return false;
	}
};

// 初始化文件浏览器路径
export const initializeFilePath = async (): Promise<string> => {
	const persistedPath = getPersistedPath();

	// 如果有持久化的路径，检查是否还存在
	if (persistedPath) {
		const exists = await checkPathExists(persistedPath);
		if (exists) {
			console.log("[FileStore] Using persisted path:", persistedPath);
			return persistedPath;
		}
		console.log("[FileStore] Persisted path no longer exists:", persistedPath);
	}

	// 使用服务器当前目录
	try {
		const response = await fetch("/api/working-dir");
		if (response.ok) {
			const data = await response.json();
			if (data.cwd) {
				console.log("[FileStore] Using server working dir:", data.cwd);
				return data.cwd;
			}
		}
	} catch (error) {
		console.error("[FileStore] Failed to get server working dir:", error);
	}

	// 默认路径
	console.log("[FileStore] Using default path: /root");
	return "/root";
};

export const useFileStore = create<FileState & FileActions>()(
	devtools(
		persist(
			(set, get) => ({
				// 初始状态（会被 persist 恢复的值覆盖）
				currentPath: "/root",
				parentPath: "/",
				items: [],
				selectedItems: [],
				pathCache: new Map(),
				CACHE_TTL: 5 * 60 * 1000, // 5分钟缓存
				viewMode: "grid",
				sortMode: "time-desc",
				filterType: "all",
				filterText: "",
				isLoading: false,
				error: null,
				sidebarVisible: false,
				selectedActionFile: null,
				selectedActionFileName: null,
				isMultiSelectMode: false,
				draggedItem: null,
				isDragging: false,

				// 缓存操作
				getCachedPath: (path: string) => {
					const state = get();
					const cached = state.pathCache.get(path);
					if (!cached) return null;
					if (Date.now() - cached.timestamp > state.CACHE_TTL) {
						const newCache = new Map(state.pathCache);
						newCache.delete(path);
						set({ pathCache: newCache });
						return null;
					}
					return cached.items;
				},

				setCachedPath: (path: string, items: FileItem[]) => {
					const state = get();
					const newCache = new Map(state.pathCache);
					newCache.set(path, { items, timestamp: Date.now() });
					if (newCache.size > 50) {
						const firstKey = newCache.keys().next().value;
						newCache.delete(firstKey);
					}
					set({ pathCache: newCache });
				},

				// 导航
				setCurrentPath: (path) => set({ currentPath: path }),

				navigateUp: () => {
					const current = get().currentPath;
					if (current === "/" || current === "") return;
					const parent = current.split("/").slice(0, -1).join("/") || "/";
					if (parent !== current) {
						set({ currentPath: parent });
					}
				},

				navigateHome: () => {
					set({ currentPath: "/root" });
				},

				// 文件列表
				setItems: (items) => set({ items }),

				toggleSelection: (path) =>
					set((state) => {
						const exists = state.selectedItems.includes(path);
						return {
							selectedItems: exists
								? state.selectedItems.filter((p) => p !== path)
								: [...state.selectedItems, path],
						};
					}),

				clearSelection: () => set({ selectedItems: [] }),

				selectForAction: (path, name) =>
					set({
						selectedActionFile: path,
						selectedActionFileName: name,
					}),

				// 视图设置
				setViewMode: (mode) => set({ viewMode: mode }),

				toggleViewMode: () =>
					set((state) => ({
						viewMode: state.viewMode === "grid" ? "list" : "grid",
					})),

				setSortMode: (mode) => set({ sortMode: mode }),
				setFilterType: (type) => set({ filterType: type }),
				setFilterText: (text) => set({ filterText: text }),

				// UI
				setLoading: (loading) => set({ isLoading: loading }),
				setError: (error) => set({ error }),
				toggleSidebar: () =>
					set((state) => ({ sidebarVisible: !state.sidebarVisible })),

				// 多选模式
				setMultiSelectMode: (enabled) => set({ isMultiSelectMode: enabled }),

				toggleMultiSelectMode: () =>
					set((state) => ({
						isMultiSelectMode: !state.isMultiSelectMode,
						selectedItems: !state.isMultiSelectMode ? [] : state.selectedItems,
					})),

				selectItem: (path) =>
					set((state) => ({
						selectedItems: state.selectedItems.includes(path)
							? state.selectedItems
							: [...state.selectedItems, path],
					})),

				deselectItem: (path) =>
					set((state) => ({
						selectedItems: state.selectedItems.filter((p) => p !== path),
					})),

				isSelected: (path) => {
					return get().selectedItems.includes(path);
				},

				// 批量操作
				deleteSelectedItems: async () => {
					const { selectedItems, currentPath } = get();
					if (selectedItems.length === 0) return;

					try {
						const response = await fetch("/api/files/batch-delete", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ paths: selectedItems }),
						});
						if (!response.ok) throw new Error("Failed to delete files");

						// 刷新当前目录
						const state = get();
						const data = await fetch("/api/browse", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path: currentPath }),
						}).then((r) => r.json());

						const itemsToSet = [
							...(data.parentPath !== data.currentPath
								? [
										{
											name: "..",
											path: data.parentPath,
											isDirectory: true,
											modified: "",
										},
									]
								: []),
							...data.items,
						];

						set({
							items: itemsToSet,
							selectedItems: [],
							isMultiSelectMode: false,
						});
					} catch (error) {
						console.error("Batch delete error:", error);
						set({ error: "Failed to delete selected files" });
						throw error;
					}
				},

				moveSelectedItems: async (targetPath) => {
					const { selectedItems } = get();
					if (selectedItems.length === 0) return;

					try {
						const response = await fetch("/api/files/batch-move", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ paths: selectedItems, targetPath }),
						});
						if (!response.ok) throw new Error("Failed to move files");

						// 刷新当前目录
						const { currentPath } = get();
						const data = await fetch("/api/browse", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path: currentPath }),
						}).then((r) => r.json());

						const itemsToSet = [
							...(data.parentPath !== data.currentPath
								? [
										{
											name: "..",
											path: data.parentPath,
											isDirectory: true,
											modified: "",
										},
									]
								: []),
							...data.items,
						];

						set({
							items: itemsToSet,
							selectedItems: [],
							isMultiSelectMode: false,
						});
					} catch (error) {
						console.error("Batch move error:", error);
						set({ error: "Failed to move selected files" });
						throw error;
					}
				},

				// 创建新文件
				createNewFile: async (fileName) => {
					const { currentPath } = get();
					const filePath = `${currentPath}/${fileName}`.replace(/\/+/g, "/");

					try {
						const response = await fetch("/api/files/write", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path: filePath, content: "" }),
						});
						if (!response.ok) throw new Error("Failed to create file");

						// 刷新当前目录
						const data = await fetch("/api/browse", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path: currentPath }),
						}).then((r) => r.json());

						const itemsToSet = [
							...(data.parentPath !== data.currentPath
								? [
										{
											name: "..",
											path: data.parentPath,
											isDirectory: true,
											modified: "",
										},
									]
								: []),
							...data.items,
						];

						set({ items: itemsToSet });
					} catch (error) {
						console.error("Create file error:", error);
						set({ error: "Failed to create file" });
						throw error;
					}
				},

				// 拖拽
				setDraggedItem: (item) => set({ draggedItem: item }),
				setIsDragging: (isDragging) => set({ isDragging }),

				// 获取过滤和排序后的列表
				getFilteredAndSortedItems: () => {
					const state = get();
					let items = [...state.items];

					// 过滤
					if (state.filterText) {
						const text = state.filterText.toLowerCase();
						items = items.filter((item) =>
							item.name.toLowerCase().includes(text),
						);
					}

					if (state.filterType !== "all") {
						items = items.filter((item) => {
							const ext = item.extension?.toLowerCase() || "";
							switch (state.filterType) {
								case "dir":
									return item.isDirectory;
								case "text":
									return ["txt", "log", "csv"].includes(ext);
								case "html":
									return [
										"html",
										"htm",
										"css",
										"scss",
										"sass",
										"less",
									].includes(ext);
								case "js":
									return ["js", "ts", "jsx", "tsx", "mjs", "cjs"].includes(ext);
								case "py":
									return ["py", "pyw", "ipynb"].includes(ext);
								case "sh":
									return ["sh", "bash", "zsh", "fish"].includes(ext);
								case "java":
									return ["java", "class", "jar"].includes(ext);
								case "json":
									return ["json", "yaml", "yml", "xml"].includes(ext);
								case "md":
									return ["md", "mdx", "markdown"].includes(ext);
								case "image":
									return [
										"png",
										"jpg",
										"jpeg",
										"gif",
										"svg",
										"webp",
										"ico",
										"bmp",
									].includes(ext);
								case "code":
									return [
										"js",
										"ts",
										"jsx",
										"tsx",
										"py",
										"java",
										"cpp",
										"c",
										"h",
										"go",
										"rs",
										"php",
										"rb",
										"swift",
										"kt",
									].includes(ext);
								case "media":
									return [
										"png",
										"jpg",
										"jpeg",
										"gif",
										"svg",
										"mp4",
										"mp3",
										"webp",
										"mov",
										"avi",
									].includes(ext);
								case "doc":
									return ["md", "txt", "doc", "docx", "pdf", "rtf"].includes(
										ext,
									);
								default:
									return true;
							}
						});
					}

					// 排序
					items.sort((a, b) => {
						// ".." 始终排在第一位
						if (a.name === "..") return -1;
						if (b.name === "..") return 1;

						// 目录始终在文件前面（除了..已经处理过了）
						if (a.isDirectory && !b.isDirectory) return -1;
						if (!a.isDirectory && b.isDirectory) return 1;

						switch (state.sortMode) {
							case "name-asc":
								return a.name.localeCompare(b.name);
							case "name-desc":
								return b.name.localeCompare(a.name);
							case "time-desc":
								return (b.modified || "").localeCompare(a.modified || "");
							case "time-asc":
								return (a.modified || "").localeCompare(b.modified || "");
							case "size-desc":
								return (b.size || 0) - (a.size || 0);
							case "size-asc":
								return (a.size || 0) - (b.size || 0);
							case "type":
								return (a.extension || "").localeCompare(b.extension || "");
							default:
								return 0;
						}
					});

					return items;
				},

				// 执行文件（shell脚本等）
				executeFile: async (
					path: string,
					onOutput?: (output: string) => void,
				) => {
					// 通过 API 发送执行命令，结果会显示在终端面板
					try {
						const response = await fetch("/api/execute", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ path }),
						});
						if (!response.ok) {
							throw new Error("Failed to execute file");
						}
						const output = await response.text();
						if (onOutput) {
							onOutput(output);
						}
						return output;
					} catch (error) {
						console.error("Execute file error:", error);
						const errorMessage =
							error instanceof Error ? error.message : "Failed to execute file";
						set({ error: errorMessage });
						if (onOutput) {
							onOutput(`Error: ${errorMessage}`);
						}
						throw error;
					}
				},
			}),
			{
				name: "file-storage",
				version: 1,
				partialize: (state) => ({
					// 只持久化 currentPath
					currentPath: state.currentPath,
				}),
			},
		),
		{ name: "FileStore" },
	),
);
