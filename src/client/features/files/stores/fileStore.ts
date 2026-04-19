/**
 * File Store - files浏览器状态管理
 *
 * Responsibilities:纯状态管理
 * - 不包含业务逻辑
 * - 不包含 API 调用
 * - 只提供状态读取和设置方法
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import type {
  BottomPanelType,
  FileItem,
  FilterType,
  SortMode,
  TodoItem,
  ViewMode,
} from "@/features/files/types";
import { FILES_BROWSER_PERSIST, FILES_STORAGE_KEYS, FILES_STORAGE_VERSION } from "./persist.config";

// ============================================================================
// Store State & Actions Types (内联定义)
// ============================================================================

export interface FileState {
  // Files浏览状态（注意：workingDir 已从全局 workspaceStore 获取）
  // currentBrowsePath: 当前浏览的绝对路径（用于 grid/list/tree 显示）
  currentBrowsePath: string;
  parentPath: string;
   items: FileItem[];
  selectedItems: string[];
  pathCache: Map<string, {  items: FileItem[]; timestamp: number }>;
  viewMode: ViewMode;
  sortMode: SortMode;
  filterType: FilterType;
  filterText: string;
  isLoading: boolean;
  error: string | null;
  selectedActionFile: string | null;
  selectedActionFileName: string | null;
  isMultiSelectMode: boolean;
  draggedItem: FileItem | null;
  isDragging: boolean;

  // 布局状态
  isSidebarVisible: boolean;
  isBottomPanelOpen: boolean;
  bottomPanelType: BottomPanelType;
  bottomPanelHeight: number;

  // Git 模式状态
  isGitModeActive: boolean;
  gitHistoryFile: { path: string; name: string } | null;
  treeGitStatusMap: Map<string, string>; // path -> gitStatus (for TreeView)

  // Todo 模式状态
  isTodoModeActive: boolean;
  todoInputFile: { path: string; name: string } | null;
  editingTodo: TodoItem | null; // 当前正在编辑的 todo

  // TreeView 过滤状态
  treeFilterMode: "normal" | "all" | "search";
  treeFilterText: string;

  // Todo 列表缓存
  todoList: TodoItem[];
  todoMap: Map<string, TodoItem[]>; // filePath -> todos
}

export interface FileActions {
  // Files操作
  setCurrentBrowsePath: (path: string) => void;
  setParentPath: (path: string) => void;
  setItems: ( items: FileItem[]) => void;
  setSelectedItems: ( items: string[]) => void;
  setPathCache: (cache: Map<string, {  items: FileItem[]; timestamp: number }>) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortMode: (mode: SortMode) => void;
  setFilterType: (type: FilterType) => void;
  setFilterText: (text: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedActionFile: (path: string | null, name: string | null) => void;
  setIsMultiSelectMode: (enabled: boolean) => void;
  setDraggedItem: (item: FileItem | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  toggleSelection: (path: string) => void;
  clearSelection: () => void;
  toggleViewMode: () => void;
  toggleMultiSelectMode: () => void;
  isSelected: (path: string) => boolean;

  // 布局操作
  setSidebarVisible: (visible: boolean) => void;
  toggleSidebar: () => void;
  openBottomPanel: (type: BottomPanelType) => void;
  closeBottomPanel: () => void;
  toggleBottomPanel: (type: BottomPanelType) => void;
  setBottomPanelHeight: (height: number) => void;

  // Git 模式操作
  toggleGitMode: () => void;
  setGitModeActive: (active: boolean) => void;
  setGitHistoryFile: (file: { path: string; name: string } | null) => void;
  updateFileGitStatuses: (statusMap: Record<string, string>) => void;
  setTreeGitStatusMap: (map: Map<string, string>) => void;

  // Todo 模式操作
  toggleTodoMode: () => void;
  setTodoModeActive: (active: boolean) => void;
  setTodoInputFile: (file: { path: string; name: string } | null) => void;
  setEditingTodo: (todo: TodoItem | null) => void;

  // TreeView 过滤操作
  setTreeFilterMode: (mode: "normal" | "all" | "search") => void;
  setTreeFilterText: (text: string) => void;

  // Todo 操作
  setTodoList: (todos: TodoItem[]) => void;
  setTodoMap: (map: Map<string, TodoItem[]>) => void;
  getTodosByPath: (path: string) => TodoItem[];
}

// ============================================================================
// Store
// ============================================================================

export const useFileStore = create<FileState & FileActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        // workingDir 已从全局 workspaceStore 获取
        currentBrowsePath: "/root",
        parentPath: "/",
         items: [],
        selectedItems: [],
        pathCache: new Map(),
        viewMode: "grid",
        sortMode: "time-desc",
        filterType: "all",
        filterText: "",
        isLoading: false,
        error: null,
        selectedActionFile: null,
        selectedActionFileName: null,
        isMultiSelectMode: false,
        draggedItem: null,
        isDragging: false,

        // 布局状态 - 默认都Close
        isSidebarVisible: false,
        isBottomPanelOpen: false,
        bottomPanelType: null,
        bottomPanelHeight: 300,

        // Git 模式状态
        isGitModeActive: false,
        gitHistoryFile: null,
        treeGitStatusMap: new Map(),

        // Todo 模式状态
        isTodoModeActive: false,
        todoInputFile: null,
        editingTodo: null,

        // TreeView 过滤状态 - 默认排除隐藏
        treeFilterMode: "normal",
        treeFilterText: "",

        // Todo 列表缓存
        todoList: [],
        todoMap: new Map(),

        // 基本设置方法
        setCurrentBrowsePath: (path) => set({ currentBrowsePath: path }),
        setParentPath: (path) => set({ parentPath: path }),
        setItems: ( items) => set({  items }),
        setSelectedItems: (selectedItems) => set({ selectedItems }),
        setPathCache: (pathCache) => set({ pathCache }),
        setViewMode: (viewMode) => set({ viewMode }),
        setSortMode: (sortMode) => set({ sortMode }),
        setFilterType: (filterType) => set({ filterType }),
        setFilterText: (filterText) => set({ filterText }),
        setLoading: (isLoading) => set({ isLoading }),
        setError: (error) => set({ error }),
        setSelectedActionFile: (selectedActionFile, selectedActionFileName) =>
          set({ selectedActionFile, selectedActionFileName }),
        setIsMultiSelectMode: (isMultiSelectMode) => set({ isMultiSelectMode }),
        setDraggedItem: (draggedItem) => set({ draggedItem }),
        setIsDragging: (isDragging) => set({ isDragging }),

        // 切换方法
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

        toggleViewMode: () =>
          set((state) => ({
            viewMode: state.viewMode === "grid" ? "list" : "grid",
          })),

        toggleMultiSelectMode: () =>
          set((state) => ({
            isMultiSelectMode: !state.isMultiSelectMode,
            selectedItems: !state.isMultiSelectMode ? [] : state.selectedItems,
          })),

        isSelected: (path) => get().selectedItems.includes(path),

        // 布局操作
        setSidebarVisible: (visible: boolean) => set({ isSidebarVisible: visible }),

        toggleSidebar: () => set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),

        openBottomPanel: (type) => set({ bottomPanelType: type, isBottomPanelOpen: true }),

        closeBottomPanel: () => set({ isBottomPanelOpen: false, bottomPanelType: null }),

        toggleBottomPanel: (type) => {
          const { bottomPanelType, isBottomPanelOpen } = get();
          if (bottomPanelType === type && isBottomPanelOpen) {
            set({ isBottomPanelOpen: false, bottomPanelType: null });
          } else {
            set({ bottomPanelType: type, isBottomPanelOpen: true });
          }
        },

        setBottomPanelHeight: (height: number) => set({ bottomPanelHeight: height }),

        // Git 模式操作
        toggleGitMode: () => set((state) => ({ isGitModeActive: !state.isGitModeActive })),
        setGitModeActive: (active: boolean) => set({ isGitModeActive: active }),
        setGitHistoryFile: (file) => set({ gitHistoryFile: file }),
        setTreeGitStatusMap: (map) => set({ treeGitStatusMap: map }),
        updateFileGitStatuses: (statusMap: Record<string, string>) =>
          set((state) => {
            let hasChanges = false;
            const newItems = state. items.map((item) => {
              const newGitStatus = statusMap[item.path] || statusMap[item.name] || undefined;

              // 检查状态是否变化
              if (item.gitStatus === newGitStatus) {
                return item; // 没有变化，返回原对象
              }

              hasChanges = true;
              return {
                ...item,
                gitStatus: newGitStatus,
              };
            });

            // 只有在有变化时才返回新数组
            if (!hasChanges) {
              return state; // 返回原状态，表示没有变化
            }

            return {  items: newItems };
          }),

        // Todo 模式操作
        toggleTodoMode: () => set((state) => ({ isTodoModeActive: !state.isTodoModeActive })),
        setTodoModeActive: (active: boolean) => set({ isTodoModeActive: active }),
        setTodoInputFile: (file) => set({ todoInputFile: file }),
        setEditingTodo: (todo) => set({ editingTodo: todo }),

        // TreeView 过滤操作
        setTreeFilterMode: (mode) => set({ treeFilterMode: mode }),
        setTreeFilterText: (text) => set({ treeFilterText: text }),

        // Todo 操作
        setTodoList: (todoList) => set({ todoList }),
        setTodoMap: (todoMap) => set({ todoMap }),
        getTodosByPath: (path) => {
          const state = get();
          return state.todoMap.get(path) || [];
        },
      }),
      {
        name: FILES_STORAGE_KEYS.FILES_BROWSER,
        version: FILES_STORAGE_VERSION.FILES_BROWSER,
        partialize: (state) =>
          Object.fromEntries(FILES_BROWSER_PERSIST.map((key) => [key, state[key]])),
      }
    ),
    { name: "FileStore" }
  )
);

// 基础类型重新导出，方便使用
export type {
  BottomPanelType,
  FileItem,
  FilterType,
  SortMode,
  ViewMode,
} from "@/features/files/types";
