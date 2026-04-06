/**
 * LayoutContext - 全局布局状态管理
 * 统一管理侧边栏、底部面板、视图切换等布局状态
 */

import {
	createContext,
	type ReactNode,
	useContext,
	useState,
} from "react";

export type ViewType = "chat" | "files";
export type BottomPanelType = "terminal" | "preview" | null;

interface LayoutContextValue {
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

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
	// 视图状态
	const [currentView, setCurrentView] = useState<ViewType>("chat");

	// 侧边栏状态
	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		if (typeof window !== "undefined") {
			return window.innerWidth >= 768;
		}
		return false;
	});

	// 底部面板状态
	const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
	const [bottomPanelType, setBottomPanelType] = useState<BottomPanelType>(null);
	const [bottomPanelHeight, setBottomPanelHeight] = useState(300);

	const toggleSidebar = () => setIsSidebarVisible((v) => !v);

	const openBottomPanel = (type: BottomPanelType) => {
		setBottomPanelType(type);
		setIsBottomPanelOpen(true);
	};

	const closeBottomPanel = () => {
		setIsBottomPanelOpen(false);
		setBottomPanelType(null);
	};

	const toggleBottomPanel = (type: BottomPanelType) => {
		if (bottomPanelType === type && isBottomPanelOpen) {
			closeBottomPanel();
		} else {
			openBottomPanel(type);
		}
	};

	const value: LayoutContextValue = {
		currentView,
		setCurrentView,
		isSidebarVisible,
		setIsSidebarVisible,
		toggleSidebar,
		isBottomPanelOpen,
		bottomPanelType,
		bottomPanelHeight,
		openBottomPanel,
		closeBottomPanel,
		setBottomPanelHeight,
		toggleBottomPanel,
	};

	return (
		<LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
	);
}

export function useLayout() {
	const context = useContext(LayoutContext);
	if (!context) {
		throw new Error("useLayout must be used within LayoutProvider");
	}
	return context;
}
