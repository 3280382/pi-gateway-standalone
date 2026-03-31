/**
 * AppLayout - 统一布局控制器 (Flex + 文档流)
 */

import { useCallback, useEffect, useRef } from "react";
import { useChatController } from "@/services/api/chatApi";
import { useChatStore } from "@/stores/chatStore";
import { useSessionStore } from "@/stores/sessionStore";
import { InputArea } from "../../chat/InputArea/InputArea";
import { FileSidebar } from "../../files/FileSidebar";
import { BottomMenu } from "../BottomMenu";
import { SidebarPanel } from "../SidebarPanel/SidebarPanel";
import { TopBar } from "../TopBar/TopBar";
import styles from "./AppLayout.module.css";
import { useLayout } from "./LayoutContext";

interface AppLayoutProps {
	children: React.ReactNode;
	showInput?: boolean;
	bottomPanelContent?: React.ReactNode;
}

export function AppLayout({
	children,
	showInput = true,
	bottomPanelContent,
}: AppLayoutProps) {
	const {
		isSidebarVisible,
		toggleSidebar,
		currentView,
		setCurrentView,
		isBottomPanelOpen,
		bottomPanelHeight,
		setBottomPanelHeight,
		toggleBottomPanel,
	} = useLayout();

	const { currentDir, isConnected, serverPid } = useSessionStore();
	const controller = useChatController();
	const inputText = useChatStore((s) => s.inputText);
	const isStreaming = useChatStore((s) => s.isStreaming);

	// 滚动相关引用
	const contentBodyRef = useRef<HTMLDivElement>(null);
	const userScrolledRef = useRef(false);
	const isProgrammaticScrollRef = useRef(false);
	const scrollTimeoutRef = useRef<number | null>(null);

	// 从 store 获取消息数量和流式消息
	const messages = useChatStore((s) => s.messages);
	const currentStreamingMessage = useChatStore((s) => s.currentStreamingMessage);

	// 安全的滚动到底部函数
	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		const container = contentBodyRef.current;
		if (!container) return;

		// 标记为程序化滚动，避免触发用户滚动检测
		isProgrammaticScrollRef.current = true;

		container.scrollTo({
			top: container.scrollHeight,
			behavior,
		});

		// 清除之前的定时器
		if (scrollTimeoutRef.current) {
			clearTimeout(scrollTimeoutRef.current);
		}

		// 滚动动画完成后重置标记
		scrollTimeoutRef.current = window.setTimeout(() => {
			isProgrammaticScrollRef.current = false;
		}, 500);
	}, []);

	// 初始加载和历史消息加载时滚动到底部
	useEffect(() => {
		if (messages.length > 0) {
			requestAnimationFrame(() => {
				scrollToBottom("auto");
			});
		}
	}, []); // 只在组件挂载时执行

	// 新消息添加时滚动
	useEffect(() => {
		if (userScrolledRef.current) return;
		scrollToBottom("smooth");
	}, [messages.length, scrollToBottom]);

	// 流式消息内容变化时滚动
	useEffect(() => {
		if (!currentStreamingMessage) return;
		if (userScrolledRef.current) return;
		scrollToBottom("auto");
	}, [
		currentStreamingMessage?.content?.length,
		currentStreamingMessage?.id,
		scrollToBottom,
	]);

	// 监听滚动事件
	const handleScroll = () => {
		const container = contentBodyRef.current;
		if (!container) return;
		if (isProgrammaticScrollRef.current) return;

		const { scrollTop, scrollHeight, clientHeight } = container;
		const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
		userScrolledRef.current = distanceFromBottom > 50;
	};

	// 清理定时器
	useEffect(() => {
		return () => {
			if (scrollTimeoutRef.current) {
				clearTimeout(scrollTimeoutRef.current);
			}
		};
	}, []);

	return (
		<div className={styles.layout}>
			{/* 侧边栏 - 绝对定位，遮挡顶部和内容，不遮挡底部 */}
			<aside
				className={`${styles.sidebar} ${isSidebarVisible ? styles.sidebarVisible : styles.sidebarHidden}`}
			>
				{currentView === "chat" ? (
					<SidebarPanel
						isVisible={isSidebarVisible}
						onSwitchView={setCurrentView}
						currentView={currentView}
					/>
				) : (
					<FileSidebar visible={isSidebarVisible} />
				)}
			</aside>

			{/* 1. Header - 顶部菜单 (固定68px) */}
			<header className={styles.header}>
				<TopBar
					workingDir={currentDir}
					connectionStatus={isConnected ? "connected" : "disconnected"}
					pid={serverPid}
					currentView={currentView}
				/>
			</header>

			{/* 2. Main - 主区域 (flex: 1) */}
			<div className={styles.main}>
				{/* 内容区 */}
				<div className={styles.content}>
					{/* 可滚动内容 */}
					<div
						ref={contentBodyRef}
						className={styles.contentBody}
						onScroll={handleScroll}
					>{children}</div>

					{/* 底部面板 - 直接渲染传入的内容 */}
					{isBottomPanelOpen && bottomPanelContent}

					{/* 输入框 */}
					{showInput && (
						<div className={styles.inputArea}>
							<InputArea
								value={inputText}
								isStreaming={isStreaming}
								onChange={controller.setInputText}
								onSend={() =>
									inputText.trim() && controller.sendMessage(inputText)
								}
								onAbort={controller.abortGeneration}
								onBashCommand={(cmd) => controller.sendMessage(`/bash ${cmd}`)}
								onSlashCommand={(cmd, args) => {
									if (cmd === "clear") controller.clearMessages();
									else controller.sendMessage(`/${cmd} ${args}`.trim());
								}}
							/>
						</div>
					)}
				</div>
			</div>

			{/* 3. Footer - 底部菜单 (固定44px) */}
			<footer className={styles.footer}>
				<BottomMenu
					isSidebarVisible={isSidebarVisible}
					currentView={currentView}
					isBottomPanelOpen={isBottomPanelOpen}
					onToggleSidebar={toggleSidebar}
					onSwitchView={setCurrentView}
					onToggleBottomPanel={() => toggleBottomPanel("terminal")}
				/>
			</footer>
		</div>
	);
}
