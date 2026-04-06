/**
 * App Store - 应用级别状态管理
 * 统一管理视图切换、侧边栏、底部面板等全局状态
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewType = "chat" | "files";
export type BottomPanelType = "terminal" | "preview" | null;

interface AppState {
	// 视图状态
	currentView: ViewType;
	setCurrentView: (view: ViewType) => void;

	// 侧边栏状态
	isSidebarVisible: boolean;
	setIsSidebarVisible: (visible: boolean) => void;
	toggleSidebar: () => void;

	// 底部面板状态
	isBottomPanelOpen: boolean;
	bottomPanelType: BottomPanelType;
	bottomPanelHeight: number;
	openBottomPanel: (type: BottomPanelType) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
	toggleBottomPanel: (type: BottomPanelType) => void;
}

export const useAppStore = create<AppState>()(
	persist(
		(set, get) => ({
			// 初始状态
			currentView: "chat",
			isSidebarVisible: typeof window !== "undefined" ? window.innerWidth >= 768 : false,
			isBottomPanelOpen: false,
			bottomPanelType: null,
			bottomPanelHeight: 300,

			// 视图操作
			setCurrentView: (view) => set({ currentView: view }),

			// 侧边栏操作
			setIsSidebarVisible: (visible) => set({ isSidebarVisible: visible }),
			toggleSidebar: () => set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),

			// 底部面板操作
			openBottomPanel: (type) => set({ bottomPanelType: type, isBottomPanelOpen: true }),
			closeBottomPanel: () => set({ isBottomPanelOpen: false, bottomPanelType: null }),
			setBottomPanelHeight: (height) => set({ bottomPanelHeight: height }),
			toggleBottomPanel: (type) => {
				const { bottomPanelType, isBottomPanelOpen, openBottomPanel, closeBottomPanel } = get();
				if (bottomPanelType === type && isBottomPanelOpen) {
					closeBottomPanel();
				} else {
					openBottomPanel(type);
				}
			},
		}),
		{
			name: "layout-storage",
			partialize: (state) => ({
				currentView: state.currentView,
				isSidebarVisible: state.isSidebarVisible,
				isBottomPanelOpen: state.isBottomPanelOpen,
				bottomPanelType: state.bottomPanelType,
				bottomPanelHeight: state.bottomPanelHeight,
			}),
		},
	),
);
