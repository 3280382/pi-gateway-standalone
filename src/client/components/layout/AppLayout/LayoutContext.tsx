/**
 * LayoutContext - 全局布局状态管理
 * 统一管理侧边栏、底部面板、视图切换等布局状态
 */

import {
	createContext,
	type ReactNode,
	useCallback,
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
	toggleSidebar: () => void;
	openSidebar: () => void;
	closeSidebar: () => void;

	// 底部面板状态
	isBottomPanelOpen: boolean;
	bottomPanelType: BottomPanelType;
	bottomPanelHeight: number;
	openBottomPanel: (type: BottomPanelType) => void;
	closeBottomPanel: () => void;
	setBottomPanelHeight: (height: number) => void;
	toggleBottomPanel: (type: BottomPanelType) => void;

	// 输入框显示（文件浏览器不需要）
	showInputArea: boolean;
	setShowInputArea: (show: boolean) => void;
}

const LayoutContext = createContext<LayoutContextValue | null>(null);

export function LayoutProvider({ children }: { children: ReactNode }) {
	// 视图状态
	const [currentView, setCurrentView] = useState<ViewType>("chat");

	// 侧边栏状态 - 默认隐藏，防止闪现问题
	const [isSidebarVisible, setIsSidebarVisible] = useState(() => {
		if (typeof window !== "undefined") {
			return window.innerWidth >= 768;
		}
		return false; // 默认隐藏，防止服务端/客户端不匹配导致闪现
	});

	// 底部面板状态
	const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(false);
	const [bottomPanelType, setBottomPanelType] = useState<BottomPanelType>(null);
	const [bottomPanelHeight, setBottomPanelHeight] = useState(300);

	// 输入框显示
	const [showInputArea, setShowInputArea] = useState(true);

	// 侧边栏操作
	const toggleSidebar = useCallback(() => {
		setIsSidebarVisible((prev) => !prev);
	}, []);

	const openSidebar = useCallback(() => {
		setIsSidebarVisible(true);
	}, []);

	const closeSidebar = useCallback(() => {
		setIsSidebarVisible(false);
	}, []);

	// 底部面板操作
	const openBottomPanel = useCallback((type: BottomPanelType) => {
		setBottomPanelType(type);
		setIsBottomPanelOpen(true);
	}, []);

	const closeBottomPanel = useCallback(() => {
		setIsBottomPanelOpen(false);
		setBottomPanelType(null);
	}, []);

	const toggleBottomPanel = useCallback(
		(type: BottomPanelType) => {
			if (type === null) {
				setIsBottomPanelOpen(false);
				setBottomPanelType(null);
			} else if (bottomPanelType === type && isBottomPanelOpen) {
				setIsBottomPanelOpen(false);
				setBottomPanelType(null);
			} else {
				setBottomPanelType(type);
				setIsBottomPanelOpen(true);
			}
		},
		[bottomPanelType, isBottomPanelOpen],
	);

	const value: LayoutContextValue = {
		currentView,
		setCurrentView,
		isSidebarVisible,
		toggleSidebar,
		openSidebar,
		closeSidebar,
		isBottomPanelOpen,
		bottomPanelType,
		bottomPanelHeight,
		openBottomPanel,
		closeBottomPanel,
		setBottomPanelHeight,
		toggleBottomPanel,
		showInputArea,
		setShowInputArea,
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
