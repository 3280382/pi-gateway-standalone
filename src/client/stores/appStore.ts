/**
 * App Store - 应用级别状态管理
 * 统一管理视图切换、侧边栏、底部面板等全局状态
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ViewType = "chat" | "files";
export type BottomPanelType = "terminal" | "preview" | null;
export type Theme = "dark" | "light";
export type FontSize = "tiny" | "small" | "medium" | "large";

interface AppState {
	// 视图状态
	currentView: ViewType;
	setCurrentView: (view: ViewType) => void;

	// 全局设置
	theme: Theme;
	setTheme: (theme: Theme) => void;
	fontSize: FontSize;
	setFontSize: (size: FontSize) => void;
}

export const useAppStore = create<AppState>()(
	persist(
		(set, get) => ({
			// 初始状态
			currentView: "chat",

			// 视图操作
			setCurrentView: (view) => set({ currentView: view }),

			// 全局设置
			theme: "dark",
			setTheme: (theme) => set({ theme }),
			fontSize: "medium",
			setFontSize: (size) => set({ fontSize: size }),
		}),
		{
			name: "app-storage",
			partialize: (state) => ({
				currentView: state.currentView,
				theme: state.theme,
				fontSize: state.fontSize,
			}),
		},
	),
);
